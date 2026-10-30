/**
 * Pure formatter tests for dsh-session-exporter. No running DSH required.
 *
 * Run: node dsh-session-exporter/test/format.mjs
 */
import assert from 'node:assert/strict'

import {
  exportSession,
  filenameFor,
  modelOf,
  summarize,
  titleOf,
  toJson,
  toJsonl,
  toMarkdown,
  toQa,
} from '../lib/format.js'

const header = {
  version: 5,
  id: 'session-1234abcd-0000-0000-0000-000000000000',
  createdAt: Date.UTC(2026, 0, 2, 3, 4, 5),
  cwd: 'D:\\work',
  isSeeded: false,
  agentPreset: 'ptc',
}

const events = [
  { type: 'turn/start', seq: 0, time: Date.UTC(2026, 0, 2, 3, 4, 5), data: { turn: 1 } },
  { type: 'user/message', seq: 1, time: Date.UTC(2026, 0, 2, 3, 4, 6), data: { id: 'm1', role: 'user', content: [{ type: 'text', text: '第一个问题' }] } },
  { type: 'step/start', seq: 2, time: Date.UTC(2026, 0, 2, 3, 4, 6), data: { turn: 1, step: 1 } },
  { type: 'assistant/message', seq: 3, time: Date.UTC(2026, 0, 2, 3, 4, 7), data: { turn: 1, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: '第一个回答' }], source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' } }, stream: [], usage: { inputTokens: 10, outputTokens: 20 } } },
  { type: 'tool/call', seq: 4, time: Date.UTC(2026, 0, 2, 3, 4, 8), data: { turn: 1, step: 1, callId: 'call-1', name: 'read', arguments: '{"file_path":"a.txt"}' } },
  { type: 'tool/result', seq: 5, time: Date.UTC(2026, 0, 2, 3, 4, 9), data: { turn: 1, step: 1, message: { role: 'tool', content: [{ type: 'text', text: 'file body' }], source: { kind: 'tool', callId: 'call-1' } } } },
  { type: 'turn/end', seq: 6, time: Date.UTC(2026, 0, 2, 3, 4, 10), data: { turn: 1, reason: { kind: 'completed' } } },
  { type: 'turn/start', seq: 7, time: Date.UTC(2026, 0, 2, 3, 5, 0), data: { turn: 2 } },
  { type: 'user/message', seq: 8, time: Date.UTC(2026, 0, 2, 3, 5, 1), data: { id: 'm2', role: 'user', content: [{ type: 'text', text: '第二个问题' }] } },
  { type: 'assistant/message', seq: 9, time: Date.UTC(2026, 0, 2, 3, 5, 2), data: { turn: 2, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: '第二个回答' }], source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' } }, stream: [] } },
  { type: 'session/title', seq: 10, time: Date.UTC(2026, 0, 2, 3, 5, 3), data: { title: '演示会话', messageSeqs: [1], source: { kind: 'user' } } },
]

assert.equal(titleOf(events), '演示会话')
assert.equal(titleOf([{ type: 'user/message' }]), undefined)
assert.deepEqual(modelOf(events), { provider: 'deepseek-official', model: 'deepseek-flash' })

const stats = summarize(header, events)
assert.equal(stats.events, 11)
assert.equal(stats.userMessages, 2)
assert.equal(stats.assistantMessages, 2)
assert.equal(stats.toolsCalled, 1)
assert.equal(stats.toolsCompleted, 1)
assert.equal(stats.usage.inputTokens, 10)
assert.equal(stats.title, '演示会话')
assert.equal(stats.tools.read, 1)

const json = toJson(header, events)
assert.equal(json.format, 'dsh-session-export')
assert.equal(json.session.id, header.id)
assert.equal(json.events.length, events.length)

const jsonl = toJsonl(header, events)
const lines = jsonl.trim().split('\n')
assert.equal(lines.length, events.length + 1)
assert.equal(JSON.parse(lines[0]).type, '__session_header__')
assert.equal(JSON.parse(lines[1]).type, 'turn/start')

const md = toMarkdown(header, events)
assert.ok(md.includes('# 会话导出：演示会话'))
assert.ok(md.includes('👤 用户'))
assert.ok(md.includes('第一个问题'))
assert.ok(md.includes('🤖 助手 · deepseek-flash'))
assert.ok(md.includes('🛠 工具调用 · read'))
assert.ok(md.includes('工具结果'))
assert.ok(!md.includes('developer'), 'system messages excluded by default')
const mdWithToolsFalse = toMarkdown(header, events, { includeTools: false })
assert.ok(!mdWithToolsFalse.includes('🛠 工具调用'))
assert.ok(!mdWithToolsFalse.includes('工具结果'))
const mdCapped = toMarkdown(header, events, { maxChars: 80 })
assert.ok(mdCapped.length < md.length)
assert.ok(mdCapped.includes('truncated'))

const qa = toQa(header, events)
assert.equal(qa.format, 'dsh-session-qa')
assert.equal(qa.pairs.length, 2)
assert.equal(qa.pairs[0].question, '第一个问题')
assert.equal(qa.pairs[0].answer, '第一个回答')
assert.equal(qa.pairs[0].tools[0].name, 'read')
assert.equal(qa.pairs[1].question, '第二个问题')
assert.equal(qa.pairs[1].answer, '第二个回答')

const name = filenameFor(header, '演示 会话', 'md')
assert.ok(name.endsWith('.md'))
assert.ok(name.includes('2026-01-02-03-04-05'))
assert.ok(name.includes('1234abcd'))

const mdExport = exportSession(header, events, 'md')
assert.equal(mdExport.mediaType, 'text/markdown; charset=utf-8')
const jsonExport = exportSession(header, events, 'json')
assert.equal(jsonExport.mediaType, 'application/json; charset=utf-8')
const qaExport = exportSession(header, events, 'qa')
assert.ok(qaExport.filename.endsWith('.qa.json'))
assert.equal(exportSession(header, events, 'nope').format, 'md', 'unknown format falls back to md')

console.log('format: ok')
