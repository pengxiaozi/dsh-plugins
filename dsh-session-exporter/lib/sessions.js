/**
 * Session data access and export packaging for dsh-session-exporter.
 *
 * - listing / reading goes through `ctx.sessionPersistence` (validated,
 *   format-checked, covers cold sessions), never the raw JSONL files;
 * - saving writes plain files inside a registered workspace directory;
 * - the ZIP writer is a minimal store-only implementation (Node built-ins only,
 *   no third-party dependencies, matching the repository's no-deps rule).
 */
import { existsSync } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'

import { exportSession, summarize, titleOf, toJson, toQa, FORMATS } from './format.js'

const MAX_ZIP_BYTES = 200 * 1024 * 1024
const TITLE_SCAN_EVENTS = 200

function optional(ctx, key) {
  try {
    return ctx.get(key)
  } catch {
    return undefined
  }
}

function message(error) {
  return error instanceof Error ? error.message : String(error)
}

function normalizePath(value) {
  if (typeof value !== 'string' || value.length === 0) return ''
  return value.replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase()
}

function safeSegment(value, fallback) {
  const text = typeof value === 'string' ? value : ''
  return text.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || fallback
}

function snapshotRow(snapshot, title) {
  const header = snapshot?.header ?? {}
  return {
    id: header.id ?? null,
    title: title ?? null,
    createdAt: header.createdAt ?? null,
    cwd: header.cwd ?? null,
    agentPreset: header.agentPreset ?? null,
    origin: header.origin ?? null,
    parentSession: header.parentSession ?? null,
    delegationDepth: header.delegationDepth ?? null,
    events: typeof snapshot?.eventCount === 'number' ? snapshot.eventCount : null,
    bytes: typeof snapshot?.sizeBytes === 'number' ? snapshot.sizeBytes : null,
    formatStatus: snapshot?.formatStatus ?? null,
  }
}

/** Read the latest session title without materializing the whole log. */
async function readTitle(persistence, id) {
  let handle
  try {
    handle = await persistence.open(id, 'read')
    const result = await handle.read(0, TITLE_SCAN_EVENTS)
    return titleOf(result?.events) ?? null
  } catch {
    return null
  } finally {
    if (handle !== undefined && handle !== null && typeof handle.close === 'function') {
      try {
        await handle.close()
      } catch {}
    }
  }
}

/**
 * List every stored session, optionally restricted to one workspace path.
 * `withTitles` reads the first {@link TITLE_SCAN_EVENTS} events of each session.
 */
export async function listSessions(ctx, options = {}) {
  const persistence = optional(ctx, 'sessionPersistence')
  if (persistence === undefined || persistence === null || typeof persistence.list !== 'function') {
    return { available: false, reason: 'ctx.sessionPersistence is absent in this composition', sessions: [] }
  }
  let snapshots = []
  try {
    snapshots = await persistence.list()
  } catch (error) {
    return { available: false, reason: `sessionPersistence.list() failed: ${message(error)}`, sessions: [] }
  }
  const filterPath = typeof options.workspace === 'string' && options.workspace.length > 0 ? normalizePath(options.workspace) : ''
  let rows = (Array.isArray(snapshots) ? snapshots : []).map((snapshot) => snapshotRow(snapshot))
  if (filterPath.length > 0 && options.all !== true) rows = rows.filter((row) => normalizePath(row.cwd) === filterPath)
  rows.sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0))
  if (options.withTitles === true) {
    const limit = Math.min(rows.length, typeof options.titleLimit === 'number' ? options.titleLimit : 200)
    for (let index = 0; index < limit; index += 1) {
      if (rows[index].id === null) continue
      rows[index].title = await readTitle(persistence, rows[index].id)
    }
  }
  return { available: true, sessions: rows, total: rows.length }
}

