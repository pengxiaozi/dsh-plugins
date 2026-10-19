import { zipArchive, collectSkillFiles, parseFrontmatter, discoverLocalSkills } from '../lib/index.js'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const tmp = join(process.env.TEMP, 'dsh-skill-panel-test')
rmSync(tmp, { recursive: true, force: true })
mkdirSync(join(tmp, 'demo-skill', 'examples'), { recursive: true })
const skillMd = ['---', 'name: demo-skill', 'description: demo skill for tests', '---', '', '# demo', ''].join('\n')
writeFileSync(join(tmp, 'demo-skill', 'SKILL.md'), skillMd)
writeFileSync(join(tmp, 'demo-skill', 'examples', 'a.txt'), 'hello a')
writeFileSync(join(tmp, 'demo-skill', 'README.md'), 'readme')
writeFileSync(join(tmp, 'demo-skill', '.gitignore'), 'ignored?', { flag: 'w' })

const info = collectSkillFiles(join(tmp, 'demo-skill', 'SKILL.md'))
assert.ok(info)
assert.equal(info.isBundle, true)
assert.ok(info.files.some((f) => f.rel === 'SKILL.md'))
assert.ok(info.files.some((f) => f.rel === 'examples/a.txt'))
assert.ok(info.files.some((f) => f.rel === '.gitignore'))
assert.ok(info.bytes > 0)

// flat skill file
writeFileSync(join(tmp, 'flat-skill.md'), '---\nname: flat-skill\ndescription: flat\n---\nbody')
const flat = collectSkillFiles(join(tmp, 'flat-skill.md'))
assert.ok(flat)
assert.equal(flat.isBundle, false)
assert.equal(flat.files.length, 1)

const zip = zipArchive([
  { name: 'demo-skill/SKILL.md', data: Buffer.from(skillMd) },
  { name: 'demo-skill/examples/a.txt', data: Buffer.from('hello a') },
  { name: '_manifest.json', data: Buffer.from('{"skills":1}') },
])
assert.ok(zip.length > 100)
assert.equal(zip.readUInt32LE(0), 0x04034b50)
writeFileSync(join(tmp, 'out.zip'), zip)
console.log('ZIP_PATH=' + join(tmp, 'out.zip'))

// client bundle contract
const registered = {}
globalThis.window = { __ModuleLoader__: { load(def) { registered[def.id] = def } } }
globalThis.document = { head: { appendChild() {} }, createElement() { return { setAttribute() {}, textContent: '' } }, body: { appendChild() {}, removeChild() {} } }
const fakeReact = {
  createElement: (...a) => ({ type: a[0], props: a[1] || {} }),
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
}
await import('../client/client.js')
assert.ok(registered['dsh-skill-panel'])
const exported = registered['dsh-skill-panel'].factory((id) => {
  if (id === 'react') return fakeReact
  throw new Error('unexpected require ' + id)
})
assert.equal(exported.name, 'dsh-skill-panel')
assert.deepEqual(exported.inject, ['slots'])
let section = null
exported.apply({ slots: { inject(_n, cb) { return cb() }, register(spec) { section = spec; return () => {} } } })
assert.ok(section)
assert.equal(section.name, 'settings.section')
assert.equal(section.id, 'dsh-skill-panel')
assert.equal(section.label(), 'Skills')
// frontmatter parser: folded block + quoted + flags
const fmText = ['---', 'name: demo-folded', 'description: >-', '  line one', '  line two', 'disable-model-invocation: true', 'user-invocable: "no"', '---', 'body'].join('\n')
const fm = parseFrontmatter(fmText)
assert.equal(fm.name, 'demo-folded')
assert.equal(fm.description, 'line one line two')
assert.equal(fm['disable-model-invocation'], 'true')
assert.equal(fm['user-invocable'], 'no')
assert.equal(parseFrontmatter('no frontmatter'), null)

// local discovery over a synthetic root
const discovered = discoverLocalSkills([{ label: 'test-root', path: tmp, rank: 100 }])
assert.ok(discovered.some((s) => s.name === 'demo-skill'))
assert.ok(discovered.some((s) => s.name === 'flat-skill'))
const demoS = discovered.find((s) => s.name === 'demo-skill')
assert.equal(demoS.invocation.modelInvocable, true)
assert.ok(demoS.fileCount >= 3)

console.log('ALL TESTS PASSED')
