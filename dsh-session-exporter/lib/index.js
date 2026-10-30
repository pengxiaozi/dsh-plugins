/**
 * Host half of dsh-session-exporter.
 *
 * Data source: `ctx.sessionPersistence` (the validated, lossless session log),
 * not the raw JSONL directory — so cold sessions, format checks and migration
 * markers behave exactly like the rest of the Harness.
 *
 * Routes under /dsh-session-exporter are same-origin JSON/download endpoints
 * behind `ctx.connection.requestRejection`; the same capabilities are exposed
 * to the agent as the `dsh_session_export` tool (list / export / save).
 */
import { buildZip, currentWorkspace, listSessions, listWorkspaces, readSession, resolveWorkspace, saveExports } from './sessions.js'
import { exportSession, summarize, FORMATS } from './format.js'

export const name = 'dsh-session-exporter'
export const inject = ['webServer', 'connection', 'tools']

const BASE_PATH = '/dsh-session-exporter'
const PLUGIN_VERSION = '0.1.0'
const MAX_BODY_BYTES = 1024 * 1024
const MAX_TOOL_TEXT = 50000
const MAX_ZIP_SOURCE_BYTES = 150 * 1024 * 1024
const DEFAULT_FORMATS = ['md', 'json']

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

function safeStringify(value) {
  const seen = new WeakSet()
  return JSON.stringify(value, (_key, entry) => {
    if (typeof entry === 'bigint') return String(entry)
    if (typeof entry === 'function') return '[function]'
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
  res.end(safeStringify(payload))
}

function sendDownload(res, filename, mediaType, data) {
  res.statusCode = 200
  res.setHeader('content-type', mediaType)
  res.setHeader('cache-control', 'no-store')
  res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
  res.end(data)
}

function clamped(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

function boolParam(url, name, fallback) {
  const value = url.searchParams.get(name)
  if (value === null) return fallback
  return value === '1' || value === 'true' || value === 'yes'
}

function formatsOf(value, fallback) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const chosen = list.map((entry) => String(entry).trim()).filter((entry) => FORMATS.includes(entry))
  return chosen.length > 0 ? chosen : fallback
}

async function readBoundedBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.byteLength
    if (size > MAX_BODY_BYTES) {
      req.resume()
      return null
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size).toString('utf8')
}

function includeOf(url) {
  return {
    includeSystem: boolParam(url, 'includeSystem', false),
    includeReasoning: boolParam(url, 'includeReasoning', false),
    includeTools: boolParam(url, 'includeTools', true),
    maxChars: clamped(url.searchParams.get('maxChars'), 0, 0, 5000000),
  }
}

async function workspacesPayload(ctx) {
  return {
    generatedAt: Date.now(),
    current: currentWorkspace(ctx, null),
    workspaces: listWorkspaces(ctx),
    formats: FORMATS,
    capabilities: {
      persistence: optional(ctx, 'sessionPersistence') !== undefined,
      workspaceRegistry: optional(ctx, 'workspaceRegistry') !== undefined,
      sessions: optional(ctx, 'sessions') !== undefined,
    },
  }
}

async function sessionsPayload(ctx, url) {
  const requested = url.searchParams.get('workspace') ?? ''
  const all = boolParam(url, 'all', false)
  let workspacePath = requested
  if (!all) {
    if (workspacePath.length === 0) workspacePath = currentWorkspace(ctx, null) ?? ''
    if (workspacePath.length > 0) {
      const resolved = resolveWorkspace(ctx, workspacePath)
      workspacePath = resolved.workspace?.path ?? workspacePath
    }
  }
  const result = await listSessions(ctx, {
    workspace: workspacePath,
    all,
    withTitles: boolParam(url, 'titles', true),
    titleLimit: clamped(url.searchParams.get('titleLimit'), 200, 0, 400),
  })
  return { ...result, workspace: workspacePath, all }
}

async function exportPayload(ctx, url) {
  const sessionId = url.searchParams.get('session') ?? ''
  if (sessionId.length === 0) return { error: 'session is required' }
  const format = url.searchParams.get('format') ?? 'md'
  const { header, events } = await readSession(ctx, sessionId)
  const result = exportSession(header, events, format, includeOf(url))
  return {
    ...result,
    stats: summarize(header, events),
  }
}

async function exportAllZip(ctx, url) {
  const requested = url.searchParams.get('workspace') ?? ''
  const list = await sessionsPayload(ctx, url)
  if (list.available === false) throw new Error(list.reason ?? 'session listing unavailable')
  if (!Array.isArray(list.sessions) || list.sessions.length === 0) throw new Error('no sessions in this workspace')
  const projected = list.sessions.reduce((sum, row) => sum + (typeof row.bytes === 'number' ? row.bytes : 0), 0)
  if (projected > MAX_ZIP_SOURCE_BYTES) {
    throw new Error(`workspace logs are ~${Math.round(projected / 1048576)} MiB, above the ${Math.round(MAX_ZIP_SOURCE_BYTES / 1048576)} MiB in-memory ZIP limit; use the save action to write files into the workspace instead`)
  }
  const formats = formatsOf(url.searchParams.get('formats'), DEFAULT_FORMATS)
  const include = includeOf(url)
  const entries = []
  const manifest = { format: 'dsh-session-export-manifest', formatVersion: 1, exportedAt: new Date().toISOString(), workspace: list.workspace ?? null, formats, sessions: [] }
  const usedNames = new Set()
  const combined = { json: [], md: [], qa: [] }
  for (const row of list.sessions) {
    if (typeof row.id !== 'string') continue
    const { header, events } = await readSession(ctx, row.id)
    const stats = summarize(header, events)
    const files = []
    for (const format of formats) {
      const result = exportSession(header, events, format, include)
      let name = result.filename
      let suffix = 2
      while (usedNames.has(name)) {
        name = result.filename.replace(/(\.[^.]+)$/, `-${suffix}$1`)
        suffix += 1
      }
      usedNames.add(name)
      entries.push({ name, data: result.content })
      files.push(name)
      if (format === 'json') combined.json.push({ session: { id: header.id, title: stats.title }, events })
      if (format === 'md') combined.md.push(`\n\n<!-- ===== ${stats.title || header.id} ===== -->\n\n${result.content}`)
      if (format === 'qa') combined.qa.push({ session: { id: header.id, title: stats.title } })
    }
    manifest.sessions.push({ id: header.id ?? row.id, title: stats.title, createdAt: stats.createdAt, events: stats.events, files })
  }
  if (formats.includes('json')) entries.push({ name: 'all.json', data: JSON.stringify({ exportedAt: manifest.exportedAt, sessions: combined.json }, null, 2) })
  if (formats.includes('md')) entries.push({ name: 'all.md', data: `# 工作区全部会话导出\n\n- 工作区：\`${list.workspace ?? ''}\`\n- 会话数：${manifest.sessions.length}\n- 导出时间：${manifest.exportedAt}\n${combined.md.join('\n')}` })
  entries.push({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) })
  const zip = buildZip(entries)
  return { name: `dsh-sessions-${new Date().toISOString().slice(0, 10)}.zip`, mediaType: 'application/zip', data: zip, count: manifest.sessions.length }
}

