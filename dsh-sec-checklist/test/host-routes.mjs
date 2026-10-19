import { apply } from '../lib/index.js'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const tmp = join(process.env.TEMP, 'dsh-sec-checklist-test')
process.env.DSH_HOME = join(tmp, 'dsh')
process.env.AGENTS_HOME = join(tmp, 'agents')
rmSync(tmp, { recursive: true, force: true })
mkdirSync(join(tmp, 'profile'), { recursive: true })

const routes = new Map()
const registrations = []
const fakeSkills = {
  async list() {
    return [
      { name: 'hack', description: '安全总入口', source: 'user-agents', provider: 'filesystem', invocation: { modelInvocable: true, userInvocable: true } },
      { name: 'api-sec', description: 'API 安全', source: 'user-agents', provider: 'filesystem', invocation: { modelInvocable: true, userInvocable: true } },
      { name: 'not-for-model', description: 'x', source: 'custom', provider: 'filesystem', invocation: { modelInvocable: false, userInvocable: true } },
    ]
  },
  register(skill) {
    registrations.push(skill)
    return () => {}
  },
}

const webServer = {
  register(route) {
    routes.set(route.path, route.handler)
    return () => {}
  },
}

const ctx = {
  get(name) {
    if (name === 'profileContext') return { dir: join(tmp, 'profile') }
    if (name === 'skills') return fakeSkills
    if (name === 'webServer') return webServer
    return undefined
  },
  inject(_deps, cb) {
    cb({ skills: fakeSkills, webServer })
  },
  effect(fn) { fn() },
}

apply(ctx)
assert.ok(registrations.length === 1, 'skill registered on apply')
assert.equal(registrations[0].name, 'security-checklist')
assert.equal(registrations[0].source, 'custom')
assert.ok(registrations[0].content.includes('# 安全渗透清单'))

function fakeResponse() {
  return {
    statusCode: 0,
    headers: {},
    chunks: [],
    setHeader(key, value) { this.headers[key] = value },
    end(body) { if (body !== undefined && body !== null) this.chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body)) },
    get body() { return Buffer.concat(this.chunks).toString('utf8') },
  }
}
function fakeRequest(payload) {
  const handlers = {}
  const req = {
    url: '/',
    method: 'POST',
    on(event, cb) { handlers[event] = cb; return req },
    destroy() {},
    send() { if (handlers.data) handlers.data(Buffer.from(payload)); if (handlers.end) handlers.end() },
  }
  return req
}
async function callJson(path, payload) {
  const res = fakeResponse()
  if (payload === undefined) {
    await routes.get(path)({ url: path, method: 'GET' }, res)
  } else {
    const req = fakeRequest(JSON.stringify(payload))
    const pending = routes.get(path)(req, res)
    req.send()
    await pending
  }
  return JSON.parse(res.body)
}

// state
const state = await callJson('/dsh-sec-checklist/state')
assert.equal(state.ok, true)
assert.ok(state.items === undefined)
assert.equal(state.categories.length, 6)
assert.ok(state.yakitTools.length >= 10)
assert.equal(state.skills.length, 2, 'non-model-invocable skills filtered')
assert.ok(state.stats.items >= 30)
assert.equal(state.config.credentials.length, 0)

// save config -> re-register skill, hide password
const saved = await callJson('/dsh-sec-checklist/config', {
  config: {
    enabled: true,
    project: { name: 'ACME 渗透项目', client: 'ACME', authorizedBy: '张三', authorizationNo: 'A-1', window: '10-20', notes: '' },
    scope: { targets: 'acme.example.com', excludes: 'admin.acme.example.com', environment: 'test', proxy: '127.0.0.1:8083', rules: '' },
    credentials: [{ id: 'c1', label: '后台', service: 'admin', username: 'admin', password: 'demo-pass-3', note: '' }],
    shareCredentialsWithModel: false,
    items: [{ id: 'x1', cat: 'vuln', title: '自定义项', detail: '', skill: 'api-sec', yakitTool: 'mcp__yakit__do_http_request', yakitArgs: '{}', enabled: true }],
    selectedSkills: ['hack', 'api-sec'],
  },
})
assert.equal(saved.ok, true)
assert.equal(saved.config.project.name, 'ACME 渗透项目')
assert.equal(saved.config.credentials[0].hasPassword, true)
assert.equal(saved.config.credentials[0].password, undefined)
assert.equal(registrations.length, 2, 'skill re-registered after save')
assert.ok(registrations[1].content.includes('ACME 渗透项目'))
assert.ok(!registrations[1].content.includes('demo-pass-3'), 'password not in skill body')

// preview reflects saved config
const preview = await callJson('/dsh-sec-checklist/preview')
assert.ok(preview.markdown.includes('ACME 渗透项目'))
assert.ok(preview.markdown.includes('自定义项'))
assert.ok(!preview.markdown.includes('demo-pass-3'))

// reveal password locally
const revealed = await callJson('/dsh-sec-checklist/reveal', { id: 'c1' })
assert.equal(revealed.password, 'demo-pass-3')

// doc
const doc = await callJson('/dsh-sec-checklist/doc')
assert.ok(doc.markdown.includes('# 安全渗透测试 Playbook'))
assert.ok(doc.markdown.includes('Yakit'))

// reset restores builtin items
const reset = await callJson('/dsh-sec-checklist/reset', {})
assert.ok(reset.config.items.length >= 30)
assert.ok(!reset.config.items.some((item) => item.id === 'x1'))

console.log('ALL HOST ROUTE TESTS PASSED')
console.log('PROFILE=' + join(tmp, 'profile'))
