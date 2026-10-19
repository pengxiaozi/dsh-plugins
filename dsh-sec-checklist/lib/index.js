/**
 * dsh-sec-checklist — host half.
 *
 * 安全渗透清单：
 *  - 本地保存项目/授权/范围/测试账号；
 *  - 内置 + 自定义检查项（分类、Yakit 工具、关联渗透技能）；
 *  - 生成 markdown 并注册为运行时 skill `security-checklist`，AI 在渗透测试时直接加载；
 *  - 设置页路由：state / config / preview / doc / reveal / reset。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { BUILTIN_ITEMS, CATEGORIES, PLAYBOOK, RECOMMENDED_SKILLS, YAKIT_TOOLS } from './defaults.js'

export const name = 'dsh-sec-checklist'

const CONFIG_FILE = 'sec-checklist.json'
const LOG_FILE = 'sec-checklist.log'
const SKILL_NAME = 'security-checklist'
const BODY_LIMIT_BYTES = 1024 * 1024
const MAX_ITEMS = 500
const MAX_CREDENTIALS = 100

export { BUILTIN_ITEMS, CATEGORIES, PLAYBOOK, RECOMMENDED_SKILLS, YAKIT_TOOLS }

const PROJECT_FIELDS = ['name', 'client', 'authorizedBy', 'authorizationNo', 'window', 'notes']
const SCOPE_FIELDS = ['targets', 'excludes', 'environment', 'proxy', 'rules']
const CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id))

const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', 'dist', 'build'])

function truthy(value) {
  if (value === undefined || value === null) return undefined
  const normalized = String(value).trim().toLowerCase()
  return normalized === 'true' || normalized === 'yes' || normalized === 'on' || normalized === '1'
}

function parseScalar(value) {
  let text = value.trim()
  if (text === '') return ''
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    const quote = text[0]
    text = text.slice(1, -1)
    if (quote === '"') text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    return text
  }
  return text
}

/** Minimal YAML frontmatter reader for SKILL.md (top-level scalars + block scalars). */
export function parseFrontmatter(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n')
  if (lines.length === 0 || lines[0].trim() !== '---') return null
  let end = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') { end = i; break }
  }
  if (end < 0) return null
  const data = {}
  let i = 1
  while (i < end) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i])
    if (!match) { i += 1; continue }
    const key = match[1]
    const rest = match[2]
    i += 1
    if (/^[>|][+-]?$/.test(rest.trim())) {
      const folded = rest.trim().startsWith('>')
      const block = []
      while (i < end && (lines[i].startsWith(' ') || lines[i].startsWith('\t') || lines[i].trim() === '')) { block.push(lines[i]); i += 1 }
      const nonEmpty = block.filter((line) => line.trim() !== '')
      const indent = nonEmpty.length > 0 ? Math.min(...nonEmpty.map((line) => (line.match(/^\s*/) || [''])[0].length)) : 0
      const stripped = block.map((line) => line.slice(Math.min(indent, (line.match(/^\s*/) || [''])[0].length)))
      data[key] = folded ? stripped.join(' ').replace(/\s+/g, ' ').trim() : stripped.join('\n').trim()
      continue
    }
    data[key] = parseScalar(rest)
  }
  return data
}

function skillRoots(profileDir) {
  const roots = []
  const dshHome = process.env.DSH_HOME || join(profileDir, '..', '..')
  roots.push({ label: 'user-dsh', path: join(dshHome, 'skills') })
  const agentsHome = process.env.AGENTS_HOME || join(homedir(), '.agents')
  roots.push({ label: 'user-agents', path: join(agentsHome, 'skills') })
  return roots
}

function discoverLocalSkills(roots) {
  const out = []
  for (const root of roots) {
    let names
    try { names = readdirSync(root.path) } catch { continue }
    names.sort()
    for (const entry of names) {
      if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue
      const abs = join(root.path, entry)
      let stat
      try { stat = statSync(abs) } catch { continue }
      let mdPath = null
      if (stat.isDirectory()) {
        const candidate = join(abs, 'SKILL.md')
        if (existsSync(candidate)) mdPath = candidate
        else continue
      } else if (stat.isFile() && entry.toLowerCase().endsWith('.md')) {
        mdPath = abs
      } else {
        continue
      }
      let text
      try { text = readFileSync(mdPath, 'utf8').slice(0, 65536) } catch { continue }
      const frontmatter = parseFrontmatter(text)
      if (!frontmatter || typeof frontmatter.name !== 'string' || !SKILL_NAME_RE.test(frontmatter.name)) continue
      const description = typeof frontmatter.description === 'string' ? frontmatter.description : ''
      if (description === '') continue
      out.push({
        name: frontmatter.name,
        description,
        source: root.label,
        provider: 'filesystem',
        invocation: {
          modelInvocable: truthy(frontmatter['disable-model-invocation']) !== true,
          userInvocable: truthy(frontmatter['user-invocable']) !== false,
        },
      })
    }
  }
  return out
}


