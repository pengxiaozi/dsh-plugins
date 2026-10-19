import { renderManagedBlock, applyManagedBlock, normalizeServer, normalizeServerList, managedRowId } from '../lib/index.js'
import assert from 'node:assert/strict'

const servers = normalizeServerList([
  { serverName: 'yakit', transport: 'streamable-http', url: 'http://127.0.0.1:11432/mcp' },
  { serverName: 'local-tools', transport: 'stdio', command: 'path/to/yak.exe', args: ['mcp', '--transport', 'stdio'], env: { TOKEN: 'abc' } },
])
assert.equal(servers.length, 2)
assert.equal(servers[0].serverName, 'local-tools')
assert.equal(managedRowId('yakit'), 'mcp-panel-yakit')

const block = renderManagedBlock(servers)
assert.ok(block.includes('# >>> dsh-mcp-panel managed'))
assert.ok(block.includes('name: "@deepseek-ai/dsh-mcp-client"'))
assert.ok(block.includes('        args:'))
assert.ok(block.includes('          - "mcp"'))
assert.ok(block.includes('        env:'))
assert.ok(!block.includes('undefined'))

// insert into empty patch
let patch = applyManagedBlock('', block)
assert.ok(patch.startsWith('# >>> dsh-mcp-panel managed'))
// idempotent
assert.equal(applyManagedBlock(patch, block), patch)
// replace with one server
const one = renderManagedBlock(servers.filter((s) => s.serverName === 'yakit'))
let replaced = applyManagedBlock(patch, one)
assert.ok(replaced.includes('yakit'))
assert.ok(!replaced.includes('local-tools'))
// remove block
const removed = applyManagedBlock(replaced, '')
assert.ok(!removed.includes('dsh-mcp-panel managed'))
// keep surrounding content
const withOther = '[]\n# my comment\n'
const added = applyManagedBlock(withOther, block)
assert.ok(added.startsWith('[]'))
assert.ok(added.includes('# my comment'))

// validation
assert.throws(() => normalizeServer({ serverName: 'bad name' }), /serverName/)
assert.throws(() => normalizeServer({ serverName: 'x', transport: 'streamable-http', url: 'ftp://x' }), /url/)
assert.throws(() => normalizeServer({ serverName: 'x', transport: 'stdio' }), /command/)
assert.throws(() => normalizeServerList([{ serverName: 'a', transport: 'streamable-http', url: 'http://a' }, { serverName: 'a', transport: 'streamable-http', url: 'http://a' }]), /重复/)

// client bundle: fake module loader + react
const registered = {}
globalThis.window = { __ModuleLoader__: { load(def) { registered[def.id] = def } } }
const fakeReact = {
  createElement: (...a) => ({ type: a[0], props: a[1] || {}, children: a.slice(2) }),
  useState: (v) => [v, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
}
await import('../client/client.js')
assert.ok(registered['dsh-mcp-panel'], 'client bundle registered')
const exported = registered['dsh-mcp-panel'].factory((id) => {
  if (id === 'react') return fakeReact
  throw new Error('unexpected require ' + id)
})
assert.equal(exported.name, 'dsh-mcp-panel')
assert.deepEqual(exported.inject, ['slots'])
let section = null
exported.apply({
  slots: {
    inject(name, cb) { assert.equal(name, 'settings.section'); return cb() },
    register(spec) { section = spec; return () => {} },
  },
})
assert.ok(section)
assert.equal(section.name, 'settings.section')
assert.equal(section.id, 'dsh-mcp-panel')
assert.equal(section.label(), 'MCP 连接')

console.log('ALL TESTS PASSED')
