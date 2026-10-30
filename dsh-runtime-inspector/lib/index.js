/**
 * Host half of the DSH runtime inspector.
 *
 * Responsibilities:
 *  - observe `system-prompt/assemble` and `llm/stream` without changing them;
 *  - serve the collected facts as same-origin JSON under `/dsh-runtime-inspector`,
 *    behind `ctx.connection.requestRejection` (DSH's host/origin + login fence);
 *  - expose the same facts to the agent as the `dsh_runtime_inspect` tool.
 *
 * The plugin is strictly read-only: it never writes configuration, never
 * appends prompt text, and never mutates another plugin's registration.
 */
import {
  constantRows,
  defaultRows,
  findNodeModules,
  packageSummary,
  readPackageFile,
  scanPackages,
} from './inventory.js'
import { buildPromptReport, createPromptRecorder } from './prompt.js'
import {
  buildInterceptionsReport,
  createInterceptionRecorder,
  hookInventory,
  policyInventory,
} from './intercept.js'
import { buildRulesReport } from './rules.js'

export const name = 'dsh-runtime-inspector'
export const inject = ['webServer', 'connection', 'tools', 'systemPrompt']

const BASE_PATH = '/dsh-runtime-inspector'
const PLUGIN_VERSION = '0.1.0'
const MAX_TOOL_TEXT = 60000

function message(error) {
  return error instanceof Error ? error.message : String(error)
}

function optional(ctx, key) {
  try {
    return ctx.get(key)
  } catch {
    return undefined
  }
}

/** JSON.stringify with cycle, function and bigint guards. */
function safeStringify(value) {
  const seen = new WeakSet()
  return JSON.stringify(value, (_key, entry) => {
    if (typeof entry === 'bigint') return String(entry)
    if (typeof entry === 'function') return '[function]'
    if (typeof entry === 'symbol') return String(entry)
    if (entry !== null && typeof entry === 'object') {
      if (seen.has(entry)) return '[circular]'
      seen.add(entry)
    }
    return entry
  })
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(safeStringify(payload))
}

function clamped(value, fallback, min, max) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

/** Depth/string-bounded copy so one huge config cannot stall a response. */
function bounded(value, depth = 0) {  if (value === null || value === undefined) return value ?? null
  if (typeof value === 'string') return value.length > 4000 ? `${value.slice(0, 4000)}… (${value.length} chars)` : value
  if (typeof value !== 'object') return value
  if (depth >= 6) return '[depth-limit]'
  if (Array.isArray(value)) return value.slice(0, 200).map((entry) => bounded(entry, depth + 1))
  const out = {}
  let keys = 0
  for (const [key, entry] of Object.entries(value)) {
    if (keys >= 200) {
      out['…'] = '[key-limit]'
      break
    }
    keys += 1
    out[key] = bounded(entry, depth + 1)
  }
  return out
}

function matches(row, query) {
  if (query.length === 0) return true
  try {
    return safeStringify(row).toLowerCase().includes(query)
  } catch {
    return false
  }
}

/** Effective Loader configuration, when the composition provides the editor. */
function configPayload(ctx) {
  const report = {
    available: false,
    entryCount: null,
    entries: [],
    notes: [],
  }
  const editor = optional(ctx, 'configEditor')
  if (editor === undefined) {
    report.notes.push('ctx.configEditor is absent in this composition; install @deepseek-ai/dsh-config-editor to read inherited/override Loader configuration')
    return report
  }
  report.available = true
  try {
    const configuration = typeof editor.configuration === 'function' ? editor.configuration() : []
    const records = Array.isArray(configuration) ? configuration : []
    report.entryCount = records.length
    report.entries = records.map((record) => {
      const entry = record?.entry ?? {}
      return {
        id: entry?.id ?? null,
        name: entry?.options?.name ?? null,
        disabled: entry?.options?.disabled === true,
        config: bounded(entry?.options?.config),
        inherited: bounded(record?.inherited),
        override: bounded(record?.override),
      }
    })
  } catch (error) {
    report.notes.push(`configEditor.configuration() failed: ${message(error)}`)
  }
  return report
}

const COMPACT_TEXT = 700

/**
 * Strip the long prose from a prompt report for Agent tool consumption: the
 * Web page needs the full report (it renders every section), while the tool
 * receives metadata plus capped text so one 50k-char SDK section cannot flood
 * a model request. `compact=1` is the tool's request; the route default is
 * full so an already-loaded page never sees truncated text.
 */
