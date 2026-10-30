/**
 * Interception inspection for the DeepSeek Harness host.
 *
 * Two views, both read-only:
 *  - the live hook table: every event with mounted listeners, attributed to the
 *    Loader entry (package) that registered them;
 *  - the runtime decision log: for each intercepted seam, an observer calls the
 *    chain's `next()` exactly once and records what came back. Observers are
 *    registered with `prepend: true`, so they wrap the whole chain and see the
 *    final decision rather than the built-in default.
 *
 * Nothing here changes behavior: every observer returns the chain's own value,
 * and summary construction is guarded so a pathological payload cannot break
 * the dispatch it observes.
 */

const MAX_RECORDS = 200
const MAX_TEXT = 400
const SELF_PACKAGE = '@local/dsh-runtime-inspector'

/** Interception seams this inspector observes, with their placement. */
export const INTERCEPTION_SEAMS = [
  {
    event: 'tools/pre-execute',
    mode: 'waterfall',
    group: '工具',
    label: '工具执行前策略',
    hint: 'allow / deny / cancel / ask：权限预设、沙箱、护栏都在这里决定放不放行',
  },
  {
    event: 'tools/post-execute',
    mode: 'waterfall',
    group: '工具',
    label: '工具结果后处理',
    hint: 'accept / block / 改写 content：结果脱敏、截断、失败重写',
  },
  {
    event: 'tools/execute',
    mode: 'waterfall',
    group: '工具',
    label: '工具执行包裹',
    hint: '超时、重试、指标等 around-dispatch 逻辑',
  },
  {
    event: 'agent/pre-step',
    mode: 'waterfall',
    group: 'Agent',
    label: '单步消息门控',
    hint: 'reject / enter：注入上下文、改写进入本步的消息',
  },
  {
    event: 'agent/request',
    mode: 'waterfall',
    group: 'Agent',
    label: '模型请求配置',
    hint: '最终冻结的 provider / model / maxTokens 等调用参数',
  },
  {
    event: 'llm/stream',
    mode: 'waterfall',
    group: '模型',
    label: '模型流包裹',
    hint: '重试、回放、路由：请求进入适配器前的最后一层',
  },
  {
    event: 'system-prompt/assemble',
    mode: 'waterfall',
    group: '提示词',
    label: 'system prompt 装配',
    hint: 'section / context 的增删改（整段替换也在这里）',
  },
  {
    event: 'approval/request',
    mode: 'waterfall',
    group: '审批',
    label: '审批请求',
    hint: '策略给出的 allow / deny 决策',
  },
  {
    event: 'user-questions/request',
    mode: 'waterfall',
    group: '审批',
    label: '结构化提问',
    hint: '模型向用户提问的应答链路',
  },
  {
    event: 'fs/write-intent',
    mode: 'waterfall',
    group: '文件',
    label: '文件写入意图',
    hint: '覆盖写前的版本/沙箱判定',
  },
  {
    event: 'fs/edit-intent',
    mode: 'waterfall',
    group: '文件',
    label: '文件编辑意图',
    hint: 'read-before-edit 与版本守卫',
  },
  {
    event: 'session-telemetry/record',
    mode: 'waterfall',
    group: '遥测',
    label: '遥测记录改写',
    hint: '脱敏、丢弃、补充字段',
  },
  {
    event: 'compaction/summary-error',
    mode: 'waterfall',
    group: '压缩',
    label: '压缩失败处理',
    hint: '摘要失败时的恢复决策',
  },
  {
    event: 'workspace/session-activity',
    mode: 'waterfall',
    group: '工作区',
    label: '会话活动收集',
    hint: '归档前询问还有哪些活动在跑',
  },
]

function message(error) {
  return error instanceof Error ? error.message : String(error)
}

function now() {
  return typeof performance === 'object' && typeof performance.now === 'function' ? performance.now() : Date.now()
}

function optional(ctx, key) {
  try {
    return ctx.get(key)
  } catch {
    return undefined
  }
}

function isThenable(value) {
  return value !== null && typeof value === 'object' && typeof value.then === 'function'
}

function textOf(value, limit = MAX_TEXT) {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value.length > limit ? `${value.slice(0, limit)}… (${value.length} chars)` : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return undefined
}

