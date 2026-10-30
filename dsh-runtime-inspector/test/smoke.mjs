/**
 * Pure-function smoke test for dsh-runtime-inspector. No running DSH required.
 *
 * Run: node dsh-runtime-inspector/test/smoke.mjs
 */
import assert from 'node:assert/strict'

import {
  constantRows,
  defaultRows,
  extractConstants,
  extractDefaults,
  matchBalanced,
  packageSummary,
  parseNumericEntries,
  sliceFunction,
  sliceObjectLiteral,
} from '../lib/inventory.js'
import { createPromptRecorder, renderAssembly } from '../lib/prompt.js'
import { buildInterceptionsReport, hookInventory } from '../lib/intercept.js'
import { buildRulesReport } from '../lib/rules.js'

// ---------------------------------------------------------------- inventory
const source = `
const SECTION_ORDERS = {
  HARNESS_IDENTITY: -1e3,
  TOOL_READ: 1100
};
const GREETING = "hello";
const LIMIT = 42;
const LIST = ["a", "b"];
export const CONFIG = { maxBytes: 1024, label: "x" };
`
const constants = extractConstants(source)
const byName = new Map(constants.map((constant) => [constant.name, constant]))
assert.equal(byName.get('GREETING').kind, 'string')
assert.equal(byName.get('LIMIT').kind, 'number')
assert.equal(byName.get('LIST').kind, 'array')
assert.equal(byName.get('LIST').count, 2)
assert.equal(byName.get('SECTION_ORDERS').kind, 'object')
assert.equal(byName.get('SECTION_ORDERS').entries.HARNESS_IDENTITY, '-1e3')
assert.equal(byName.get('CONFIG').entries.maxBytes, '1024')

const defaultsSource = `
const Config = z.object({
  maxBytes: z.number().default(DEFAULT_MAX_BYTES),
  label: z.string().default("plain"),
  flag: z.boolean().default(true)
});
const DEFAULT_MAX_BYTES = 1048576;
`
const defaults = extractDefaults(defaultsSource)
const defaultByKey = new Map(defaults.map((entry) => [entry.key, entry.value]))
assert.equal(defaultByKey.get('maxBytes'), 'DEFAULT_MAX_BYTES')
assert.equal(defaultByKey.get('label'), '"plain"')
assert.equal(defaultByKey.get('flag'), 'true')

const ordersObject = sliceObjectLiteral(source, 'SECTION_ORDERS')
assert.ok(ordersObject.startsWith('{'))
assert.deepEqual(parseNumericEntries(ordersObject), { HARNESS_IDENTITY: -1000, TOOL_READ: 1100 })
assert.equal(matchBalanced('{ a: { b: 1 } }', 0, '{', '}'), 14)
assert.ok(sliceFunction('function add(a, b) { return a + b }', 'add').includes('return a + b'))

const fakeScan = {
  packages: [{
    name: '@deepseek-ai/demo',
    version: '1.0.0',
    description: 'demo',
    constants: [{ name: 'A', kind: 'string', line: 1, value: '"a"' }],
    defaults: [{ key: 'flag', line: 2, value: 'true' }],
    bytes: 1,
  }],
}
assert.equal(constantRows(fakeScan).length, 1)
assert.equal(defaultRows(fakeScan).length, 1)
assert.equal(packageSummary(fakeScan)[0].constants, 1)

// ------------------------------------------------------------------- prompt
const rendered = renderAssembly({
  sections: [
    { name: 'a', text: 'hi {{model}}' },
    { name: 'b', text: 'raw {{model}}', interpolate: false },
    { name: 'empty', text: '' },
  ],
  contexts: [{ name: 'c', text: 'ctx {{model}}' }],
  variables: { model: 'm1' },
})
assert.equal(rendered.system, 'hi m1\n\nraw {{model}}')
assert.equal(rendered.problems.length, 0)
assert.ok(rendered.contextSnapshot.includes('ctx m1'))
assert.ok(rendered.contextSnapshot.includes('Current runtime context'))

const broken = renderAssembly({ sections: [{ name: 's', text: '{{missing}}' }], contexts: [], variables: {} })
assert.equal(broken.problems.length, 1)
assert.equal(broken.system, '{{missing}}', 'unresolved text is kept verbatim')