/** Read one stored session's header and full event log. */
export async function readSession(ctx, sessionId) {
  const persistence = optional(ctx, 'sessionPersistence')
  if (persistence === undefined || persistence === null || typeof persistence.open !== 'function') {
    throw new Error('ctx.sessionPersistence is absent in this composition; cannot read session logs')
  }
  let handle
  try {
    handle = await persistence.open(sessionId, 'read')
    const result = await handle.read()
    return { header: handle.header ?? { id: sessionId }, events: Array.isArray(result?.events) ? result.events : [] }
  } finally {
    if (handle !== undefined && handle !== null && typeof handle.close === 'function') {
      try {
        await handle.close()
      } catch {}
    }
  }
}

/** Registered workspaces with their session counts. */
export function listWorkspaces(ctx) {
  const registry = optional(ctx, 'workspaceRegistry')
  const rows = []
  try {
    for (const workspace of typeof registry?.list === 'function' ? registry.list() : []) {
      rows.push({
        id: workspace?.id ?? null,
        title: workspace?.title ?? null,
        path: workspace?.path ?? null,
        sessionCount: Array.isArray(workspace?.sessionIds) ? workspace.sessionIds.length : 0,
        sessionIds: Array.isArray(workspace?.sessionIds) ? workspace.sessionIds.slice(0, 200) : [],
      })
    }
  } catch {}
  return rows
}

/** Resolve a workspace request (id or path) to the registered workspace record. */
export function resolveWorkspace(ctx, requested) {
  const rows = listWorkspaces(ctx)
  if (typeof requested !== 'string' || requested.length === 0) {
    const current = currentWorkspace(ctx, null)
    if (current === null) return { workspace: null, reason: 'workspace is required (no current session directory)' }
    const match = rows.find((row) => normalizePath(row.path) === normalizePath(current))
    return match === undefined ? { workspace: { id: null, title: null, path: current, sessionCount: 0, sessionIds: [] } } : { workspace: match }
  }
  const wanted = normalizePath(requested)
  const byId = rows.find((row) => row.id === requested)
  if (byId !== undefined) return { workspace: byId }
  const byPath = rows.find((row) => normalizePath(row.path) === wanted)
  if (byPath !== undefined) return { workspace: byPath }
  return { workspace: null, reason: `no registered workspace matches "${requested}"` }
}

/** The requesting agent's working directory, used as the default workspace. */
export function currentWorkspace(ctx, agentId) {
  try {
    if (typeof agentId === 'string') {
      const sessions = optional(ctx, 'sessions')
      const session = typeof sessions?.get === 'function' ? sessions.get(agentId) : undefined
      const cwd = session?.header?.cwd
      if (typeof cwd === 'string' && cwd.length > 0) return cwd
    }
  } catch {}
  const workingDirectory = optional(ctx, 'workingDirectory')
  const fallback = workingDirectory?.defaultDirectory
  return typeof fallback === 'string' && fallback.length > 0 ? fallback : null
}

// ------------------------------------------------------------------- ZIP
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (let index = 0; index < buffer.length; index += 1) crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear())
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f)
  const day = (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f)
  return { time, day }
}

/**
 * Minimal store-only ZIP builder. Entries are concatenated local headers +
 * payloads, then one central directory; ZIP64 is refused with an error.
 */
export function buildZip(entries) {
  const localParts = []
  const centralParts = []
  let offset = 0
  let count = 0
  const now = dosDateTime(new Date())
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8')
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data ?? ''), 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(now.time, 10)
    local.writeUInt16LE(now.day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    localParts.push(local, name, data)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(now.time, 12)
    central.writeUInt16LE(now.day, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, name)
    offset += 30 + name.length + data.length
    if (offset > MAX_ZIP_BYTES) throw new Error(`ZIP exceeds the ${MAX_ZIP_BYTES} byte in-memory limit; use the save action instead`)
    count += 1
  }
  const centralBytes = centralParts.reduce((sum, buffer) => sum + buffer.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(count, 8)
  end.writeUInt16LE(count, 10)
  end.writeUInt32LE(centralBytes, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...localParts, ...centralParts, end])
}