/** Bounded plain summary of an arbitrary value; never throws. */
function digest(value, depth = 0) {
  try {
    if (value === undefined) return null
    if (value === null) return null
    if (typeof value === 'string') return textOf(value)
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value === 'function') return '[function]'
    if (depth >= 3) return '[depth-limit]'
    if (Array.isArray(value)) {
      return value.slice(0, 6).map((entry) => digest(entry, depth + 1))
    }
    if (typeof value === 'object') {
      const out = {}
      let count = 0
      for (const key of Object.keys(value)) {
        if (count >= 14) {
          out['…'] = '[key-limit]'
          break
        }
        count += 1
        out[key] = digest(value[key], depth + 1)
      }
      return out
    }
    return String(value)
  } catch {
    return '[unreadable]'
  }
}

function charsOfSections(sections) {
  if (!Array.isArray(sections)) return 0
  return sections.reduce((sum, section) => sum + (typeof section?.text === 'string' ? section.text.length : 0), 0)
}

function blockTexts(blocks) {
  if (!Array.isArray(blocks)) return null
  return blocks
    .map((block) => (block !== null && typeof block === 'object' && block.type === 'text' ? block.text : null))
    .filter((text) => typeof text === 'string')
    .join('\n')
    .slice(0, MAX_TEXT)
}

function sessionOf(payload) {
  const first = Array.isArray(payload) ? payload[0] : undefined
  const candidates = [first?.agent?.id, first?.sessionId, first?.id, first?.session?.id]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return null
}