function compactPrompt(report) {
  const cap = (text, limit = COMPACT_TEXT) => {
    const value = typeof text === 'string' ? text : ''
    return value.length <= limit ? value : `${value.slice(0, limit)}… (${value.length} chars)`
  }
  const parts = (list) => (Array.isArray(list) ? list.map((part) => ({
    name: part?.name,
    chars: part?.chars,
    interpolate: part?.interpolate,
    text: cap(part?.text),
  })) : [])
  const latest = report.latestAssembly === null || report.latestAssembly === undefined ? null : {
    ...report.latestAssembly,
    assembly: {
      sections: parts(report.latestAssembly.assembly?.sections),
      contexts: parts(report.latestAssembly.assembly?.contexts),
      tools: report.latestAssembly.assembly?.tools ?? [],
      variables: report.latestAssembly.assembly?.variables ?? {},
    },
  }
  const rendered = report.rendered === null || report.rendered === undefined ? null : {
    system: cap(report.rendered.system, 2500),
    systemChars: report.rendered.systemChars,
    contextSnapshot: cap(report.rendered.contextSnapshot, 900),
    sections: parts(report.rendered.sections),
    contexts: parts(report.rendered.contexts),
    problems: report.rendered.problems,
  }
  const actuals = (report.actuals ?? []).map((actual) => ({ ...actual, system: cap(actual.system, 600) }))
  const source = report.source === null || report.source === undefined ? report.source : {
    ...report.source,
    functions: Object.fromEntries(Object.entries(report.source.functions ?? {}).map(([name, code]) => [name, `${String(code).length} chars`])),
  }
  return { ...report, latestAssembly: latest, rendered, actuals, source }
}

async function promptPayload(ctx, recorder, url) {
  const compact = url.searchParams.get('compact') === '1' || url.searchParams.get('compact') === 'true'
  const report = await buildPromptReport(ctx, recorder, { assemble: url.searchParams.get('assemble') === '1' })
  return compact ? compactPrompt(report) : report
}

async function packagesPayload() {
  const report = await scanPackages()
  return {
    nodeModules: report.nodeModules,
    tried: report.tried,
    scannedAt: report.scannedAt,
    durationMs: report.durationMs,
    totalBytes: report.totalBytes,
    truncated: report.truncated,
    errors: report.errors,
    packages: packageSummary(report),
  }
}

async function constantsPayload(url) {
  const report = await scanPackages()
  const query = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const packageFilter = (url.searchParams.get('pkg') ?? '').trim()
  const kind = (url.searchParams.get('kind') ?? 'constant').trim()
  const limit = clamped(url.searchParams.get('limit'), 100, 1, 500)
  const offset = clamped(url.searchParams.get('offset'), 0, 0, 1000000)
  let rows = kind === 'default' ? defaultRows(report) : constantRows(report)
  if (kind === 'string' || kind === 'number' || kind === 'object' || kind === 'array') {
    rows = rows.filter((row) => row.kind === kind)
  }
  if (packageFilter.length > 0) rows = rows.filter((row) => row.package === packageFilter)
  if (query.length > 0) rows = rows.filter((row) => matches(row, query))
  return {
    kind,
    total: rows.length,
    offset,
    limit,
    nodeModules: report.nodeModules,
    truncated: report.truncated,
    items: rows.slice(offset, offset + limit),
  }
}

/**
 * Read or search one shipped package file. Restricted to
 * `node_modules/@deepseek-ai/<pkg>/…`; this is how the inspector exposes the
 * very source that implements a behavior (prompt rendering, loop hooks).
 */
async function sourcePayload(url) {
  const packageName = (url.searchParams.get('package') ?? '').trim()
  const relativePath = (url.searchParams.get('path') ?? 'lib/index.js').trim() || 'lib/index.js'
  const query = (url.searchParams.get('q') ?? '').trim()
  const line = clamped(url.searchParams.get('line'), 1, 1, 5000000)
  const lines = clamped(url.searchParams.get('lines'), 200, 1, 400)
  if (packageName.length === 0) return { found: false, reason: 'package is required', package: '' }
  const read = await readPackageFile(packageName, relativePath)
  if (!read.found) return { package: packageName, path: relativePath, found: false, reason: read.reason, file: read.file ?? null }
  const all = read.text.split('\n')
  if (query.length > 0) {
    const needle = query.toLowerCase()
    const matches = []
    for (let index = 0; index < all.length && matches.length < 300; index += 1) {
      if (!all[index].toLowerCase().includes(needle)) continue
      matches.push({ line: index + 1, text: all[index].slice(0, 600) })
    }
    return {
      package: packageName,
      path: relativePath,
      found: true,
      file: read.file,
      bytes: read.text.length,
      totalLines: all.length,
      query,
      matches,
      matchCount: matches.length,
      truncated: matches.length >= 300,
    }
  }
  const first = Math.min(line, all.length)
  const window = all
    .slice(first - 1, first - 1 + lines)
    .map((text, offset) => `${String(first + offset).padStart(6, ' ')}  ${text}`)
    .join('\n')
  return {
    package: packageName,
    path: relativePath,
    found: true,
    file: read.file,
    bytes: read.text.length,
    totalLines: all.length,
    line: first,
    lines,
    text: window,
  }
}

