/**
 * Fake-ctx route tests for dsh-session-exporter. No running DSH required.
 *
 * Covers: apply() wiring, auth fence, workspace/session listing, single-session
 * export (inline + download), workspace ZIP, save-to-workspace, and the agent
 * tool contract. A real temporary directory stands in for the workspace.
 *
 * Run: node dsh-session-exporter/test/host-routes.mjs
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { apply, name as pluginName } from '../lib/index.js'

const baseTime = Date.UTC(2026, 0, 2, 3, 4, 5)
const events = [
  { type: 'turn/start', seq: 0, time: baseTime, data: { turn: 1 } },
  { type: 'user/message', seq: 1, time: baseTime + 1, data: { id: 'm1', role: 'user', content: [{ type: 'text', text: '第一个问题' }] } },
  { type: 'assistant/message', seq: 2, time: baseTime + 2, data: { turn: 1, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: '第一个回答' }], source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' } }, stream: [] } },
  { type: 'tool/call', seq: 3, time: baseTime + 3, data: { turn: 1, step: 1, callId: 'c1', name: 'read', arguments: '{"file_path":"a.txt"}' } },
  { type: 'tool/result', seq: 4, time: baseTime + 4, data: { turn: 1, step: 1, message: { role: 'tool', content: [{ type: 'text', text: 'body' }], source: { kind: 'tool', callId: 'c1' } } } },
  { type: 'session/title', seq: 5, time: baseTime + 5, data: { title: '演示会话', messageSeqs: [1], source: { kind: 'user' } } },
]
const header = { version: 5, id: 'session-1234abcd-0000-0000-0000-000000000000', createdAt: baseTime, cwd: '', isSeeded: false, agentPreset: 'ptc' }

const workspaceDir = await mkdtemp(join(tmpdir(), 'dsh-session-exporter-'))
header.cwd = workspaceDir
const logs = new Map([[header.id, { header, events }]])

const persistence = {
  async list() {
    return [...logs.values()].map((log) => ({ header: log.header, formatStatus: 'current', revision: 'rev', eventCount: log.events.length, sizeBytes: 4096 }))
  },
  async open(id) {
    const log = logs.get(id)
    if (log === undefined) throw new Error(`unknown session ${id}`)
    return {
      header: log.header,
      async read(offset = 0, length) {
        return { events: length === undefined ? log.events : log.events.slice(offset, offset + length) }
      },
      async close() {},
    }
  },
}

let rejectValue
const routes = []
const tools = []
const toolsService = {
  register(definition) {
    tools.push(definition)
    return () => {}
  },
}
const services = {
  sessionPersistence: persistence,
  workspaceRegistry: { list: () => [{ id: 'w1', title: 'demo', path: workspaceDir, sessionIds: [header.id] }] },
  sessions: { get: () => ({ header }) },
  workingDirectory: { defaultDirectory: workspaceDir },
  tools: toolsService,
}
const ctx = {
  get: (key) => services[key],
  effect: (fn) => {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  webServer: { register: (route) => { routes.push(route); return () => {} } },
  connection: { requestRejection: () => rejectValue },
  tools: toolsService,
}

apply(ctx)
assert.equal(pluginName, 'dsh-session-exporter')
assert.equal(routes.length, 1)
assert.equal(routes[0].path, '/dsh-session-exporter')
assert.equal(tools.length, 1)
assert.equal(tools[0].name, 'dsh_session_export')

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    raw: null,
    body: '',
    setHeader(name, value) { this.headers[name] = value },
    end(chunk) {
      if (chunk === undefined) { this.body = ''; this.raw = Buffer.alloc(0); return }
      this.raw = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8')
      this.body = this.raw.toString('utf8')
    },
  }
}

const handler = routes[0].handler
async function call(path, method = 'GET', rejection = undefined, body = undefined) {
  rejectValue = rejection
  const res = makeRes()
  const req = {
    method,
    url: path,
    headers: {},
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body), 'utf8')
    },
  }
  await handler(req, res)
  let json = null
  try { json = JSON.parse(res.body) } catch {}
  return { status: res.statusCode, headers: res.headers, body: res.body, raw: res.raw, json }
}

// ---------------------------------------------------------------- auth fence
assert.equal((await call('/dsh-session-exporter/health', 'GET', 401)).status, 401)
assert.equal((await call('/dsh-session-exporter/health', 'GET', 403)).status, 403)

const health = await call('/dsh-session-exporter/health')
assert.equal(health.status, 200)
assert.equal(health.json.plugin.name, 'dsh-session-exporter')
assert.equal(health.json.services.sessionPersistence, true)

// -------------------------------------------------------------- workspaces
const workspaces = await call('/dsh-session-exporter/workspaces')
assert.equal(workspaces.status, 200)
assert.equal(workspaces.json.workspaces.length, 1)
assert.deepEqual(workspaces.json.formats, ['json', 'jsonl', 'md', 'qa', 'events'])

// ----------------------------------------------------------------- sessions
const sessions = await call(`/dsh-session-exporter/sessions?workspace=${encodeURIComponent(workspaceDir)}&titles=1`)
assert.equal(sessions.status, 200)
assert.equal(sessions.json.sessions.length, 1)
assert.equal(sessions.json.sessions[0].title, '演示会话')
assert.equal(sessions.json.sessions[0].events, events.length)

// ------------------------------------------------------------------- export
const inline = await call(`/dsh-session-exporter/export?session=${header.id}&format=md&download=0`)
assert.equal(inline.status, 200)
assert.ok(inline.json.content.includes('第一个问题'))
assert.ok(inline.json.content.includes('第一个回答'))
assert.equal(inline.json.defaultFilename === undefined, true)
assert.ok(inline.json.filename.endsWith('.md'))

const download = await call(`/dsh-session-exporter/export?session=${header.id}&format=json&download=1`)
assert.equal(download.status, 200)
assert.ok(download.headers['content-type'].includes('application/json'))
assert.ok(download.headers['content-disposition'].includes('attachment'))
assert.ok(download.json.session.id === header.id)

const qa = await call(`/dsh-session-exporter/export?session=${header.id}&format=qa&download=0`)
const qaBody = JSON.parse(qa.json.content)
assert.equal(qaBody.pairs.length, 1)
assert.equal(qaBody.pairs[0].question, '第一个问题')

const unknownSession = await call('/dsh-session-exporter/export?session=missing&format=md&download=0')
assert.equal(unknownSession.status, 500)

// ---------------------------------------------------------------------- zip
const zip = await call(`/dsh-session-exporter/export-all?workspace=${encodeURIComponent(workspaceDir)}&formats=md,json`)
assert.equal(zip.status, 200)
assert.equal(zip.headers['content-type'], 'application/zip')
assert.equal(zip.raw.subarray(0, 4).toString('hex'), '504b0304')
assert.ok(zip.raw.includes(Buffer.from('manifest.json')))
assert.ok(zip.raw.includes(Buffer.from('all.md')))
assert.ok(zip.raw.includes(Buffer.from('all.json')))

// --------------------------------------------------------------------- save
const saved = await call('/dsh-session-exporter/save', 'POST', undefined, {
  workspace: workspaceDir,
  sessions: [header.id],
  formats: ['md', 'json', 'qa'],
})
assert.equal(saved.status, 200, saved.body)
assert.ok(existsSync(saved.json.directory))
assert.equal(saved.json.sessions, 1)
assert.ok(saved.json.files.includes('manifest.json'))
const manifestText = await readFile(join(saved.json.directory, 'manifest.json'), 'utf8')
const manifest = JSON.parse(manifestText)
assert.equal(manifest.sessions[0].id, header.id)
assert.equal(manifest.formats.join(','), 'md,json,qa')

const savedAll = await call('/dsh-session-exporter/save', 'POST', undefined, { workspace: workspaceDir, formats: ['md'] })
assert.equal(savedAll.status, 200)
assert.equal(savedAll.json.sessions, 1)
assert.ok(savedAll.json.files.includes('manifest.json'))

const badWorkspace = await call('/dsh-session-exporter/save', 'POST', undefined, { workspace: 'D:\\definitely-not-registered', formats: ['md'] })
assert.equal(badWorkspace.status, 400)
assert.ok(String(badWorkspace.json.error).includes('no registered workspace'))

const missing = await call('/dsh-session-exporter/nope')
assert.equal(missing.status, 404)

// ---------------------------------------------------------------- agent tool
const listResult = await tools[0].execute({ action: 'list', workspace: workspaceDir }, { agent: { id: 'live-1' } })
const listJson = JSON.parse(listResult.text)
assert.equal(listJson.sessions.length, 1)
const exportResult = await tools[0].execute({ action: 'export', session: header.id, format: 'qa' }, {})
assert.ok(exportResult.text.includes('第一个问题'))
assert.deepEqual(tools[0].output.render({}, { text: 'ok' }), [{ type: 'text', text: 'ok' }])

await rm(workspaceDir, { recursive: true, force: true })
console.log('host-routes: ok')