/** Per-seam summarizers: what entered, what came back, and how to read it. */
const HANDLERS = {
  'tools/pre-execute': {
    input: (payload) => {
      const exec = payload[0] ?? {}
      return { tool: exec.name ?? null, agent: exec.agent?.id ?? null, args: digest(exec.arguments) }
    },
    result: (payload, decision) => {
      if (decision === undefined || decision === null) {
        return { summary: { decision: 'allow (built-in default)' }, verdict: 'pass', action: 'allow' }
      }
      const kind = decision.kind ?? 'unknown'
      return {
        summary: { decision: kind, reason: decision.reason ?? null, info: decision.info ?? null },
        verdict: kind === 'allow' ? 'pass' : 'intercept',
        action: kind,
        reason: typeof decision.reason === 'string' ? decision.reason : null,
      }
    },
  },
  'tools/post-execute': {
    input: (payload) => {
      const exec = payload[0] ?? {}
      const result = payload[1] ?? {}
      return { tool: exec.name ?? null, isError: result.isError === true, contentBlocks: Array.isArray(result.content) ? result.content.length : 0 }
    },
    result: (payload, decision) => {
      const result = payload[1] ?? {}
      if (decision === undefined || decision === null) {
        return { summary: { decision: 'accept (unchanged)' }, verdict: 'pass', action: 'accept' }
      }
      const extra = decision.content !== undefined || decision.value !== undefined || decision.feedback !== undefined
      return {
        summary: {
          decision: decision.kind ?? 'unknown',
          blocks: Array.isArray(decision.content) ? decision.content.length : 0,
          value: decision.value !== undefined ? digest(decision.value) : null,
          feedback: blockTexts(decision.feedback),
          sourceIsError: result.isError === true,
        },
        verdict: decision.kind === 'block' ? 'intercept' : extra ? 'intercept' : 'pass',
        action: decision.kind ?? 'unknown',
      }
    },
  },
  'tools/execute': {
    input: (payload) => {
      const exec = payload[0] ?? {}
      return { tool: exec.name ?? null, agent: exec.agent?.id ?? null }
    },
    result: (payload, out) => ({
      summary: {
        isError: out?.isError === true,
        code: out?.error?.code ?? null,
        blocks: Array.isArray(out?.content) ? out.content.length : 0,
      },
      verdict: out?.isError === true ? 'error' : 'pass',
      action: out?.isError === true ? (out?.error?.code ?? 'error') : 'pass',
      reason: out?.isError === true ? (out?.error?.message ?? null) : null,
    }),
  },
  'agent/pre-step': {
    input: (payload) => {
      const event = payload[0] ?? {}
      return { agent: event.agent?.id ?? null, messages: Array.isArray(event.messages) ? event.messages.length : 0, turn: event.turn ?? null, step: event.step ?? null }
    },
    result: (payload, decision) => {
      const event = payload[0] ?? {}
      const before = Array.isArray(event.messages) ? event.messages.length : 0
      if (decision === undefined || decision === null) return { summary: { decision: 'enter (default)' }, verdict: 'pass', action: 'enter' }
      if (decision.kind === 'reject') return { summary: { decision: 'reject' }, verdict: 'intercept', action: 'reject' }
      const after = Array.isArray(decision.messages) ? decision.messages.length : before
      const rewritten = after !== before
      return {
        summary: { decision: 'enter', messagesBefore: before, messagesAfter: after, startsRequestSeries: decision.startsRequestSeries === true },
        verdict: rewritten ? 'intercept' : 'pass',
        action: rewritten ? 'rewrite' : 'enter',
      }
    },
  },
  'agent/request': {
    input: (payload) => {
      const event = payload[0] ?? {}
      return { agent: event.agent?.id ?? null, turn: event.turn ?? null, step: event.step ?? null }
    },
    result: (_payload, config) => ({
      summary: {
        provider: config?.provider ?? null,
        model: config?.model ?? null,
        reasoningEffort: config?.reasoningEffort ?? null,
        temperature: config?.temperature ?? null,
        maxTokens: config?.maxTokens ?? null,
        stop: config?.stop ?? null,
      },
      verdict: 'decision',
      action: 'frozen',
    }),
  },
  'llm/stream': {
    input: (payload) => {
      const options = payload[0] ?? {}
      return {
        provider: options.provider ?? null,
        model: options.model ?? null,
        sessionId: options.sessionId ?? null,
        purpose: options.purpose ?? null,
        messages: Array.isArray(options.messages) ? options.messages.length : 0,
        systemChars: typeof options.system === 'string' ? options.system.length : 0,
        tools: Array.isArray(options.tools) ? options.tools.length : 0,
      }
    },
    result: () => ({ summary: { wrapped: 'async-iterable' }, verdict: 'pass', action: 'stream' }),
  },
  'system-prompt/assemble': {
    input: (payload) => {
      const assembly = payload[0] ?? {}
      return {
        sections: Array.isArray(assembly.sections) ? assembly.sections.length : 0,
        contexts: Array.isArray(assembly.contexts) ? assembly.contexts.length : 0,
        tools: Array.isArray(assembly.tools) ? assembly.tools.length : 0,
        chars: charsOfSections(assembly.sections),
      }
    },
    result: (payload, output) => {
      const before = payload[0] ?? {}
      const after = output ?? {}
      const beforeSections = new Map((Array.isArray(before.sections) ? before.sections : []).map((section) => [section?.name, typeof section?.text === 'string' ? section.text.length : 0]))
      const afterSections = Array.isArray(after.sections) ? after.sections : []
      const added = afterSections.filter((section) => !beforeSections.has(section?.name)).map((section) => section?.name)
      const changed = afterSections.filter((section) => beforeSections.has(section?.name) && beforeSections.get(section?.name) !== (typeof section?.text === 'string' ? section.text.length : 0)).map((section) => section?.name)
      const removed = [...beforeSections.keys()].filter((name) => !afterSections.some((section) => section?.name === name))
      const contextsBefore = Array.isArray(before.contexts) ? before.contexts.length : 0
      const contextsAfter = Array.isArray(after.contexts) ? after.contexts.length : 0
      const toolsBefore = Array.isArray(before.tools) ? before.tools.length : 0
      const toolsAfter = Array.isArray(after.tools) ? after.tools.length : 0
      const touched = added.length + changed.length + removed.length + Math.abs(contextsAfter - contextsBefore) + Math.abs(toolsAfter - toolsBefore)
      return {
        summary: {
          sections: afterSections.length,
          chars: charsOfSections(afterSections),
          added,
          changed,
          removed,
          contextsBefore,
          contextsAfter,
          toolsBefore,
          toolsAfter,
        },
        verdict: touched > 0 ? 'intercept' : 'pass',
        action: touched > 0 ? 'rewrite' : 'pass',
      }
    },
  },
  'approval/request': {
    input: (payload) => {
      const request = payload[0] ?? {}
      return { kind: request.kind ?? null, tool: request.toolName ?? request.exec?.name ?? null, reason: textOf(request.reason) }
    },
    result: (_payload, outcome) => ({
      summary: { outcome: digest(outcome) },
      verdict: outcome === undefined || outcome === null ? 'pass' : outcome?.kind === 'allow' || outcome?.decision === 'allow' ? 'pass' : 'decision',
      action: outcome?.kind ?? outcome?.decision ?? 'answered',
    }),
  },
  'fs/write-intent': {
    input: (payload) => {
      const target = payload[0] ?? {}
      return { target: target.path ?? target.hostPath ?? digest(target), actor: payload[1] === undefined ? null : 'present' }
    },
    result: (_payload, intent) => ({
      summary: { intent: digest(intent) },
      verdict: intent === undefined || intent === null ? 'pass' : 'intercept',
      action: intent === undefined || intent === null ? 'pass' : 'guard',
    }),
  },
  'fs/edit-intent': {
    input: (payload) => {
      const target = payload[0] ?? {}
      return { target: target.path ?? target.hostPath ?? digest(target), actor: payload[1] === undefined ? null : 'present' }
    },
    result: (_payload, intent) => ({
      summary: { intent: digest(intent) },
      verdict: intent === undefined || intent === null ? 'pass' : 'intercept',
      action: intent === undefined || intent === null ? 'pass' : 'guard',
    }),
  },
  'session-telemetry/record': {
    input: (payload) => {
      const record = payload[0] ?? {}
      return { bytes: JSON.stringify(digest(record)).length, keys: Object.keys(record).slice(0, 12) }
    },
    result: (payload, output) => {
      const before = payload[0] ?? {}
      const after = output ?? {}
      let changed = true
      try {
        changed = JSON.stringify(before) !== JSON.stringify(after)
      } catch {
        changed = true
      }
      return { summary: { rewritten: changed, keys: Object.keys(after).slice(0, 12) }, verdict: changed ? 'intercept' : 'pass', action: changed ? 'rewrite' : 'pass' }
    },
  },
  'compaction/summary-error': {
    input: (payload) => {
      const event = payload[0] ?? {}
      return { session: event.session?.id ?? null, sourceEvents: Array.isArray(event.sourceEventSeqs) ? event.sourceEventSeqs.length : 0, error: textOf(event.error?.message ?? message(event.error)) }
    },
    result: (_payload, recovered) => ({
      summary: { recovered: recovered === true },
      verdict: recovered === true ? 'intercept' : 'pass',
      action: recovered === true ? 'recover' : 'pass',
    }),
  },
  'workspace/session-activity': {
    input: (payload) => ({ request: digest(payload[0]) }),
    result: (_payload, activities) => ({
      summary: { activities: Array.isArray(activities) ? activities.length : 0, names: Array.isArray(activities) ? activities.map((entry) => entry?.kind ?? entry?.name ?? null).slice(0, 8) : [] },
      verdict: 'decision',
      action: 'collected',
    }),
  },
}