async function healthPayload(ctx, recorder, interception) {
  const roots = await findNodeModules()
  const snapshot = recorder.snapshot()
  const interceptionSnapshot = interception === undefined || interception === null ? null : interception.snapshot()
  const clientModules = optional(ctx, 'clientModules')
  let clientBundle = null
  try {
    clientBundle = typeof clientModules?.clientPath === 'function'
      ? clientModules.clientPath('dsh-runtime-inspector') ?? null
      : null
  } catch {}
  return {
    plugin: { name, version: PLUGIN_VERSION },
    process: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      electron: typeof process.versions?.electron === 'string' ? process.versions.electron : null,
      pid: process.pid,
    },
    installRoot: roots.dir ?? null,
    triedRoots: roots.tried,
    services: {
      webServer: optional(ctx, 'webServer') !== undefined,
      connection: optional(ctx, 'connection') !== undefined,
      systemPrompt: optional(ctx, 'systemPrompt') !== undefined,
      tools: optional(ctx, 'tools') !== undefined,
      configEditor: optional(ctx, 'configEditor') !== undefined,
      agents: optional(ctx, 'agents') !== undefined,
      llm: optional(ctx, 'llm') !== undefined,
      fs: optional(ctx, 'fs') !== undefined,
    },
    captured: {
      assemblies: snapshot.assemblies.length,
      actualRequests: snapshot.actuals.length,
    },
    interception: interceptionSnapshot,
    client: { bundle: clientBundle },
    routes: [`${BASE_PATH}/health`, `${BASE_PATH}/prompt`, `${BASE_PATH}/packages`, `${BASE_PATH}/constants`, `${BASE_PATH}/configs`, `${BASE_PATH}/source`, `${BASE_PATH}/intercepts`, `${BASE_PATH}/rules`],
    tool: 'dsh_runtime_inspect',
    generatedAt: Date.now(),
  }
}

async function toolText(ctx, recorder, interception, args) {
  const action = typeof args?.action === 'string' ? args.action : 'health'
  const url = new URL(`${BASE_PATH}/tool`, 'http://localhost')
  if (typeof args?.query === 'string') url.searchParams.set('q', args.query)
  if (typeof args?.package === 'string') {
    url.searchParams.set('pkg', args.package)
    url.searchParams.set('package', args.package)
  }
  if (typeof args?.path === 'string') url.searchParams.set('path', args.path)
  if (args?.line !== undefined) url.searchParams.set('line', String(args.line))
  if (args?.lines !== undefined) url.searchParams.set('lines', String(args.lines))
  if (typeof args?.kind === 'string') url.searchParams.set('kind', args.kind)
  if (args?.limit !== undefined) url.searchParams.set('limit', String(args.limit))
  if (args?.offset !== undefined) url.searchParams.set('offset', String(args.offset))
  if (args?.assemble === true) url.searchParams.set('assemble', '1')
  if (typeof args?.event === 'string') url.searchParams.set('event', args.event)
  if (typeof args?.verdict === 'string') url.searchParams.set('verdict', args.verdict)
  if (args?.full !== true) url.searchParams.set('compact', '1')
  let payload
  if (action === 'prompt') payload = await promptPayload(ctx, recorder, url)
  else if (action === 'packages') payload = await packagesPayload()
  else if (action === 'constants') payload = await constantsPayload(url)
  else if (action === 'configs') payload = configPayload(ctx)
  else if (action === 'source') payload = await sourcePayload(url)
  else if (action === 'intercepts') payload = buildInterceptionsReport(ctx, interception, url)
  else if (action === 'rules') payload = buildRulesReport(ctx, interception)
  else if (action === 'hooks') payload = { hooks: hookInventory(ctx), policies: policyInventory(ctx) }
  else if (action === 'health') payload = await healthPayload(ctx, recorder, interception)
  else payload = { error: `unknown action "${action}"`, actions: ['health', 'prompt', 'packages', 'constants', 'configs', 'source', 'intercepts', 'rules', 'hooks'] }
  const text = safeStringify(payload)
  return text.length > MAX_TOOL_TEXT ? `${text.slice(0, MAX_TOOL_TEXT)}\n… (${text.length} chars, truncated)` : text
}

/**
 * Install the inspector: capture listeners, HTTP routes and the agent tool.
 * @param ctx - the Host plugin context.
 */
