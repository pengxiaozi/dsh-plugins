/**
 * System-prompt inspection: the live assembly chain, the registry view, the
 * render algorithm (copied semantics of `renderPrompt` / `interpolate`), and
 * the placement tables read out of the shipped `dsh-system-prompt` source.
 *
 * The recorder only observes: `system-prompt/assemble` and `llm/stream`
 * listeners forward to `next()` unchanged.
 */
import {
  parseNumericEntries,
  readPackageSource,
  sliceFunction,
  sliceObjectLiteral,
} from './inventory.js'

const ASSEMBLY_LIMIT = 8
const ACTUAL_LIMIT = 8
const MAX_SECTION_CHARS = 20000
const MAX_SYSTEM_CHARS = 20000
const VARIABLE_NAME = /^[a-z][a-z0-9_]*$/
const GROUP_AT = /^\{\{([^{}]*)\}\}/

function message(error) {
  return error instanceof Error ? error.message : String(error)
}

function textOf(value) {
  return typeof value === 'string' ? value : ''
}

function truncate(value, limit) {
  const text = textOf(value)
  return text.length <= limit ? text : `${text.slice(0, limit)}\n… (${text.length} chars)`
}

function toVariables(value) {
  const out = {}
  if (value === null || typeof value !== 'object') return out
  for (const [name, entry] of Object.entries(value)) {
    if (entry === undefined) out[name] = null
    else if (typeof entry === 'string') out[name] = entry.length > 2000 ? truncate(entry, 2000) : entry
    else out[name] = truncate(JSON.stringify(entry), 2000)
  }
  return out
}

/** Detached, size-capped copy of one prompt assembly. */
export function cloneAssembly(assembly) {
  const source = assembly !== null && typeof assembly === 'object' ? assembly : {}
  return {
    sections: Array.isArray(source.sections)
      ? source.sections.map((section) => ({
        name: textOf(section?.name),
        text: truncate(section?.text, MAX_SECTION_CHARS),
        chars: textOf(section?.text).length,
        interpolate: section?.interpolate === false ? false : undefined,
      }))
      : [],
    contexts: Array.isArray(source.contexts)
      ? source.contexts.map((context) => ({
        name: textOf(context?.name),
        text: truncate(context?.text, MAX_SECTION_CHARS),
        chars: textOf(context?.text).length,
        interpolate: context?.interpolate === false ? false : undefined,
      }))
      : [],
    tools: Array.isArray(source.tools)
      ? source.tools.map((tool) => ({
        name: textOf(tool?.name),
        description: truncate(tool?.description, 500),
        parametersChars: tool?.parameters === undefined ? 0 : JSON.stringify(tool.parameters).length,
        deferLoading: tool?.deferLoading === true ? true : undefined,
      }))
      : [],
    variables: toVariables(source.variables),
  }
}

function textOfMessage(message) {
  if (message === null || typeof message !== 'object') return ''
  const content = message.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n\n')
}

/**
 * The system text one generation really carries. A route with
 * `systemPromptUpdate: 'in-history'` (the shipped DeepSeek adapters) carries it
 * as the leading `system` messages instead of `options.system`, so both are
 * read and the source is reported.
 */
function systemOf(options) {
  const direct = textOf(options?.system)
  if (direct.length > 0) return { text: direct, source: 'options.system' }
  const messages = Array.isArray(options?.messages) ? options.messages : []
  const parts = []
  for (const message of messages) {
    if (message === null || typeof message !== 'object') continue
    if (message.role !== 'system' && message.role !== 'developer') continue
    const text = textOfMessage(message)
    if (text.length > 0) parts.push(text)
  }
  return parts.length === 0 ? { text: '', source: 'none' } : { text: parts.join('\n\n'), source: 'history' }
}

/**
 * Create the in-process capture buffers. One instance lives per Host plugin
 * load; its snapshot is read by the HTTP routes and the agent tool.
 */
