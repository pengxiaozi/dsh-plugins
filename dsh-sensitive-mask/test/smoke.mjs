import { defaultConfig, normalizeConfig, normalizeRule, maskText, maskBlocks, demaskBuffer, demaskStream, PRESETS } from '../lib/index.js'
import assert from 'node:assert/strict'

const config = normalizeConfig(defaultConfig())
assert.equal(config.enabled, true)
assert.ok(config.rules.length >= 4)

// phone + idcard masking
const phone = '联系我 13800138000，备用 13900139000'
const masked = maskText(phone, config)
assert.ok(!masked.text.includes('13800138000'))
assert.ok(masked.text.includes('[[手机号#1]]'))
assert.equal(masked.hits.length, 2)
assert.equal(masked.hits[0].rule, '手机号')
assert.ok(masked.hits[0].hash && masked.hits[0].hash.length === 12)
assert.equal(masked.hits[0].original, undefined)

const maskedWithOriginal = maskText(phone, config, { logOriginals: true })
assert.equal(maskedWithOriginal.hits[0].original, '13800138000')

const idcard = '身份证 110101199001011234'
const maskedId = maskText(idcard, config)
assert.ok(!maskedId.text.includes('110101199001011234'))
assert.ok(maskedId.text.includes('[[证件号#1]]'))

// demask round-trip
assert.equal(demaskBuffer(masked.text).out, phone)

// demask buffering across chunk boundaries
const chunks = [
  { type: 'block-start', index: 0, blockType: 'text' },
  { type: 'text-delta', index: 0, text: '联系我 [[' },
  { type: 'text-delta', index: 0, text: '手机号' },
  { type: 'text-delta', index: 0, text: '#1]]，备用 [[' },
  { type: 'text-delta', index: 0, text: '手机号#2]]' },
  { type: 'block-end', index: 0 },
  { type: 'finish', reason: { kind: 'stop' } },
]
const out = []
for await (const chunk of demaskStream(chunks)) out.push(chunk)
const text = out.filter((c) => c.type === 'text-delta').map((c) => c.text).join('')
assert.equal(text, phone)
assert.ok(out.some((c) => c.type === 'finish'))
assert.ok(!out.some((c) => c.type === 'block-end' && false))

// tool-call argument demask
const toolChunks = [
  { type: 'block-start', index: 1, blockType: 'tool-call' },
  { type: 'tool-call-delta', index: 1, id: 'c1', argumentsDelta: '{"file":"a.txt","content":"[[' },
  { type: 'tool-call-delta', index: 1, id: 'c1', argumentsDelta: '手机号#1]]"}' },
  { type: 'block-end', index: 1 },
]
const toolOut = []
for await (const c of demaskStream(toolChunks)) toolOut.push(c)
const args = toolOut.filter((c) => c.type === 'tool-call-delta').map((c) => c.argumentsDelta).join('')
assert.ok(args.includes('13800138000'))

// incomplete placeholder is held, then flushed at finish
const partial = []
for await (const c of demaskStream([
  { type: 'block-start', index: 2, blockType: 'text' },
  { type: 'text-delta', index: 2, text: 'abc [[' },
  { type: 'finish' },
])) partial.push(c)
const partialText = partial.filter((c) => c.type === 'text-delta').map((c) => c.text).join('')
assert.equal(partialText, 'abc [[')

// maskBlocks preserves non-text blocks
const blocks = [
  { type: 'text', text: '号码 13800138000' },
  { type: 'image', url: 'x' },
]
const maskedBlocks = maskBlocks(blocks, config)
assert.equal(maskedBlocks.blocks.length, 2)
assert.ok(maskedBlocks.blocks[0].text.includes('[[手机号#'))
assert.deepEqual(maskedBlocks.blocks[1], { type: 'image', url: 'x' })

// literal rules and invalid regex
assert.throws(() => normalizeRule({ type: 'regex', pattern: '(' }, 0), /正则无效/)
const literalCfg = normalizeConfig({ enabled: true, rules: [{ type: 'literal', pattern: '某某公司', replacement: '机构' }] })
const lit = maskText('这是某某公司', literalCfg)
assert.ok(lit.text.includes('[[机构#'))


// configurable masking styles
const partialCfg = normalizeConfig(Object.assign({}, defaultConfig(), { maskStyle: 'partial' }))
const partialMasked = maskText('tel 13800138000', partialCfg)
assert.equal(partialMasked.text, 'tel 138****8000')
assert.equal(partialMasked.hits[0].style, 'partial')
assert.ok(!partialMasked.text.includes('[['))

const fixedCfg = normalizeConfig(Object.assign({}, defaultConfig(), { maskStyle: 'fixed' }))
const fixedMasked = maskText('tel 13800138000', fixedCfg)
assert.equal(fixedMasked.text, 'tel 手机号')
assert.equal(fixedMasked.hits[0].style, 'fixed')

// per-rule override wins over the global style
const overrideCfg = normalizeConfig(Object.assign({}, defaultConfig(), {
  maskStyle: 'partial',
  rules: [{ id: 'p', name: '手机号', type: 'regex', pattern: '(?<!\\d)1[3-9]\\d{9}(?!\\d)', replacement: '手机号', style: 'placeholder' }],
}))
assert.match(maskText('tel 13800138000', overrideCfg).text, /\[\[手机号#\d+\]\]/)

// partial masking keeps configured head/tail and fully masks short values
const shortCfg = normalizeConfig({ rules: [{ type: 'literal', pattern: 'ab', replacement: 'X', style: 'partial', keepHead: 1, keepTail: 1 }] })
assert.equal(maskText('ab', shortCfg).text, '**')
assert.equal(normalizeConfig({ rules: [{ type: 'literal', pattern: 'q', replacement: 'X', keepHead: 99, keepTail: -3 }] }).rules[0].keepHead, 12)
assert.equal(normalizeConfig({ rules: [{ type: 'literal', pattern: 'q', replacement: 'X', keepHead: 99, keepTail: -3 }] }).rules[0].keepTail, 0)

console.log('ALL TESTS PASSED')