function buildInput(seam, payload) {
  const handler = HANDLERS[seam.event]
  try {
    return handler?.input === undefined ? { payload: digest(payload[0]) } : handler.input(payload)
  } catch {
    return { error: 'input-summary-failed' }
  }
}

function buildRecord(seam, payload, capturedInput, output, error, elapsedMs) {
  const handler = HANDLERS[seam.event]
  const input = capturedInput
  let result = {}
  let verdict = 'pass'
  let action = null
  let reason = null
  if (error !== undefined) {
    verdict = 'error'
    action = 'error'
    reason = message(error)
    result = { error: reason }
  } else {
    try {
      const described = handler?.result === undefined ? { summary: { output: digest(output) }, verdict: output === undefined ? 'pass' : 'decision' } : handler.result(payload, output)
      result = described.summary ?? {}
      verdict = described.verdict ?? 'pass'
      action = described.action ?? null
      reason = described.reason ?? null
    } catch {
      result = { error: 'output-summary-failed' }
      verdict = 'error'
    }
  }
  return {
    at: Date.now(),
    seam: seam.event,
    label: seam.label,
    group: seam.group,
    mode: seam.mode,
    ms: Math.round(elapsedMs * 10) / 10,
    verdict,
    action,
    reason,
    sessionId: sessionOf(payload),
    input,
    output: result,
  }
}