export function apply(ctx) {
  const recorder = createPromptRecorder()
  const interception = createInterceptionRecorder()
  interception.install(ctx)

  // Observation only: both listeners forward the untouched chain result.
  ctx.on('system-prompt/assemble', (assembly, context, next) => {
    try {
      recorder.captureAssembly(assembly, context)
    } catch {}
    return next()
  })
  ctx.on('llm/stream', (options, next) => {
    try {
      recorder.captureActual(options)
    } catch {}
    return next()
  })

  const handleRequest = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('allow', 'GET')
      res.end()
      return
    }
    let rejection
    try {
      rejection = ctx.connection.requestRejection(req)
    } catch {
      rejection = 403
    }
    if (rejection !== undefined) {
      res.statusCode = rejection
      res.setHeader('content-type', 'text/plain; charset=utf-8')
      res.end('unauthorized')
      return
    }
    const url = new URL(String(req.url ?? '/'), 'http://localhost')
    const path = url.pathname.replace(/\/+$/, '')
    try {
      if (path === `${BASE_PATH}/health`) sendJson(res, 200, await healthPayload(ctx, recorder, interception))
      else if (path === `${BASE_PATH}/prompt`) sendJson(res, 200, await promptPayload(ctx, recorder, url))
      else if (path === `${BASE_PATH}/packages`) sendJson(res, 200, await packagesPayload())
      else if (path === `${BASE_PATH}/constants`) sendJson(res, 200, await constantsPayload(url))
      else if (path === `${BASE_PATH}/configs`) sendJson(res, 200, configPayload(ctx))
      else if (path === `${BASE_PATH}/source`) sendJson(res, 200, await sourcePayload(url))
      else if (path === `${BASE_PATH}/intercepts`) sendJson(res, 200, buildInterceptionsReport(ctx, interception, url))
      else if (path === `${BASE_PATH}/rules`) sendJson(res, 200, buildRulesReport(ctx, interception))
      else sendJson(res, 404, { error: 'not-found', path, routes: ['health', 'prompt', 'packages', 'constants', 'configs', 'source', 'intercepts', 'rules'] })
    } catch (error) {
      sendJson(res, 500, { error: 'internal-error', message: message(error) })
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: BASE_PATH, handler: handleRequest }), 'dsh-runtime-inspector: http routes')

  ctx.effect(() => ctx.tools.register({
    name: 'dsh_runtime_inspect',
    description: 'Inspect the live DeepSeek Harness runtime: intercepted seams (which plugin hooks are mounted on which event and what each live decision was), approval / interception / workspace rules (deployment policy, permission presets, per-session approval overrides, tool guards and restrictions, tool runtime scopes, workspace registry and sandbox roots), the real system-prompt assembly chain and rendered prompt, host package string constants and source, schema defaults, effective Loader configuration, and inspector health. Use action=intercepts for hooks plus recorded decisions, action=rules for the three rule domains, action=prompt for the prompt chain, action=constants/kind=string for host string constants, action=configs for live plugin configuration, action=source to read a shipped package file, action=packages to list scanned packages.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['health', 'prompt', 'packages', 'constants', 'configs', 'source', 'intercepts', 'rules', 'hooks'],
          description: 'Which runtime view to return.',
        },
        query: { type: 'string', description: 'Case-insensitive substring filter over the returned rows; for action=source it is a line search inside the file.' },
        package: { type: 'string', description: 'Exact package name filter, e.g. @deepseek-ai/dsh-system-prompt.' },
        path: { type: 'string', description: 'For action=source: slash-separated file path inside the package (default lib/index.js).' },
        line: { type: 'number', description: 'For action=source: 1-based first line of the window.' },
        lines: { type: 'number', description: 'For action=source: window size (1-400, default 200).' },
        kind: { type: 'string', enum: ['constant', 'string', 'number', 'object', 'array', 'default'], description: 'For action=constants: row kind; `default` reads schema default expressions.' },
        limit: { type: 'number', description: 'Page size (1-500, default 100).' },
        offset: { type: 'number', description: 'Page offset (default 0).' },
        assemble: { type: 'boolean', description: 'For action=prompt: also assemble the global prompt registry right now.' },
        event: { type: 'string', description: 'For action=intercepts: exact event name filter, e.g. tools/pre-execute.' },
        verdict: { type: 'string', enum: ['pass', 'intercept', 'error', 'decision'], description: 'For action=intercepts: filter recorded decisions by verdict.' },
        full: { type: 'boolean', description: 'For action=prompt: return full section and system text instead of the compact caps (large).' },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
        additionalProperties: false,
      },
      render(_args, value) {
        const text = value !== null && typeof value === 'object' && typeof value.text === 'string'
          ? value.text
          : safeStringify(value)
        return [{ type: 'text', text }]
      },
    },
    async execute(args) {
      return { text: await toolText(ctx, recorder, interception, args) }
    },
  }), 'dsh-runtime-inspector: agent tool')
}