export function createPromptRecorder() {
  const assemblies = []
  const actuals = []
  return {
    captureAssembly(assembly, context) {
      const detached = cloneAssembly(assembly)
      assemblies.unshift({
        at: Date.now(),
        sections: detached.sections.length,
        contexts: detached.contexts.length,
        tools: detached.tools.length,
        variables: Object.keys(detached.variables),
        chars: detached.sections.reduce((sum, section) => sum + section.chars, 0),
        contextKeys: context !== null && typeof context === 'object' ? Object.keys(context) : [],
        assembly: detached,
      })
      if (assemblies.length > ASSEMBLY_LIMIT) assemblies.length = ASSEMBLY_LIMIT
    },
    captureActual(options) {
      const system = systemOf(options)
      actuals.unshift({
        at: Date.now(),
        sessionId: typeof options?.sessionId === 'string' ? options.sessionId : null,
        provider: typeof options?.provider === 'string' ? options.provider : null,
        model: typeof options?.model === 'string' ? options.model : null,
        purpose: typeof options?.purpose === 'string' ? options.purpose : null,
        messages: Array.isArray(options?.messages) ? options.messages.length : 0,
        tools: Array.isArray(options?.tools) ? options.tools.length : 0,
        chars: system.text.length,
        source: system.source,
        system: truncate(system.text, MAX_SYSTEM_CHARS),
      })
      if (actuals.length > ACTUAL_LIMIT) actuals.length = ACTUAL_LIMIT
    },
    snapshot() {
      return { assemblies, actuals }
    },
  }
}

function sectionView(definition) {
  const isFunction = typeof definition?.text === 'function'
  return {
    name: textOf(definition?.name),
    order: typeof definition?.order === 'number' ? definition.order : null,
    complete: definition?.complete === true,
    interpolate: definition?.interpolate !== false,
    kind: isFunction ? 'function' : 'string',
    chars: typeof definition?.text === 'string' ? definition.text.length : 0,
    text: typeof definition?.text === 'string' ? truncate(definition.text, 4000) : undefined,
  }
}

function byOrder(left, right) {
  const a = left.order === null ? Number.POSITIVE_INFINITY : left.order
  const b = right.order === null ? Number.POSITIVE_INFINITY : right.order
  if (a !== b) return a - b
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0
}

/**
 * Read the registry's global layer through the live service instance: the
 * pre-waterfall section/context definitions with their numeric placement.
 */
export function registryView(ctx) {
  const view = {
    available: false,
    sections: [],
    contexts: [],
    variables: [],
    runtimeContextSuppressed: false,
    scopedLayers: 0,
    notes: [],
  }
  const service = ctx.get('systemPrompt')
  const layers = service?.layers
  if (layers === undefined) {
    view.notes.push('the live systemPrompt service exposes no `layers` field in this build')
    return view
  }
  view.available = true
  const global = layers.global
  try {
    if (global?.sections?.entries !== undefined) {
      for (const [name, definition] of global.sections.entries()) view.sections.push({ ...sectionView(definition), name })
      view.sections.sort(byOrder)
    }
    if (global?.contexts?.entries !== undefined) {
      for (const [name, definition] of global.contexts.entries()) view.contexts.push({ ...sectionView(definition), name })
      view.contexts.sort(byOrder)
    }
    if (global?.variables?.keys !== undefined) view.variables = [...global.variables.keys()]
    view.runtimeContextSuppressed = global?.runtimeContextSuppressors?.isEmpty?.() === false
  } catch (error) {
    view.notes.push(`registry read failed: ${message(error)}`)
  }
  if (layers?.scoped instanceof Map) view.scopedLayers = layers.scoped.size
  return view
}