const recorder = createPromptRecorder()
recorder.captureAssembly({ sections: [{ name: 's', text: 'x' }], contexts: [], tools: [], variables: { model: 'm' } }, {})
assert.equal(recorder.snapshot().assemblies.length, 1)
recorder.captureActual({ system: 'SYS' })
assert.equal(recorder.snapshot().actuals[0].source, 'options.system')
recorder.captureActual({ messages: [{ role: 'system', content: [{ type: 'text', text: 'HIST' }] }] })
assert.equal(recorder.snapshot().actuals[0].source, 'history')
assert.equal(recorder.snapshot().actuals[0].chars, 4)

// ---------------------------------------------------------------- intercept
const entryFiber = { ctx: null }
const entryCtx = { fiber: entryFiber }
entryFiber.ctx = entryCtx
const childCtx = { fiber: { parent: entryCtx } }
const fakeCtx = {
  get: (key) => (key === 'loader'
    ? { entries: () => [{ options: { name: 'pkg-a', id: 'a' }, fiber: entryFiber }] }
    : undefined),
  events: {
    _hooks: {
      'tools/pre-execute': [
        { ctx: childCtx, prepend: true },
        { ctx: undefined, prepend: false },
      ],
    },
  },
}
const inventory = hookInventory(fakeCtx)
assert.equal(inventory.available, true)
assert.equal(inventory.totalEvents, 1)
assert.equal(inventory.totalListeners, 2)
assert.equal(inventory.events[0].listeners[0].package, 'pkg-a')
assert.equal(inventory.events[0].listeners[0].prepend, true)
assert.equal(inventory.events[0].listeners[1].package, null)

const fakeRecorder = {
  records: [{
    at: Date.now(),
    seam: 'tools/pre-execute',
    label: '工具执行前策略',
    group: '工具',
    mode: 'waterfall',
    ms: 0.2,
    verdict: 'intercept',
    action: 'deny',
    reason: 'test denial',
    sessionId: null,
    input: { tool: 'bash' },
    output: { decision: 'deny' },
  }],
}
const interceptReport = buildInterceptionsReport(fakeCtx, fakeRecorder, new URL('http://x/tool?verdict=intercept'))
assert.equal(interceptReport.records.total, 1)
assert.equal(interceptReport.summary.intercepted, 1)
assert.equal(interceptReport.hooks.totalListeners, 2)

// -------------------------------------------------------------------- rules
const rulesCtx = {
  get: (key) => ({
    events: { _hooks: {} },
    approval: { config: { policy: 'ask' }, overrideOf: () => 'never' },
    permissionPresets: { presets: { 'read-only': { sandbox: 'read-only', approval: 'ask' } } },
    sessions: { list: () => [{ id: 'session-1', header: { cwd: 'C:\\work', agentPreset: 'ptc' } }] },
    workingDirectory: { get: () => 'C:\\work' },
    workspaceRegistry: {
      list: () => [{ id: 'w1', title: 'demo', path: 'C:\\work', sessionIds: ['session-1'] }],
      archivedSessions: new Set(['session-2']),
    },
    tools: {
      defaultMode: 'native',
      maxParallelSubCalls: 10,
      layers: {
        global: {
          guards: { values: () => ['guard-a'] },
          restrictions: { values: () => [{ allow: new Set(['read']) }] },
          tools: { entries: () => [['read', {}]] },
        },
        scoped: new Map([['scope', { tools: { entries: () => [['write', {}]] } }]]),
      },
    },
    configEditor: {
      configuration: () => [{ entry: { options: { id: 'approval', name: 'dsh-user-approval' } }, inherited: { policy: 'ask' }, override: {} }],
    },
  }[key]),
  events: { _hooks: {} },
}
const rules = buildRulesReport(rulesCtx, { records: [] })
assert.equal(rules.approval.deploymentPolicy, 'ask')
assert.equal(rules.approval.presets['read-only'].approval, 'ask')
assert.equal(rules.approval.sessions[0].approvalOverride, 'never')
assert.equal(rules.workspace.registry[0].sessionCount, 1)
assert.ok(rules.workspace.internals.some((entry) => entry.name === 'archivedSessions' && entry.size === 1))
assert.equal(rules.interception.toolRuntime.guards.length, 1)
assert.deepEqual(rules.interception.toolRuntime.restrictions[0].allow, ['read'])
assert.equal(rules.interception.toolRuntime.scopedTools[0].count, 1)
assert.equal(rules.interception.configs.length, 1)

console.log('smoke: ok')