function text(value, max) {
  const limit = max || 2000
  const out = value === undefined || value === null ? '' : String(value)
  return out.length > limit ? out.slice(0, limit) : out
}

function idOf(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

/* ------------------------------------------------------------------ */
/* config                                                              */
/* ------------------------------------------------------------------ */

export function defaultConfig() {
  const seen = new Set()
  const selectedSkills = []
  for (const entry of RECOMMENDED_SKILLS) {
    if (seen.has(entry.name)) continue
    seen.add(entry.name)
    selectedSkills.push(entry.name)
    if (selectedSkills.length >= 12) break
  }
  return {
    version: 1,
    enabled: true,
    project: {
      name: '',
      client: '',
      authorizedBy: '',
      authorizationNo: '',
      window: '',
      notes: '',
    },
    scope: {
      targets: '',
      excludes: '',
      environment: '',
      proxy: '',
      rules: '',
    },
    credentials: [],
    shareCredentialsWithModel: false,
    items: BUILTIN_ITEMS.map((item) => Object.assign({}, item)),
    selectedSkills,
    skillNote: '',
  }
}

export function normalizeItem(raw, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const title = text(raw.title, 300).trim()
  if (title === '') return null
  return {
    id: text(raw.id, 80).trim() || 'item-' + (index + 1),
    cat: CATEGORY_IDS.has(raw.cat) ? raw.cat : 'vuln',
    title,
    detail: text(raw.detail, 1500),
    skill: text(raw.skill, 80),
    yakitTool: text(raw.yakitTool, 120),
    yakitArgs: text(raw.yakitArgs, 1000),
    enabled: raw.enabled !== false,
  }
}

export function normalizeCredential(raw, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const service = text(raw.service, 200).trim()
  const username = text(raw.username, 200)
  const label = text(raw.label, 120).trim()
  if (service === '' && username === '' && label === '') return null
  return {
    id: text(raw.id, 80).trim() || 'cred-' + (index + 1),
    label: label || ('账号 ' + (index + 1)),
    service,
    username,
    password: text(raw.password, 500),
    note: text(raw.note, 500),
  }
}

export function normalizeConfig(raw) {
  const base = defaultConfig()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const project = Object.assign({}, base.project)
  for (const field of PROJECT_FIELDS) project[field] = text(raw.project && raw.project[field], 4000)
  const scope = Object.assign({}, base.scope)
  for (const field of SCOPE_FIELDS) scope[field] = text(raw.scope && raw.scope[field], 8000)

  const credentials = []
  if (Array.isArray(raw.credentials)) {
    for (const entry of raw.credentials.slice(0, MAX_CREDENTIALS)) {
      const credential = normalizeCredential(entry, credentials.length)
      if (credential) credentials.push(credential)
    }
  }

  const items = []
  if (Array.isArray(raw.items)) {
    for (const entry of raw.items.slice(0, MAX_ITEMS)) {
      const item = normalizeItem(entry, items.length)
      if (item) items.push(item)
    }
  }

  const selectedSkills = []
  const seen = new Set()
  if (Array.isArray(raw.selectedSkills)) {
    for (const entry of raw.selectedSkills) {
      const skillName = text(entry, 120).trim()
      if (skillName === '' || seen.has(skillName)) continue
      seen.add(skillName)
      selectedSkills.push(skillName)
    }
  }

  return {
    version: 1,
    enabled: raw.enabled !== false,
    project,
    scope,
    credentials,
    shareCredentialsWithModel: raw.shareCredentialsWithModel === true,
    items: items.length > 0 ? items : base.items,
    selectedSkills,
    skillNote: text(raw.skillNote, 3000),
  }
}

/** UI 用：密码字段不下发，只给 hasPassword。 */
export function publicConfig(config) {
  const copy = JSON.parse(JSON.stringify(config))
  copy.credentials = (config.credentials || []).map((credential) => ({
    id: credential.id,
    label: credential.label,
    service: credential.service,
    username: credential.username,
    note: credential.note,
    hasPassword: credential.password !== '',
  }))
  return copy
}

export function revealPassword(config, id) {
  const found = (config.credentials || []).find((credential) => credential.id === id)
  return found ? found.password : ''
}

/* ------------------------------------------------------------------ */
/* markdown (skill body / preview)                                     */
/* ------------------------------------------------------------------ */

export function generateMarkdown(config) {
  const project = config.project || {}
  const scope = config.scope || {}
  const lines = []
  const push = (line) => lines.push(line)

  push('# 安全渗透清单（' + (project.name || '未命名项目') + '）')
  push('')
  push('> 本清单由 dsh-sec-checklist 生成，用于获得书面授权的渗透测试。测试前先确认范围与账号，过程中按分类逐项执行并保留证据。')
  push('')

  push('## 项目与授权')
  push('- 项目：' + (project.name || '（未填写）'))
  push('- 客户：' + (project.client || '（未填写）'))
  push('- 授权人/授权书：' + (project.authorizedBy || '（未填写）') + (project.authorizationNo ? ' / ' + project.authorizationNo : ''))
  push('- 时间窗：' + (project.window || '（未填写）'))
  if (project.notes) push('- 备注：' + project.notes)
  push('')

  push('## 范围与环境')
  push('- 目标范围：' + (scope.targets ? scope.targets.replace(/\n+/g, '；') : '（未填写）'))
  push('- 排除项：' + (scope.excludes ? scope.excludes.replace(/\n+/g, '；') : '（无）'))
  push('- 环境：' + (scope.environment || '（未填写）'))
  push('- 代理：' + (scope.proxy || '（未填写）'))
  if (scope.rules) push('- 规则/约束：' + scope.rules)
  push('')

  push('## 测试账号')
  const credentials = config.credentials || []
  if (credentials.length === 0) {
    push('- （未配置测试账号）')
  } else {
    push('| 服务 | 用户名 | 密码 | 备注 |')
    push('| --- | --- | --- | --- |')
    for (const credential of credentials) {
      const password = config.shareCredentialsWithModel ? credential.password : '（在设置页查看/复制，未暴露给模型）'
      push('| ' + credential.service + ' | ' + credential.username + ' | ' + password + ' | ' + credential.note + ' |')
    }
  }
  push('')

  push('## 执行纪律')
  push('- 只测授权范围内的资产；越界立即停止并报告。')
  push('- 优先只读验证；写入/删除/DoS 等破坏性操作必须先取得明确同意。')
  push('- 每个结论保留可复现的请求响应与时间；不确定的标记为待确认。')
  push('- 发现高危（RCE/大量数据泄露/核心越权）先暂停并通知客户。')
  push('')

  push('## 检查清单')
  const items = config.items || []
  for (const category of CATEGORIES) {
    const group = items.filter((item) => item.enabled !== false && item.cat === category.id)
    if (group.length === 0) continue
    push('')
    push('### ' + category.name)
    for (const item of group) {
      let line = '- [ ] ' + item.title
      if (item.detail) line += '：' + item.detail
      push(line)
      const parts = []
      if (item.skill) parts.push('技能 ' + item.skill)
      if (item.yakitTool) parts.push('Yakit ' + item.yakitTool + (item.yakitArgs ? ' 参数示例 ' + item.yakitArgs : ''))
      if (parts.length > 0) push('  - 参考：' + parts.join('；'))
    }
  }
  push('')

  push('## 推荐技能（按需用 skill 工具加载）')
  const selected = config.selectedSkills || []
  if (selected.length === 0) {
    push('- （未选择技能）')
  } else {
    const reasons = new Map(RECOMMENDED_SKILLS.map((entry) => [entry.name, entry.why]))
    for (const skillName of selected) push('- ' + skillName + (reasons.get(skillName) ? '：' + reasons.get(skillName) : ''))
  }
  if (config.skillNote) {
    push('')
    push('补充说明：' + config.skillNote)
  }
  push('')

  push('## Yakit 工具速查')
  push('| 工具 | 用途 | 示例参数 |')
  push('| --- | --- | --- |')
  for (const entry of YAKIT_TOOLS) push('| ' + entry.tool + ' | ' + entry.use + ' | ' + entry.args + ' |')
  push('')

  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* plugin                                                              */
/* ------------------------------------------------------------------ */

export function apply(ctx) {
  const profile = ctx.get('profileContext')
  const profileDir = profile && typeof profile.dir === 'string' ? profile.dir : process.cwd()
  const configPath = join(profileDir, CONFIG_FILE)
  const logPath = join(profileDir, LOG_FILE)

  function log(message) {
    try {
      writeFileSync(logPath, '[' + new Date().toISOString() + '] ' + String(message) + '\n', { flag: 'a' })
    } catch {
      /* ignore */
    }
  }

  if (!existsSync(configPath)) {
    try { writeFileSync(configPath, JSON.stringify(defaultConfig(), null, 2) + '\n') } catch (error) { log('config init failed: ' + error) }
  }

  let cache = { mtime: -1, config: null }
  function getConfig() {
    try {
      const stat = statSync(configPath)
      if (cache.mtime !== stat.mtimeMs || cache.config === null) {
        cache = { mtime: stat.mtimeMs, config: normalizeConfig(JSON.parse(readFileSync(configPath, 'utf8'))) }
      }
    } catch {
      if (cache.config === null) cache = { mtime: -1, config: normalizeConfig(null) }
    }
    return cache.config
  }

  function mergeCredentialSecrets(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.credentials)) return raw
    const previous = getConfig()
    const passwords = new Map((previous.credentials || []).map((credential) => [credential.id, credential.password]))
    for (const credential of raw.credentials) {
      if (!credential || typeof credential !== 'object') continue
      if (credential.password === undefined && passwords.has(credential.id)) credential.password = passwords.get(credential.id)
    }
    return raw
  }

  function saveConfig(raw) {
    const config = normalizeConfig(mergeCredentialSecrets(raw))
    const tmp = configPath + '.tmp'
    writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n')
    renameSync(tmp, configPath)
    cache = { mtime: -1, config: null }
    return config
  }

  /* ---------------- runtime skill ---------------- */

  let skillsService = null
  let disposeSkill = null

  function refreshSkill() {
    try {
      if (!skillsService) return
      if (disposeSkill) {
        try { disposeSkill() } catch { /* ignore */ }
        disposeSkill = null
      }
      const config = getConfig()
      if (!config.enabled) return
      const content = generateMarkdown(config)
      const description = '安全渗透清单：项目授权范围、测试账号、分阶段检查项、Yakit 工具对照与推荐渗透技能；做渗透测试前先加载本技能，按其逐项执行。'
      disposeSkill = skillsService.register({
        name: SKILL_NAME,
        description,
        content,
        invocation: { modelInvocable: true, userInvocable: true },
        provider: name,
        source: 'custom',
      })
    } catch (error) {
      log('skill register failed: ' + (error && error.stack ? error.stack : error))
    }
  }

  ctx.inject(['skills'], (host) => {
    const skills = host && host.skills ? host.skills : ctx.get('skills')
    if (skills && typeof skills.register === 'function') {
      skillsService = skills
      refreshSkill()
    }
  })

  ctx.effect(() => () => {
    if (disposeSkill) {
      try { disposeSkill() } catch { /* ignore */ }
      disposeSkill = null
    }
    skillsService = null
  }, 'dsh-sec-checklist skill')

  /* ---------------- helpers ---------------- */

  function readBody(request) {
    return new Promise((resolve, reject) => {
      let size = 0
      const chunks = []
      request.on('data', (chunk) => {
        size += chunk.length
        if (size > BODY_LIMIT_BYTES) {
          reject(new Error('请求体过大'))
          request.destroy()
          return
        }
        chunks.push(chunk)
      })
      request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      request.on('error', reject)
    })
  }

  function sendJson(response, status, value) {
    const body = JSON.stringify(value)
    response.statusCode = status
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.setHeader('cache-control', 'no-store')
    response.end(body)
  }

  function sendError(response, error) {
    sendJson(response, 500, { ok: false, error: String(error && error.message ? error.message : error) })
  }

  async function listSkills() {
    try {
      const byName = new Map()
      for (const local of discoverLocalSkills(skillRoots(profileDir))) byName.set(local.name, local)
      if (skillsService) {
        try {
          const summaries = await skillsService.list({})
          for (const summary of summaries) {
            const existing = byName.get(summary.name)
            if (existing) {
              if (typeof summary.description === 'string' && summary.description !== '') existing.description = summary.description
              existing.provider = summary.provider
              if (typeof summary.source === 'string' && summary.source !== '') existing.source = summary.source
              if (summary.invocation) existing.invocation = summary.invocation
            } else {
              byName.set(summary.name, {
                name: summary.name,
                description: summary.description,
                source: summary.source,
                provider: summary.provider,
                invocation: summary.invocation,
              })
            }
          }
        } catch (error) {
          log('skills.list failed: ' + error)
        }
      }
      const recommended = new Set(RECOMMENDED_SKILLS.map((entry) => entry.name))
      return Array.from(byName.values())
        .filter((skill) => !skill.invocation || skill.invocation.modelInvocable !== false)
        .map((skill) => ({
          name: skill.name,
          description: skill.description,
          source: skill.source,
          provider: skill.provider,
          recommended: recommended.has(skill.name),
        }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    } catch (error) {
      log('skills.list failed: ' + error)
      return []
    }
  }

  /* ---------------- routes ---------------- */

  ctx.inject(['webServer'], (host) => {
    const webServer = (host && host.webServer) || ctx.get('webServer')
    if (!webServer || typeof webServer.register !== 'function') return
    const unregister = []
    const register = (path, handler) => unregister.push(webServer.register({ kind: 'exact', path, handler }))

    register('/dsh-sec-checklist/state', async (request, response) => {
      try {
        const config = getConfig()
        const skills = await listSkills()
        sendJson(response, 200, {
          ok: true,
          config: publicConfig(config),
          categories: CATEGORIES,
          yakitTools: YAKIT_TOOLS,
          recommendedSkills: RECOMMENDED_SKILLS,
          skills,
          configPath,
          stats: {
            items: config.items.length,
            enabledItems: config.items.filter((item) => item.enabled !== false).length,
            selectedSkills: config.selectedSkills.length,
            credentials: config.credentials.length,
            skills: skills.length,
          },
        })
      } catch (error) {
        sendError(response, error)
      }
    })

    register('/dsh-sec-checklist/config', async (request, response) => {
      try {
        const raw = await readBody(request)
        const payload = raw ? JSON.parse(raw) : {}
        const config = saveConfig(payload && payload.config ? payload.config : payload)
        refreshSkill()
        sendJson(response, 200, { ok: true, config: publicConfig(config) })
      } catch (error) {
        sendError(response, error)
      }
    })

    register('/dsh-sec-checklist/preview', async (request, response) => {
      try {
        sendJson(response, 200, { ok: true, markdown: generateMarkdown(getConfig()) })
      } catch (error) {
        sendError(response, error)
      }
    })

    register('/dsh-sec-checklist/doc', async (request, response) => {
      try {
        sendJson(response, 200, { ok: true, markdown: PLAYBOOK })
      } catch (error) {
        sendError(response, error)
      }
    })

    register('/dsh-sec-checklist/reveal', async (request, response) => {
      try {
        const raw = await readBody(request)
        const payload = raw ? JSON.parse(raw) : {}
        sendJson(response, 200, { ok: true, password: revealPassword(getConfig(), text(payload.id, 80)) })
      } catch (error) {
        sendError(response, error)
      }
    })

    register('/dsh-sec-checklist/reset', async (request, response) => {
      try {
        const config = getConfig()
        config.items = BUILTIN_ITEMS.map((item) => Object.assign({}, item))
        const saved = saveConfig(config)
        refreshSkill()
        sendJson(response, 200, { ok: true, config: publicConfig(saved) })
      } catch (error) {
        sendError(response, error)
      }
    })

    ctx.effect(() => () => {
      for (const off of unregister) {
        try { off() } catch { /* ignore */ }
      }
    }, 'dsh-sec-checklist routes')
  })

  ctx.effect(() => () => {
    log('plugin disposed')
  }, 'dsh-sec-checklist log')

  // 客户端 bundle 在 profile 重载后自动重建
  try {
    const clientModules = ctx.get('clientModules')
    if (clientModules && typeof clientModules.rebuilt === 'function') clientModules.rebuilt(name)
  } catch {
    /* optional host service */
  }
}
