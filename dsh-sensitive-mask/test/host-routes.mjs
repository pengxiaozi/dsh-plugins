import { apply } from '../lib/index.js'
import { mkdirSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const tmp = join(process.env.TEMP, 'dsh-sensitive-mask-host-test')
rmSync(tmp, { recursive: true, force: true })
mkdirSync(join(tmp, 'profile'), { recursive: true })

const routes = new Map()
const hooks = new Map()
const ctx = {
  get(name) {
    if (name === 'profileContext') return { dir: join(tmp, 'profile') }
    return undefined
  },
  on(name, handler) { hooks.set(name, handler); return () => {} },
  inject(_deps, cb) {
    cb({ webServer: { register(route) { routes.set(route.path, route.handler); return () => {} } } })
  },
  effect(fn) { fn() },
}
apply(ctx)

function fakeResponse() {
  const res = {
    statusCode: 0,
    headers: {},
    chunks: [],
    setHeader(k, v) { this.headers[k] = v },
    end(body) { if (body !== undefined && body !== null) this.chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body)) },
    get body() { return Buffer.concat(this.chunks).toString('utf8') },
  }
  return res
}
function fakeRequest(payload) {
  const handlers = {}
  const req = {
    url: '/',
    method: 'POST',
    on(ev, cb) { handlers[ev] = cb; return req },
    destroy() {},
    send() { handlers.data && handlers.data(Buffer.from(payload)); handlers.end && handlers.end() },
  }
  return req
}

// 1) user input masking hook
const userMsg = { role: 'user', id: 'm1', source: { kind: 'user' }, content: [{ type: 'text', text: '电话 13800138000' }] }
const preStep = hooks.get('agent/pre-step')
assert.ok(preStep, 'pre-step hook registered')
const decision = await preStep({ messages: [userMsg], turn: 1, step: 1 }, async () => ({ kind: 'enter', messages: [userMsg] }))
assert.equal(decision.kind, 'enter')
assert.ok(decision.messages[0].content[0].text.includes('[[手机号#1]]'))
assert.ok(!decision.messages[0].content[0].text.includes('13800138000'))

// 2) tool result masking hook + log file details
const postExecute = hooks.get('tools/post-execute')
assert.ok(postExecute, 'post-execute hook registered')
const exec = { name: 'read', arguments: { file_path: 'D:/project/data.txt' }, agent: { session: { id: 'sess-1' } } }
const toolResult = { content: [{ type: 'text', text: '客户手机 13900139000' }] }
const maskedDecision = await postExecute(exec, toolResult, async () => ({ kind: 'accept' }))
assert.equal(maskedDecision.kind, 'accept')
assert.ok(maskedDecision.content[0].text.includes('[[手机号#2]]'))

// 3) tool-arg demask happens at execution time (tools/pre-execute)
const preExecute = hooks.get('tools/pre-execute')
assert.ok(preExecute, 'tools/pre-execute hook registered')
const execWithPlaceholder = { name: 'pwsh', arguments: { command: 'Write-Output "[[手机号#1]]"' } }
const preDecision = await preExecute(execWithPlaceholder, async () => ({ kind: 'allow' }))
assert.equal(preDecision.kind, 'allow')
assert.ok(!execWithPlaceholder.arguments.command.includes('[['), 'placeholder must be restored before tool execution')
assert.match(execWithPlaceholder.arguments.command, /\d{11}/)
const frozenExec = Object.freeze({ name: 'pwsh', arguments: Object.freeze({ command: '[[手机号#1]]' }) })
const frozenDecision = await preExecute(frozenExec, async () => ({ kind: 'allow' }))
assert.equal(frozenDecision.kind, 'allow')

// 4) settings routes
const stateRes = fakeResponse()
routes.get('/dsh-sensitive-mask/state')({ url: '/dsh-sensitive-mask/state', method: 'GET' }, stateRes)
const state = JSON.parse(stateRes.body)
assert.equal(stateRes.statusCode, 200)
assert.equal(state.config.enabled, true)
assert.ok(state.config.rules.length >= 4)
assert.ok(state.logFiles.length >= 1, 'log file should exist')
assert.ok(state.todayCount >= 2)

const testRes = fakeResponse()
const testReq = fakeRequest(JSON.stringify({ text: '身份证 110101199001011234' }))
routes.get('/dsh-sensitive-mask/test')(testReq, testRes)
testReq.send()
await new Promise((resolve) => setTimeout(resolve, 200))
const tested = JSON.parse(testRes.body)
assert.ok(tested.output.includes('[[证件号#'))
assert.equal(tested.hits.length, 1)

const logFile = state.logFiles[0].name
const logRes = fakeResponse()
routes.get('/dsh-sensitive-mask/log')({ url: '/dsh-sensitive-mask/log?file=' + encodeURIComponent(logFile) + '&limit=50', method: 'GET' }, logRes)
const logBody = JSON.parse(logRes.body)
assert.ok(logBody.entries.length >= 2)
const toolEntry = logBody.entries.find((entry) => entry.dir === 'tool-result')
assert.equal(toolEntry.tool, 'read')
assert.equal(toolEntry.file, 'D:/project/data.txt')
assert.ok(toolEntry.placeholder.includes('手机号'))

// 5) config route disabling
const configRes = fakeResponse()
const configReq = fakeRequest(JSON.stringify({ config: { enabled: false, rules: [] } }))
routes.get('/dsh-sensitive-mask/config')(configReq, configRes)
configReq.send()
await new Promise((resolve) => setTimeout(resolve, 200))
const saved = JSON.parse(configRes.body)
assert.equal(saved.config.enabled, false)
const stateRes2 = fakeResponse()
routes.get('/dsh-sensitive-mask/state')({ url: '/dsh-sensitive-mask/state', method: 'GET' }, stateRes2)
assert.equal(JSON.parse(stateRes2.body).config.enabled, false)

// 6) disabled config must not mask
const decision2 = await preStep({ messages: [userMsg], turn: 2, step: 1 }, async () => ({ kind: 'enter', messages: [userMsg] }))
assert.equal(decision2.messages[0].content[0].text, '电话 13800138000')

console.log('ALL HOST ROUTE TESTS PASSED')
console.log('LOG_DIR=' + join(tmp, 'profile', 'sensitive-mask', 'logs'))
