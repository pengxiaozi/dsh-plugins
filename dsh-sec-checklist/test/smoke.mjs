import { defaultConfig, normalizeConfig, publicConfig, revealPassword, generateMarkdown, BUILTIN_ITEMS, CATEGORIES, YAKIT_TOOLS, RECOMMENDED_SKILLS } from '../lib/index.js'
import assert from 'node:assert/strict'

const base = defaultConfig()
assert.equal(base.enabled, true)
assert.ok(base.items.length >= 30, 'builtin items')
assert.equal(new Set(base.selectedSkills).size, base.selectedSkills.length, 'selected skills unique')
assert.ok(base.selectedSkills.length >= 10)

// normalize preserves user data
const raw = {
  enabled: true,
  project: { name: '演示项目', client: '某客户', authorizedBy: '张三', authorizationNo: 'AUTH-001', window: '10-20 09:00~18:00', notes: '只测测试环境' },
  scope: { targets: 'demo.example.com\n10.0.0.1', excludes: 'admin.demo.example.com', environment: '测试环境', proxy: '127.0.0.1:8083', rules: '限速 20 req/s' },
  credentials: [
    { id: 'c1', label: '后台管理员', service: 'https://demo.example.com/admin', username: 'admin', password: 'demo-pass-1', note: '测试号' },
    { label: '普通用户', service: 'app', username: 'user1', password: 'demo-pass-2' },
  ],
  shareCredentialsWithModel: false,
  items: [
    { id: 'custom-1', cat: 'vuln', title: '自定义检查项', detail: '看 X 接口', skill: 'api-sec', yakitTool: 'mcp__yakit__do_http_request', yakitArgs: '{"url":"https://x"}', enabled: true },
    { cat: 'nope', title: '未知分类自动归为漏洞测试' },
    { title: '' },
    null,
  ],
  selectedSkills: ['hack', 'api-sec', 'hack', '', 123],
  skillNote: '优先只读验证',
}
const config = normalizeConfig(raw)
assert.equal(config.project.name, '演示项目')
assert.equal(config.scope.targets.includes('demo.example.com'), true)
assert.equal(config.credentials.length, 2)
assert.equal(config.credentials[1].label, '普通用户')
assert.equal(config.items.length, 2, 'invalid items dropped')
assert.equal(config.items[1].cat, 'vuln', 'unknown category falls back')
assert.deepEqual(config.selectedSkills, ['hack', 'api-sec', '123'])
assert.equal(config.skillNote, '优先只读验证')

// publicConfig hides passwords
const publicView = publicConfig(config)
assert.equal(publicView.credentials[0].password, undefined)
assert.equal(publicView.credentials[0].hasPassword, true)
assert.equal(publicView.credentials[1].hasPassword, true)
assert.equal(revealPassword(config, 'c1'), 'demo-pass-1')
assert.equal(revealPassword(config, 'missing'), '')

// markdown: project, scope, items, skill, yakit, password handling
const md = generateMarkdown(config)
assert.ok(md.includes('# 安全渗透清单（演示项目）'))
assert.ok(md.includes('- 客户：某客户'))
assert.ok(md.includes('demo.example.com'))
assert.ok(md.includes('自定义检查项'))
assert.ok(md.includes('api-sec'))
assert.ok(md.includes('mcp__yakit__do_http_request'))
assert.ok(md.includes('优先只读验证'))
assert.ok(md.includes('| mcp__yakit__scan_port |'))
assert.ok(md.includes('未暴露给模型'), 'password must stay hidden by default')
assert.ok(!md.includes('demo-pass-1'), 'password must not leak into markdown')

// opt-in shares credentials with the model
const shared = generateMarkdown(Object.assign({}, config, { shareCredentialsWithModel: true }))
assert.ok(shared.includes('demo-pass-1'))

// defaults when config is garbage
const empty = normalizeConfig(null)
assert.equal(empty.project.name, '')
assert.equal(empty.items.length, BUILTIN_ITEMS.length)
assert.equal(empty.credentials.length, 0)
assert.equal(CATEGORIES.length, 6)
assert.ok(YAKIT_TOOLS.length >= 10)
assert.ok(RECOMMENDED_SKILLS.length >= 10)

// empty item list restores builtin defaults (prevents a blank checklist)
const blank = normalizeConfig({ items: [] })
assert.equal(blank.items.length, BUILTIN_ITEMS.length)

console.log('ALL TESTS PASSED')