// ---------------------------------------------------------------- saving
/**
 * Write every requested session/format into
 * `<workspace>/dsh-session-exports/<stamp>/`, plus per-format combined files
 * and a `manifest.json`. Returns the absolute directory and relative files.
 */
export async function saveExports(ctx, options) {
  const workspacePath = options.workspacePath
  if (typeof workspacePath !== 'string' || workspacePath.length === 0 || !isAbsolute(workspacePath)) {
    throw new Error('workspacePath must be an absolute directory path')
  }
  const info = await stat(workspacePath).catch(() => null)
  if (info === null || !info.isDirectory()) throw new Error(`workspace directory does not exist: ${workspacePath}`)
  const formats = (Array.isArray(options.formats) && options.formats.length > 0 ? options.formats : ['md']).filter((format) => FORMATS.includes(format))
  if (formats.length === 0) throw new Error(`no supported format requested (${FORMATS.join(', ')})`)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const base = join(workspacePath, 'dsh-session-exports', stamp)
  let directory = base
  let suffix = 2
  while (existsSync(directory)) {
    directory = `${base}-${suffix}`
    suffix += 1
  }
  await mkdir(directory, { recursive: true })
  const written = []
  const sessions = []
  const combined = { json: [], md: [], qa: [] }
  const include = options.include ?? {}
  for (const sessionId of options.sessionIds ?? []) {
    const { header, events } = await readSession(ctx, sessionId)
    const stats = summarize(header, events)
    const files = []
    for (const format of formats) {
      const result = exportSession(header, events, format, include)
      let name = result.filename
      while (written.includes(join(directory, name))) name = name.replace(/(\.[^.]+)$/, `-${Math.random().toString(36).slice(2, 6)}$1`)
      const target = join(directory, name)
      await writeFile(target, result.content, 'utf8')
      written.push(target)
      files.push(relative(directory, target).replace(/\\/g, '/'))
      if (format === 'json') combined.json.push(toJson(header, events))
      if (format === 'md') combined.md.push(`\n\n<!-- ===== ${stats.title || header.id} ===== -->\n\n${result.content}`)
      if (format === 'qa') combined.qa.push(toQa(header, events, include))
    }
    sessions.push({
      id: header.id ?? sessionId,
      title: stats.title,
      createdAt: stats.createdAt,
      events: stats.events,
      userMessages: stats.userMessages,
      toolsCalled: stats.toolsCalled,
      files,
    })
  }
  if (formats.includes('json') && sessions.length > 1) {
    await writeFile(join(directory, 'all.json'), JSON.stringify({ exportedAt: new Date().toISOString(), sessions: combined.json }, null, 2), 'utf8')
    written.push(join(directory, 'all.json'))
  }
  if (formats.includes('md') && sessions.length > 1) {
    await writeFile(join(directory, 'all.md'), `# 工作区全部会话导出\n\n- 工作区：\`${workspacePath}\`\n- 会话数：${sessions.length}\n- 导出时间：${new Date().toISOString()}\n${combined.md.join('\n')}`, 'utf8')
    written.push(join(directory, 'all.md'))
  }
  if (formats.includes('qa') && sessions.length > 1) {
    await writeFile(join(directory, 'all.qa.json'), JSON.stringify({ exportedAt: new Date().toISOString(), sessions: combined.qa }, null, 2), 'utf8')
    written.push(join(directory, 'all.qa.json'))
  }
  const manifest = {
    format: 'dsh-session-export-manifest',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    workspace: workspacePath,
    formats,
    directory,
    sessions,
    files: [...written.map((file) => relative(directory, file).replace(/\\/g, '/')), 'manifest.json'],
  }
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  return { directory, files: manifest.files, sessions: sessions.length, workspace: workspacePath, formats }
}