function observeWaterfall(ctx, seam, recorder) {
  ctx.on(seam.event, (...args) => {
    const next = args.pop()
    const payload = args
    // Capture the input BEFORE the chain runs: later listeners may rewrite the
    // payload in place, and the record must show what actually entered.
    const capturedInput = buildInput(seam, payload)
    const started = now()
    let output
    try {
      output = next()
    } catch (error) {
      recorder.push(buildRecord(seam, payload, capturedInput, undefined, error, now() - started))
      throw error
    }
    if (isThenable(output)) {
      return Promise.resolve(output).then(
        (value) => {
          recorder.push(buildRecord(seam, payload, capturedInput, value, undefined, now() - started))
          return value
        },
        (error) => {
          recorder.push(buildRecord(seam, payload, capturedInput, undefined, error, now() - started))
          throw error
        },
      )
    }
    recorder.push(buildRecord(seam, payload, capturedInput, output, undefined, now() - started))
    return output
  }, { prepend: true })
}

/** In-process capture buffer for interception decisions. */
export function createInterceptionRecorder() {
  const records = []
  return {
    records,
    push(record) {
      records.unshift(record)
      if (records.length > MAX_RECORDS) records.length = MAX_RECORDS
    },
    /** Install one pass-through observer per seam. */
    install(ctx) {
      for (const seam of INTERCEPTION_SEAMS) {
        try {
          observeWaterfall(ctx, seam, this)
        } catch {}
      }
    },
    snapshot() {
      return { total: records.length, intercepted: records.filter((record) => record.verdict === 'intercept').length }
    },
  }
}

function attributeContext(context, index) {
  let cursor = context
  for (let depth = 0; depth < 40 && cursor !== undefined && cursor !== null; depth += 1) {
    const byNode = index.get(cursor)
    if (byNode !== undefined) return byNode
    const fiber = cursor.fiber
    if (fiber !== undefined && fiber !== null) {
      const byFiber = index.get(fiber)
      if (byFiber !== undefined) return byFiber
    }
    const parent = fiber?.parent
    if (parent === undefined || parent === null || parent === cursor) return null
    cursor = parent
  }
  return null
}

/**
 * The live event table: every event with mounted listeners, in mount order,
 * attributed to the Loader entry of the registering context.
 */