async function savePayload(ctx, body) {
  const requested = typeof body?.workspace === 'string' ? body.workspace : ''
  const resolved = resolveWorkspace(ctx, requested)
  if (resolved.workspace === null) throw new Error(resolved.reason)
  const workspacePath = resolved.workspace.path
  const formats = formatsOf(body?.formats, DEFAULT_FORMATS)
  const wanted = body?.sessions
  let sessionIds
  if (wanted === 'all' || wanted === undefined || wanted === null) {
    const listed = await listSessions(ctx, { workspace: workspacePath, withTitles: false })
    sessionIds = (listed.sessions ?? []).map((row) => row.id).filter((id) => typeof id === 'string')
  } else if (Array.isArray(wanted)) {
    sessionIds = wanted.filter((id) => typeof id === 'string')
  } else if (typeof wanted === 'string' && wanted.includes(',')) {
    sessionIds = wanted.split(',').map((id) => id.trim()).filter((id) => id.length > 0)
  } else {
    sessionIds = [String(wanted)]
  }
  if (sessionIds.length === 0) throw new Error('no sessions selected')
  const include = {
    includeSystem: body?.includeSystem === true,
    includeReasoning: body?.includeReasoning === true,
    includeTools: body?.includeTools !== false,
  }
  const saved = await saveExports(ctx, { workspacePath, sessionIds, formats, include })
  return { ...saved, workspaceTitle: resolved.workspace.title ?? null }
}

