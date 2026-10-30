/**
 * Fake-ctx route test for dsh-runtime-inspector. No running DSH required.
 *
 * Exercises `apply()` end-to-end: HTTP route registration, the auth fence
 * (`ctx.connection.requestRejection`), every JSON endpoint, the path-traversal
 * guard on `source`, and the `dsh_runtime_inspect` tool contract.
 *
 * Run: node dsh-runtime-inspector/test/host-routes.mjs
 */
import assert from 'node:assert/strict'

import { apply, name as pluginName } from '../lib/index.js'

let rejectValue
const routes = []
const tools = []

const services = {
  configEditor: {
    configuration: () => [{
      entry: { id: 'include:approval', options: { id: 'approval', name: 'dsh-user-approval' } },
      inherited: { policy: 'ask' },
      override: {},
    }],
  },
  approval: { config: { policy: 'ask' }, overrideOf: () => 'never' },
  permissionPresets: { presets: { 'danger-full-access': { sandbox: 'danger-full-access', approval: 'never' } } },
  sessions: { list: () => [{ id: 'session-1', header: { cwd: 'C:\\work', agentPreset: 'ptc' } }] },
  workingDirectory: { get: () => 'C:\\work' },
  workspaceRegistry: { list: () => [{ id: 'w1', title: 'demo', path: 'C:\\work', sessionIds: ['session-1'] }] },
  events: { _hooks: {} },
  loader: { entries: () => [] },
}

const toolsService = {
  defaultMode: 'native',
  maxParallelSubCalls: 10,
  layers: { global: {}, scoped: new Map() },
  register: (definition) => {
    tools.push(definition)
    return () => {}
  },
}
services.tools = toolsService

const ctx = {
  get: (key) => services[key],
  on: () => () => {},
  effect: (fn) => {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  webServer: {
    register: (route) => {
      routes.push(route)
      return () => {}
    },
  },
  connection: { requestRejection: () => rejectValue },
  tools: toolsService,
}

apply(ctx)

assert.equal(pluginName, 'dsh-runtime-inspector')
assert.equal(routes.length, 1, 'one prefix route')
assert.equal(routes[0].kind, 'prefix')
assert.equal(routes[0].path, '/dsh-runtime-inspector')
assert.equal(tools.length, 1, 'one tool')
assert.equal(tools[0].name, 'dsh_runtime_inspect')

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(chunk) {
      this.body = chunk === undefined ? '' : String(chunk)
    },
  }
}

const handler = routes[0].handler
async function call(path, method = 'GET', rejection = undefined) {
  rejectValue = rejection
  const res = makeRes()
  await handler({ method, url: path, headers: {} }, res)
  let json = null
  try {
    json = JSON.parse(res.body)
  } catch {}
  return { status: res.statusCode, headers: res.headers, body: res.body, json }
}

// host + services probe
const health = await call('/dsh-runtime-inspector/health')
assert.equal(health.status, 200)
assert.equal(health.json.plugin.name, 'dsh-runtime-inspector')
assert.equal(health.json.services.tools, true)
assert.equal(typeof health.json.generatedAt, 'number')

// the auth fence is the whole security story: a rejection short-circuits
const denied = await call('/dsh-runtime-inspector/health', 'GET', 401)
assert.equal(denied.status, 401)
assert.equal(denied.body, 'unauthorized')
const forbidden = await call('/dsh-runtime-inspector/rules', 'GET', 403)
assert.equal(forbidden.status, 403)

// only GET/HEAD
const methodNotAllowed = await call('/dsh-runtime-inspector/health', 'POST')
assert.equal(methodNotAllowed.status, 405)
assert.equal(methodNotAllowed.headers.allow, 'GET')

// prompt report: no live systemPrompt service in this fake host, so the
// registry is reported as unavailable instead of throwing
const prompt = await call('/dsh-runtime-inspector/prompt?compact=1')
assert.equal(prompt.status, 200)
assert.ok(prompt.json.registry)
assert.equal(prompt.json.latestAssembly, null)

// loader configuration through the fake config editor
const configs = await call('/dsh-runtime-inspector/configs')
assert.equal(configs.status, 200)
assert.equal(configs.json.available, true)
assert.equal(configs.json.entries.length, 1)
assert.equal(configs.json.entries[0].id, 'include:approval')

// approval / interception / workspace rules
const rules = await call('/dsh-runtime-inspector/rules')
assert.equal(rules.status, 200)
assert.equal(rules.json.approval.deploymentPolicy, 'ask')
assert.equal(rules.json.approval.sessions[0].approvalOverride, 'never')
assert.equal(rules.json.workspace.registry[0].sessionCount, 1)
assert.equal(rules.json.interception.toolRuntime.presentation.mode, 'native')

// hook table + decision log (empty in this fake host, but well-formed)
const intercepts = await call('/dsh-runtime-inspector/intercepts')
assert.equal(intercepts.status, 200)
assert.equal(intercepts.json.hooks.available, true)
assert.ok(Array.isArray(intercepts.json.records.items))

// package scan degrades to an empty catalog when no installation is readable
const packages = await call('/dsh-runtime-inspector/packages')
assert.equal(packages.status, 200)
assert.ok(Array.isArray(packages.json.packages))

const constants = await call('/dsh-runtime-inspector/constants?kind=default&limit=2')
assert.equal(constants.status, 200)
assert.ok(Array.isArray(constants.json.items))

// source is restricted to node_modules/@deepseek-ai/<pkg>/ and rejects escapes
const traversal = await call('/dsh-runtime-inspector/source?package=@deepseek-ai/dsh-tools&path=../../evil')
assert.equal(traversal.status, 200)
assert.equal(traversal.json.found, false)
const foreignPackage = await call('/dsh-runtime-inspector/source?package=lodash&path=index.js')
assert.equal(foreignPackage.json.found, false)

const missing = await call('/dsh-runtime-inspector/unknown')
assert.equal(missing.status, 404)
assert.equal(missing.json.error, 'not-found')

// agent tool: same data, JSON text result
const toolResult = await tools[0].execute({ action: 'health' })
assert.equal(typeof toolResult.text, 'string')
const toolJson = JSON.parse(toolResult.text)
assert.equal(toolJson.plugin.name, 'dsh-runtime-inspector')
assert.deepEqual(tools[0].output.render({}, { text: 'ok' }), [{ type: 'text', text: 'ok' }])

console.log('host-routes: ok')