/** Copy of `dsh-system-prompt`'s `interpolate`, with diagnostics attribution. */
function interpolate(text, variables, label) {
  let result = ''
  let last = 0
  for (let open = text.indexOf('{{'); open >= 0; open = text.indexOf('{{', last)) {
    const group = GROUP_AT.exec(text.slice(open))
    if (group === null) {
      if (text.indexOf('}}', open + 2) >= 0) throw new Error(`malformed prompt variable reference at "${text.slice(open, open + 16)}…" in ${label}`)
      result += text.slice(last, open + 2)
      last = open + 2
      continue
    }
    const name = group[0].slice(2, -2)
    if (!VARIABLE_NAME.test(name)) throw new Error(`malformed prompt variable reference "{{${name}}}" in ${label}`)
    if (!Object.hasOwn(variables, name)) throw new Error(`unknown prompt variable "{{${name}}}" in ${label}`)
    const value = variables[name]
    if (value === undefined || value === null) throw new Error(`prompt variable "{{${name}}}" has no value for this assembly (${label})`)
    result += text.slice(last, open) + value
    last = open + group[0].length
  }
  return result + text.slice(last)
}

/** Render one assembly the way the model receives it, keeping per-part text. */
export function renderAssembly(assembly) {
  const problems = []
  const sections = Array.isArray(assembly?.sections) ? assembly.sections : []
  const contexts = Array.isArray(assembly?.contexts) ? assembly.contexts : []
  const variables = assembly?.variables ?? {}
  const renderPart = (part, kind) => {
    const text = textOf(part?.text)
    if (part?.interpolate === false) return { name: textOf(part?.name), text }
    try {
      return { name: textOf(part?.name), text: interpolate(text, variables, `${kind} "${textOf(part?.name)}"`) }
    } catch (error) {
      problems.push(message(error))
      return { name: textOf(part?.name), text }
    }
  }
  const renderedSections = sections.map((section) => renderPart(section, 'section')).filter((part) => part.text.length > 0)
  const renderedContexts = contexts.map((context) => renderPart(context, 'context')).filter((part) => part.text.length > 0)
  const contextBody = renderedContexts.map((part) => part.text).join('\n\n')
  const system = renderedSections.map((part) => part.text).join('\n\n')
  return {
    system,
    systemChars: system.length,
    contextSnapshot: contextBody.length === 0
      ? ''
      : `Current runtime context. This snapshot supersedes earlier runtime-context snapshots.\n\n${contextBody}`,
    sections: renderedSections,
    contexts: renderedContexts,
    problems,
  }
}

let sourceCache
/** Placement tables and render-algorithm source from the shipped package. */
export async function systemPromptSource() {
  if (sourceCache !== undefined) return sourceCache
  sourceCache = (async () => {
    const read = await readPackageSource('@deepseek-ai/dsh-system-prompt')
    if (!read.found) return { found: false, reason: read.reason, file: read.file }
    const sections = sliceObjectLiteral(read.source, 'SECTION_ORDERS')
    const contexts = sliceObjectLiteral(read.source, 'CONTEXT_ORDERS')
    const functions = {}
    for (const name of ['renderPrompt', 'interpolate', 'orderTools', 'comparePromptSections', 'renderContextSections', 'joinContextSections']) {
      const code = sliceFunction(read.source, name)
      if (code !== undefined) functions[name] = code.length > 6000 ? `${code.slice(0, 6000)}\n… (${code.length} chars)` : code
    }
    return {
      found: true,
      file: read.file,
      bytes: read.source.length,
      sectionOrders: parseNumericEntries(sections),
      contextOrders: parseNumericEntries(contexts),
      functions,
    }
  })()
  return sourceCache
}

/** Everything the prompt tab and the agent tool read. */
export async function buildPromptReport(ctx, recorder, options = {}) {
  const snapshot = recorder.snapshot()
  const registry = registryView(ctx)
  const source = await systemPromptSource()
  const latest = snapshot.assemblies[0] ?? null
  const rendered = latest === null ? null : renderAssembly(latest.assembly)
  let assembledNow
  if (options.assemble === true) {
    try {
      const assembly = await ctx.systemPrompt.assemble({})
      const cloned = cloneAssembly(assembly)
      assembledNow = { ok: true, at: Date.now(), assembly: cloned, rendered: renderAssembly(cloned) }
    } catch (error) {
      assembledNow = { ok: false, error: message(error) }
    }
  }
  return {
    generatedAt: Date.now(),
    registry,
    latestAssembly: latest,
    rendered,
    assembledNow,
    actuals: snapshot.actuals,
    source,
  }
}