async function healthPayload(ctx) {
  return {
    plugin: { name, version: PLUGIN_VERSION },
    process: { node: process.version, platform: process.platform, pid: process.pid },
    services: {
      webServer: optional(ctx, 'webServer') !== undefined,
      connection: optional(ctx, 'connection') !== undefined,
      tools: optional(ctx, 'tools') !== undefined,
      sessionPersistence: optional(ctx, 'sessionPersistence') !== undefined,
      workspaceRegistry: optional(ctx, 'workspaceRegistry') !== undefined,
      sessions: optional(ctx, 'sessions') !== undefined,
      workingDirectory: optional(ctx, 'workingDirectory') !== undefined,
      sessionTitle: optional(ctx, 'sessionTitle') !== undefined,
    },
    formats: FORMATS,
    routes: [`${BASE_PATH}/health`, `${BASE_PATH}/workspaces`, `${BASE_PATH}/sessions`, `${BASE_PATH}/export`, `${BASE_PATH}/export-all`, `${BASE_PATH}/save`],
    tool: 'dsh_session_export',
    generatedAt: Date.now(),
  }
}

async function toolText(ctx, exec, args) {
  const action = typeof args?.action === 'string' ? args.action : 'list'
  const url = new URL(`${BASE_PATH}/tool`, 'http://localhost')
  for (const name of ['workspace', 'session', 'format', 'formats']) {
    if (typeof args?.[name] === 'string') url.searchParams.set(name, args[name])
  }
  if (args?.all === true) url.searchParams.set('all', '1')
  if (args?.titles === true) url.searchParams.set('titles', '1')
  if (args?.includeSystem === true) url.searchParams.set('includeSystem', '1')
  if (args?.includeReasoning === true) url.searchParams.set('includeReasoning', '1')
  if (args?.includeTools === false) url.searchParams.set('includeTools', '0')
  if (args?.maxChars !== undefined) url.searchParams.set('maxChars', String(args.maxChars))
  const workspacePath = args?.workspace ?? currentWorkspace(ctx, exec?.agent?.id) ?? ''
  if (args?.workspace === undefined && workspacePath !== '') url.searchParams.set('workspace', workspacePath)
  let payload
  if (action === 'list') payload = await sessionsPayload(ctx, url)
  else if (action === 'workspaces') payload = await workspacesPayload(ctx)
  else if (action === 'export') payload = await exportPayload(ctx, url)
  else if (action === 'save') {
    payload = await savePayload(ctx, {
      workspace: args?.workspace,
      sessions: args?.sessions,
      formats: args?.formats,
      includeSystem: args?.includeSystem === true,
      includeReasoning: args?.includeReasoning === true,
      includeTools: args?.includeTools !== false,
    })
  } else if (action === 'stats') payload = await sessionsPayload(ctx, url)
  else if (action === 'health') payload = await healthPayload(ctx)
  else payload = { error: `unknown action "${action}"`, actions: ['list', 'workspaces', 'export', 'save', 'stats', 'health'] }
  const text = safeStringify(payload)
  return text.length > MAX_TOOL_TEXT ? `${text.slice(0, MAX_TOOL_TEXT)}\n… (${text.length} chars, truncated; narrow the workspace, export one session, or use action=save to write full files into the workspace)` : text
}