export function hookInventory(ctx) {
  const events = (() => {
    try {
      if (ctx.events !== undefined && ctx.events !== null) return ctx.events
    } catch {}
    return optional(ctx, 'events')
  })()
  const table = events?._hooks ?? events?.hooks ?? optional(ctx, 'root')?.events?._hooks
  const report = {
    available: false,
    events: [],
    totalEvents: 0,
    totalListeners: 0,
    loaderEntries: 0,
    notes: [],
  }
  if (table === null || typeof table !== 'object') {
    report.notes.push('ctx.events._hooks is not readable in this build')
    try {
      const keys = events === undefined || events === null
        ? 'events is undefined'
        : `events own keys: ${Object.getOwnPropertyNames(events).slice(0, 20).join(', ')}`
      report.notes.push(keys)
    } catch {}
    return report
  }
  const index = new Map()
  try {
    const loader = (() => {
      try {
        if (ctx.loader !== undefined && ctx.loader !== null) return ctx.loader
      } catch {}
      return optional(ctx, 'loader')
    })()
    if (loader !== null && loader !== undefined && typeof loader.entries === 'function') {
      for (const entry of loader.entries()) {
        report.loaderEntries += 1
        const info = {
          package: entry?.options?.name ?? null,
          entryId: entry?.options?.id ?? null,
          disabled: entry?.options?.disabled === true,
        }
        for (const node of [entry?.fiber, entry?.fiber?.ctx, entry?.fiber?.context]) {
          if (node !== undefined && node !== null) index.set(node, info)
        }
      }
    }
  } catch (error) {
    report.notes.push(`loader.entries() failed: ${message(error)}`)
  }
  const seamsByName = new Map(INTERCEPTION_SEAMS.map((seam) => [seam.event, seam]))
  let totalListeners = 0
  for (const [name, hooks] of Object.entries(table)) {
    if (!Array.isArray(hooks) || hooks.length === 0) continue
    const listeners = hooks.map((hook, order) => {
      const attributed = attributeContext(hook?.ctx, index)
      const seam = seamsByName.get(name)
      return {
        order,
        package: attributed?.package ?? null,
        entryId: attributed?.entryId ?? null,
        disabled: attributed?.disabled === true,
        prepend: hook?.prepend === true,
        global: hook?.global === true,
        observed: seam !== undefined,
        self: attributed?.package === SELF_PACKAGE,
      }
    })
    totalListeners += listeners.length
    const seam = seamsByName.get(name)
    report.events.push({
      name,
      internal: name.startsWith('internal/'),
      count: listeners.length,
      mode: seam?.mode ?? null,
      group: seam?.group ?? null,
      label: seam?.label ?? null,
      hint: seam?.hint ?? null,
      observed: seam !== undefined,
      listeners,
    })
  }
  report.events.sort((left, right) => right.count - left.count || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  report.available = true
  report.totalEvents = report.events.length
  report.totalListeners = totalListeners
  return report
}

function summarizeValue(value) {
  try {
    if (value === undefined) return { type: 'undefined' }
    if (value === null) return { type: 'null' }
    if (typeof value === 'function') return { type: 'function' }
    if (typeof value === 'string') return { type: 'string', preview: textOf(value, 200) }
    if (typeof value === 'number' || typeof value === 'boolean') return { type: typeof value, preview: String(value) }
    if (Array.isArray(value)) {
      return {
        type: 'array',
        length: value.length,
        items: value.slice(0, 8).map((item) => (typeof item === 'function' ? `[function ${item.name || 'anonymous'}]` : digest(item))),
      }
    }
    if (value instanceof Map) return { type: 'map', size: value.size, keys: [...value.keys()].slice(0, 10).map((key) => digest(key)) }
    if (value instanceof Set) return { type: 'set', size: value.size, items: [...value].slice(0, 8).map((item) => digest(item)) }
    if (typeof value === 'object') return { type: 'object', keys: Object.keys(value).slice(0, 12) }
    return { type: typeof value }
  } catch {
    return { type: 'unreadable' }
  }
}

/**
 * Best-effort read of the policy state kept inside enforcing services (tool
 * guards, restrictions, approval and sandbox owners). Only plain own fields are
 * read; a defensively bounded summary is returned.
 */
export function policyInventory(ctx) {
  const services = ['tools', 'approval', 'sandboxPolicy', 'permissionPresets', 'systemPrompt', 'compaction', 'llm']
  const out = []
  for (const name of services) {
    const service = optional(ctx, name)
    if (service === undefined || service === null) {
      out.push({ service: name, present: false, fields: [] })
      continue
    }
    const fields = []
    try {
      for (const property of Object.getOwnPropertyNames(service)) {
        if (property === 'constructor' || property === 'ctx' || property === 'name') continue
        let value
        try {
          value = service[property]
        } catch (error) {
          fields.push({ name: property, type: 'getter-threw', preview: message(error) })
          continue
        }
        if (typeof value === 'function') continue
        fields.push({ name: property, ...summarizeValue(value) })
      }
    } catch (error) {
      fields.push({ name: '<scan>', type: 'error', preview: message(error) })
    }
    out.push({ service: name, present: true, fields: fields.slice(0, 40) })
  }
  return out
}

function clamp(value, fallback, min, max) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

/** Report for the interceptions route and tool action. */
export function buildInterceptionsReport(ctx, recorder, url) {
  const hooks = hookInventory(ctx)
  const eventFilter = (url.searchParams.get('event') ?? '').trim()
  const verdictFilter = (url.searchParams.get('verdict') ?? '').trim()
  const query = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const limit = clamp(url.searchParams.get('limit'), 60, 1, 200)
  const offset = clamp(url.searchParams.get('offset'), 0, 0, 100000)
  const all = recorder.records
  let rows = all
  if (eventFilter.length > 0) {
    hooks.events = hooks.events.filter((event) => event.name === eventFilter)
    hooks.totalEvents = hooks.events.length
    hooks.totalListeners = hooks.events.reduce((sum, event) => sum + event.count, 0)
    rows = rows.filter((record) => record.seam === eventFilter)
  }
  if (verdictFilter.length > 0) rows = rows.filter((record) => record.verdict === verdictFilter)
  if (query.length > 0) {
    rows = rows.filter((record) => {
      try {
        return JSON.stringify(record).toLowerCase().includes(query)
      } catch {
        return false
      }
    })
  }
  const bySeam = {}
  for (const record of all) bySeam[record.seam] = (bySeam[record.seam] ?? 0) + 1
  return {
    generatedAt: Date.now(),
    hooks,
    seams: INTERCEPTION_SEAMS,
    policies: policyInventory(ctx),
    records: { total: rows.length, offset, limit, items: rows.slice(offset, offset + limit) },
    summary: {
      total: all.length,
      intercepted: all.filter((record) => record.verdict === 'intercept').length,
      errors: all.filter((record) => record.verdict === 'error').length,
      bySeam,
    },
  }
}
