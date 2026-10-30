/**
 * Pure export formatters for dsh-session-exporter.
 *
 * They consume the event-sourced session log (`SessionEvent[]`) plus the
 * immutable `SessionHeader` and produce detached text. No I/O, no DSH service
 * access — `lib/sessions.js` owns that, which keeps these functions testable.
 */

const FORMATS = ['json', 'jsonl', 'md', 'qa', 'events']
const MAX_TOOL_TEXT = 2000
const MAX_ARG_TEXT = 1200

function textOfBlocks(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
    else if (block.type === 'reasoning' && typeof block.text === 'string') parts.push(block.text)
    else if (block.type === 'image') parts.push(`[image ${block.attachment?.attachmentId ?? ''}]`)
    else if (block.type === 'file') parts.push(`[file ${block.attachment?.name ?? block.attachment?.attachmentId ?? ''}]`)
    else if (block.type === 'tool-call') parts.push(`[tool-call ${block.name ?? ''}]`)
  }
  return parts.join('\n')
}

function textOfMessage(message) {
  return message !== null && typeof message === 'object' ? textOfBlocks(message.content) : ''
}

function truncate(value, limit) {
  const text = typeof value === 'string' ? value : ''
  return text.length <= limit ? text : `${text.slice(0, limit)}\n… (${text.length} chars, truncated)`
}

function timeOf(event) {
  return typeof event?.time === 'number' ? new Date(event.time).toISOString() : '?'
}

function turnOf(event) {
  const data = event?.data
  if (data !== null && typeof data === 'object') {
    if (typeof data.turn === 'number') return data.turn
    if (typeof data.message?.turn === 'number') return data.message.turn
  }
  return undefined
}

/** Latest `session/title` event, or undefined. */
export function titleOf(events) {
  let title
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type !== 'session/title') continue
    const value = event.data?.title
    if (typeof value === 'string' && value.trim().length > 0) title = value.trim()
  }
  return title
}

/** Provider/model identity of the last assistant message, or undefined. */
export function modelOf(events) {
  let model
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type !== 'assistant/message') continue
    const source = event.data?.message?.source
    if (source !== null && typeof source === 'object') {
      model = { provider: source.provider ?? null, model: source.model ?? null }
    }
  }
  return model
}

/** Aggregate counts used by the session list and every export manifest. */
export function summarize(header, events) {
  const list = Array.isArray(events) ? events : []
  const byType = {}
  const tools = new Map()
  const toolErrors = []
  const models = new Set()
  let usageInput = 0
  let usageOutput = 0
  let userMessages = 0
  let assistantMessages = 0
  let toolsCalled = 0
  let toolsCompleted = 0
  let firstTime = null
  let lastTime = null
  for (const event of list) {
    const type = typeof event?.type === 'string' ? event.type : 'unknown'
    byType[type] = (byType[type] ?? 0) + 1
    if (typeof event?.time === 'number') {
      if (firstTime === null || event.time < firstTime) firstTime = event.time
      if (lastTime === null || event.time > lastTime) lastTime = event.time
    }
    if (type === 'user/message') userMessages += 1
    if (type === 'assistant/message') {
      assistantMessages += 1
      const source = event?.data?.message?.source
      if (typeof source?.model === 'string') models.add(source.model)
      const usage = event?.data?.usage
      if (typeof usage?.inputTokens === 'number') usageInput += usage.inputTokens
      if (typeof usage?.outputTokens === 'number') usageOutput += usage.outputTokens
    }
    if (type === 'tool/call') {
      toolsCalled += 1
      const name = typeof event?.data?.name === 'string' ? event.data.name : 'unknown'
      tools.set(name, (tools.get(name) ?? 0) + 1)
    }
    if (type === 'tool/result') {
      toolsCompleted += 1
      const error = event?.data?.error
      if (error !== undefined && error !== null) toolErrors.push({ turn: turnOf(event) ?? null, name: error.name ?? null, code: error.code ?? null, reason: error.reason ?? null })
    }
  }
  return {
    id: header?.id ?? null,
    title: titleOf(list) ?? null,
    createdAt: header?.createdAt ?? null,
    cwd: header?.cwd ?? null,
    agentPreset: header?.agentPreset ?? null,
    origin: header?.origin ?? null,
    parentSession: header?.parentSession ?? null,
    delegationDepth: header?.delegationDepth ?? null,
    formatVersion: header?.version ?? null,
    events: list.length,
    byType,
    userMessages,
    assistantMessages,
    toolsCalled,
    toolsCompleted,
    tools: Object.fromEntries(tools),
    toolErrors,
    models: [...models],
    usage: { inputTokens: usageInput, outputTokens: usageOutput },
    firstTime,
    lastTime,
    chars: list.reduce((sum, event) => sum + (typeof event?.type === 'string' ? event.type.length : 0), 0),
  }
}

