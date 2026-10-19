import { apply } from '../lib/index.js'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const tmp = join(process.env.TEMP, 'dsh-skill-panel-host-test')
rmSync(tmp, { recursive: true, force: true })
mkdirSync(join(tmp, 'profile'), { recursive: true })
mkdirSync(join(tmp, 'root', 'alpha', 'examples'), { recursive: true })
writeFileSync(join(tmp, 'root', 'alpha', 'SKILL.md'), ['---', 'name: alpha', 'description: >-', '  alpha skill', '  for host test', '---', '', '# alpha'].join('\n'))
writeFileSync(join(tmp, 'root', 'alpha', 'examples', 'x.txt'), 'x')
mkdirSync(join(tmp, 'root', 'beta'), { recursive: true })
writeFileSync(join(tmp, 'root', 'beta', 'SKILL.md'), ['---', 'name: beta', 'description: beta skill', 'disable-model-invocation: true', '---'].join('\n'))

const routes = new Map()
const ctx = {
  get(name) {
    if (name === 'profileContext') return { dir: join(tmp, 'profile') }
    if (name === 'loader') return { entries() { return [{ options: { name: '@deepseek-ai/dsh-skill-filesystem', config: { includeDefaultRoots: false, customSkillDirs: [join(tmp, 'root')] } } }] } }
    if (name === 'skills') return { async list() { return [{ name: 'embedded-demo', description: 'embedded skill', provider: 'bundle', source: 'runtime', rank: 900, invocation: { modelInvocable: true, userInvocable: false } }] } }
    return undefined
  },
  inject(_deps, cb) {
    cb({ webServer: { register(route) { routes.set(route.path, route.handler); return () => {} } } })
  },
  effect(fn) { fn() },
}
apply(ctx)
assert.ok(routes.has('/dsh-skill-panel/state'))
assert.ok(routes.has('/dsh-skill-panel/body'))
assert.ok(routes.has('/dsh-skill-panel/export'))

function fakeResponse() {
  const res = { statusCode: 0, headers: {}, chunks: [], setHeader(k, v) { this.headers[k] = v }, end(body) { if (body) this.chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body)) }, get body() { return Buffer.concat(this.chunks) } }
  return res
}

const stateRes = fakeResponse()
await routes.get('/dsh-skill-panel/state')({ url: '/dsh-skill-panel/state', method: 'GET' }, stateRes)
await new Promise((resolve) => setTimeout(resolve, 300))
assert.equal(stateRes.statusCode, 200)
const state = JSON.parse(stateRes.body.toString('utf8'))
assert.deepEqual(state.roots.map((r) => r.label), ['custom'])
const names = state.skills.map((s) => s.name)
assert.ok(names.includes('alpha') && names.includes('beta') && names.includes('embedded-demo'))
const alpha = state.skills.find((s) => s.name === 'alpha')
assert.equal(alpha.fileCount, 2)
assert.equal(alpha.invocation.modelInvocable, true)
const beta = state.skills.find((s) => s.name === 'beta')
assert.equal(beta.invocation.modelInvocable, false)
const embedded = state.skills.find((s) => s.name === 'embedded-demo')
assert.equal(embedded.exists, false)

const exportRes = fakeResponse()
await routes.get('/dsh-skill-panel/export')({ url: '/dsh-skill-panel/export?names=alpha', method: 'GET' }, exportRes)
await new Promise((resolve) => setTimeout(resolve, 300))
assert.equal(exportRes.statusCode, 200)
assert.equal(exportRes.headers['content-type'], 'application/zip')
assert.ok(exportRes.body.length > 100)
writeFileSync(join(tmp, 'alpha.zip'), exportRes.body)
console.log('HOST_ZIP=' + join(tmp, 'alpha.zip'))

const bodyRes = fakeResponse()
await routes.get('/dsh-skill-panel/body')({ on(ev, cb) { if (ev === 'end') setTimeout(() => cb(), 0) }, destroy() {} , }, bodyRes)
// body route needs a request body; simulate via a minimal stream
function fakeRequest(payload) {
  const handlers = {}
  const req = { url: '/dsh-skill-panel/body', method: 'POST', on(ev, cb) { handlers[ev] = cb; return req }, destroy() {}, _send: () => { handlers.data && handlers.data(Buffer.from(payload)); handlers.end && handlers.end() } }
  return req
}
const req = fakeRequest(JSON.stringify({ name: 'alpha' }))
const bodyRes2 = fakeResponse()
const pending = routes.get('/dsh-skill-panel/body')(req, bodyRes2)
req._send()
await pending
await new Promise((resolve) => setTimeout(resolve, 200))
assert.equal(bodyRes2.statusCode, 200)
const detail = JSON.parse(bodyRes2.body.toString('utf8'))
assert.ok(detail.skill.content.includes('# alpha'))
assert.ok(detail.files.some((f) => f.rel === 'examples/x.txt'))
console.log('ALL HOST ROUTE TESTS PASSED')