export function apply(ctx) {
  const handleRequest = async (req, res) => {
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
    const method = req.method ?? 'GET'
    try {
      if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
        res.statusCode = 405
        res.setHeader('allow', 'GET, POST')
        res.end()
        return
      }
      if (path === `${BASE_PATH}/health`) return sendJson(res, 200, await healthPayload(ctx))
      if (path === `${BASE_PATH}/workspaces`) return sendJson(res, 200, await workspacesPayload(ctx))
      if (path === `${BASE_PATH}/sessions`) return sendJson(res, 200, await sessionsPayload(ctx, url))
      if (path === `${BASE_PATH}/export`) {
        const payload = await exportPayload(ctx, url)
        if (payload.error !== undefined) return sendJson(res, 400, payload)
        if (boolParam(url, 'download', true)) return sendDownload(res, payload.filename, payload.mediaType, payload.content)
        return sendJson(res, 200, payload)
      }
      if (path === `${BASE_PATH}/export-all`) {
        const zip = await exportAllZip(ctx, url)
        return sendDownload(res, zip.name, zip.mediaType, zip.data)
      }
      if (path === `${BASE_PATH}/save` && method === 'POST') {
        const text = await readBoundedBody(req)
        if (text === null) return sendJson(res, 413, { error: 'request body too large' })
        let body = {}
        try {
          body = text.length === 0 ? {} : JSON.parse(text)
        } catch {
          return sendJson(res, 400, { error: 'request body must be JSON' })
        }
        try {
          return sendJson(res, 200, await savePayload(ctx, body))
        } catch (error) {
          return sendJson(res, 400, { error: message(error) })
        }
      }
      return sendJson(res, 404, { error: 'not-found', path, routes: ['health', 'workspaces', 'sessions', 'export', 'export-all', 'save'] })
    } catch (error) {
      return sendJson(res, 500, { error: 'internal-error', message: message(error) })
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: BASE_PATH, handler: handleRequest }), 'dsh-session-exporter: http routes')

  ctx.effect(() => ctx.tools.register({
    name: 'dsh_session_export',
    description: 'Export DeepSeek Harness session records (the lossless event log) for the current workspace or one session. Use action=workspaces for the workspace catalog, action=list for sessions (optionally titles), action=export to read one session as md/json/jsonl/qa/json-events (the content can then be distilled by you into a Markdown document), action=save to write selected sessions or the whole workspace into <workspace>/dsh-session-exports/<timestamp>/ (md/json/qa/jsonl plus all.md, all.json, manifest.json). Data comes from ctx.sessionPersistence, so cold sessions and subagent sessions are included.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['workspaces', 'list', 'export', 'save', 'stats', 'health'], description: 'Which export operation to run.' },
        workspace: { type: 'string', description: 'Registered workspace id, title or absolute path; defaults to this session working directory.' },
        all: { type: 'boolean', description: 'For action=list: list every stored session instead of one workspace.' },
        titles: { type: 'boolean', description: 'For action=list: read session titles from their logs (default true).' },
        session: { type: 'string', description: 'For action=export: exact session id.' },
        format: { type: 'string', enum: FORMATS, description: 'For action=export: md (default), json (lossless), jsonl, qa (Q&A pairs), events (compact index).' },
        formats: { type: 'string', description: 'For action=save: comma-separated formats, e.g. "md,json,qa".' },
        sessions: { type: 'string', description: 'For action=save: "all" or a comma-separated list of session ids (omit = all sessions of the workspace).' },
        includeSystem: { type: 'boolean', description: 'Include system/developer prompt messages in md (default false).' },
        includeReasoning: { type: 'boolean', description: 'Include reasoning fragments in md (default false).' },
        includeTools: { type: 'boolean', description: 'Include tool calls/results in md (default true).' },
        maxChars: { type: 'number', description: 'For action=export: cap the returned content length.' },
      },
      required: ['action'],
    },
    output: {
      schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
      render(_args, value) {
        const text = value !== null && typeof value === 'object' && typeof value.text === 'string' ? value.text : safeStringify(value)
        return [{ type: 'text', text }]
      },
    },
    async execute(args, exec) {
      return { text: await toolText(ctx, exec, args) }
    },
  }), 'dsh-session-exporter: agent tool')
}