/** Lossless JSON: header + stats + every event, untouched. */
export function toJson(header, events) {
  return {
    format: 'dsh-session-export',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    session: header ?? { id: null },
    stats: summarize(header, events),
    events: Array.isArray(events) ? events : [],
  }
}

/** One JSON object per line: a header record followed by every event. */
export function toJsonl(header, events) {
  const lines = [JSON.stringify({ type: '__session_header__', header: header ?? { id: null } })]
  for (const event of Array.isArray(events) ? events : []) lines.push(JSON.stringify(event))
  return `${lines.join('\n')}\n`
}

/** Compact one-line summary per event (for quick diffing/inspection). */
export function toEventList(header, events) {
  return {
    format: 'dsh-session-events',
    session: header ?? { id: null },
    events: (Array.isArray(events) ? events : []).map((event) => ({
      seq: event?.seq ?? null,
      type: event?.type ?? null,
      time: event?.time ?? null,
      summary: summarizeEvent(event),
    })),
  }
}

function summarizeEvent(event) {
  const data = event?.data
  const type = event?.type
  try {
    if (type === 'user/message') return truncate(textOfMessage(data), 160)
    if (type === 'assistant/message') return truncate(textOfMessage(data?.message), 160)
    if (type === 'tool/call') return `${data?.name ?? '?'}(${truncate(data?.arguments ?? '', 120)})`
    if (type === 'tool/result') return truncate(textOfMessage(data?.message), 160)
    if (type === 'session/title') return String(data?.title ?? '')
    return truncate(JSON.stringify(data ?? null), 160)
  } catch {
    return ''
  }
}

/** Human-readable Markdown transcript. */
export function toMarkdown(header, events, options = {}) {
  const includeSystem = options.includeSystem === true
  const includeReasoning = options.includeReasoning === true
  const includeTools = options.includeTools !== false
  const maxChars = typeof options.maxChars === 'number' && options.maxChars > 0 ? options.maxChars : 0
  const stats = summarize(header, events)
  const list = Array.isArray(events) ? events : []
  const lines = []
  lines.push(`# 会话导出：${stats.title || header?.id || '未命名会话'}`)
  lines.push('')
  lines.push('| 字段 | 值 |')
  lines.push('|---|---|')
  lines.push(`| 会话 ID | \`${header?.id ?? '?'}\` |`)
  if (stats.cwd) lines.push(`| 工作区 | \`${stats.cwd}\` |`)
  if (stats.createdAt) lines.push(`| 创建时间 | ${new Date(stats.createdAt).toISOString()} |`)
  if (stats.agentPreset) lines.push(`| Agent 预设 | ${stats.agentPreset} |`)
  if (stats.origin) lines.push(`| 来源 | ${stats.origin} |`)
  if (stats.parentSession) lines.push(`| 父会话 | \`${stats.parentSession}\` |`)
  if (stats.models.length > 0) lines.push(`| 模型 | ${stats.models.join(', ')} |`)
  lines.push(`| 事件数 | ${stats.events} |`)
  lines.push(`| 轮次 / 用户消息 / 助手消息 | ${stats.byType['turn/start'] ?? 0} / ${stats.userMessages} / ${stats.assistantMessages} |`)
  lines.push(`| 工具调用 / 结果 / 错误 | ${stats.toolsCalled} / ${stats.toolsCompleted} / ${stats.toolErrors.length} |`)
  lines.push(`| Token（输入/输出） | ${stats.usage.inputTokens} / ${stats.usage.outputTokens} |`)
  lines.push('')
  lines.push('---')
  let turn = 0
  let pendingReasoning = []
  for (const event of list) {
    const type = event?.type
    const eventTurn = turnOf(event)
    if (typeof eventTurn === 'number') turn = eventTurn
    if (type === 'turn/start') {
      lines.push('')
      lines.push(`## Turn ${eventTurn ?? turn}`)
      continue
    }
    if (type === 'user/message') {
      const text = textOfMessage(event.data)
      if (text.length === 0) continue
      lines.push('')
      lines.push(`### 👤 用户 · ${timeOf(event)}`)
      lines.push('')
      lines.push(text)
      continue
    }
    if (type === 'assistant/message') {
      const message = event.data?.message
      const text = textOfMessage(message)
      const model = message?.source?.model
      if (text.length === 0) continue
      lines.push('')
      lines.push(`### 🤖 助手${model ? ` · ${model}` : ''} · ${timeOf(event)}`)
      lines.push('')
      lines.push(text)
      continue
    }
    if (type === 'assistant/attempt') {
      if (!includeReasoning) continue
      const text = (event.data?.stream ?? []).map((record) => (record?.type === 'reasoning-chunks' ? (record.texts ?? []).join('') : '')).join('')
      if (text.length > 0) pendingReasoning.push(text)
      continue
    }
    if (type === 'tool/call') {
      if (!includeTools) continue
      const name = event.data?.name ?? '?'
      const args = event.data?.arguments ?? ''
      lines.push('')
      lines.push(`<details><summary>🛠 工具调用 · ${name} · ${timeOf(event)}</summary>`)
      lines.push('')
      lines.push('```json')
      lines.push(truncate(args, MAX_ARG_TEXT))
      lines.push('```')
      lines.push('</details>')
      continue
    }
    if (type === 'tool/result') {
      if (!includeTools) continue
      const error = event.data?.error
      const text = textOfMessage(event.data?.message)
      lines.push('')
      lines.push(`<details><summary>${error ? '❌' : '✅'} 工具结果 · ${error?.code ?? 'ok'} · ${timeOf(event)}</summary>`)
      lines.push('')
      lines.push('```text')
      lines.push(truncate(text, MAX_TOOL_TEXT))
      lines.push('```')
      if (error) lines.push(`错误：${error.name ?? ''} ${error.code ?? ''} ${truncate(error.reason ?? '', 400)}`)
      lines.push('</details>')
      continue
    }
    if (type === 'developer/message' || type === 'system/message') {
      if (!includeSystem) continue
      const message = event.data?.message
      const text = textOfMessage(message)
      if (text.length === 0) continue
      lines.push('')
      lines.push(`<details><summary>⚙️ ${type === 'system/message' ? 'system' : 'developer'} · ${timeOf(event)}</summary>`)
      lines.push('')
      lines.push(truncate(text, MAX_TOOL_TEXT))
      lines.push('</details>')
    }
  }
  if (pendingReasoning.length > 0) {
    lines.push('')
    lines.push('<details><summary>🧠 推理片段</summary>')
    lines.push('')
    lines.push(truncate(pendingReasoning.join('\n\n'), MAX_TOOL_TEXT))
    lines.push('</details>')
  }
  lines.push('')
  const body = lines.join('\n')
  return maxChars > 0 ? truncate(body, maxChars) : body
}

/** JSON Q&A pairs: one entry per user message with the following assistant text. */
export function toQa(header, events, options = {}) {
  const maxChars = typeof options.maxChars === 'number' && options.maxChars > 0 ? options.maxChars : 0
  const stats = summarize(header, events)
  const pairs = []
  let current = null
  let turn = 0
  const flush = () => {
    if (current === null) return
    pairs.push({
      turn: current.turn,
      question: current.question.trim(),
      answer: current.answers.join('\n\n').trim(),
      at: current.at,
      tools: current.tools,
      model: current.model ?? null,
    })
    current = null
  }
  for (const event of Array.isArray(events) ? events : []) {
    const type = event?.type
    const eventTurn = turnOf(event)
    if (typeof eventTurn === 'number') turn = eventTurn
    if (type === 'session/title') continue
    if (type === 'user/message') {
      flush()
      current = {
        turn,
        question: textOfMessage(event.data),
        answers: [],
        tools: [],
        at: typeof event?.time === 'number' ? new Date(event.time).toISOString() : null,
        model: null,
      }
      continue
    }
    if (current === null) continue
    if (type === 'assistant/message') {
      const text = textOfMessage(event.data?.message)
      if (text.length > 0) current.answers.push(text)
      const model = event.data?.message?.source?.model
      if (typeof model === 'string') current.model = model
      continue
    }
    if (type === 'tool/call') {
      current.tools.push({ name: event.data?.name ?? null, turn })
    }
  }
  flush()
  let list = pairs
  if (maxChars > 0) {
    const kept = []
    let size = 0
    for (const pair of pairs) {
      const cost = JSON.stringify(pair).length
      if (kept.length > 0 && size + cost > maxChars) break
      kept.push(pair)
      size += cost
    }
    list = kept
  }
  return {
    format: 'dsh-session-qa',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    session: {
      id: header?.id ?? null,
      title: stats.title,
      cwd: stats.cwd,
      createdAt: stats.createdAt,
      agentPreset: stats.agentPreset,
      models: stats.models,
    },
    stats: {
      pairs: pairs.length,
      exportedPairs: list.length,
      userMessages: stats.userMessages,
      toolsCalled: stats.toolsCalled,
    },
    pairs: list,
  }
}

function slug(value) {
  const text = typeof value === 'string' ? value : ''
  return text
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Deterministic filename from the header, title and format. */
export function filenameFor(header, title, format) {
  const created = header?.createdAt
  const stamp = typeof created === 'number' ? new Date(created).toISOString().slice(0, 19).replace(/[:T]/g, '-') : 'unknown'
  const id = typeof header?.id === 'string' ? header.id.replace(/^session-/, '').slice(0, 8) : 'session'
  const name = slug(title) || 'session'
  const ext = format === 'qa' ? 'qa.json' : format === 'md' ? 'md' : format === 'jsonl' ? 'jsonl' : format === 'events' ? 'events.json' : 'json'
  return `${stamp}-${id}-${name}.${ext}`
}

/** Format dispatcher used by routes, the bundle writer and the agent tool. */
export function exportSession(header, events, format, options = {}) {
  const chosen = FORMATS.includes(format) ? format : 'md'
  const title = titleOf(events)
  if (chosen === 'json') {
    return { format: chosen, mediaType: 'application/json; charset=utf-8', filename: filenameFor(header, title, chosen), content: JSON.stringify(toJson(header, events), null, 2) }
  }
  if (chosen === 'jsonl') {
    return { format: chosen, mediaType: 'application/x-ndjson; charset=utf-8', filename: filenameFor(header, title, chosen), content: toJsonl(header, events) }
  }
  if (chosen === 'events') {
    return { format: chosen, mediaType: 'application/json; charset=utf-8', filename: filenameFor(header, title, chosen), content: JSON.stringify(toEventList(header, events), null, 2) }
  }
  if (chosen === 'qa') {
    return { format: chosen, mediaType: 'application/json; charset=utf-8', filename: filenameFor(header, title, chosen), content: JSON.stringify(toQa(header, events, options), null, 2) }
  }
  return { format: 'md', mediaType: 'text/markdown; charset=utf-8', filename: filenameFor(header, title, 'md'), content: toMarkdown(header, events, options) }
}

export { FORMATS }
