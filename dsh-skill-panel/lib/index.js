/**
 * dsh-skill-panel — host half.
 *
 * 为「设置 → Skills」面板提供数据与导出：
 *  - 列表来自 ctx.skills.list()（与模型技能目录同一份合并结果，含 frontmatter 校验与同名优先级）；
 *  - 文件数 / 大小 / 文件清单按 skill 目录实时扫描；
 *  - /export 生成标准 ZIP（deflate，UTF-8 文件名），可直接下载。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { deflateRawSync } from 'node:zlib'

export const name = 'dsh-skill-panel'

const BODY_LIMIT_BYTES = 1024 * 1024
const CONTENT_PREVIEW_BYTES = 400 * 1024
const MAX_FILES_PER_SKILL = 600
const MAX_BYTES_PER_SKILL = 40 * 1024 * 1024
const MAX_SKILLS_PER_EXPORT = 300
const MAX_TOTAL_EXPORT_BYTES = 200 * 1024 * 1024
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.svn'])

const requireFromHere = createRequire(import.meta.url)

/**
 * Open a directory in the OS file manager. Uses Electron's shell when the host
 * runs inside Electron, otherwise falls back to explorer.exe / open / xdg-open.
 * @param {string} dir
 * @returns {Promise<void>}
 */
export function openDirectory(dir) {
  let electronShell = null
  try {
    const electron = requireFromHere('electron')
    if (electron && electron.shell && typeof electron.shell.openPath === 'function') electronShell = electron.shell
  } catch {
    electronShell = null
  }
  if (electronShell) {
    const result = electronShell.openPath(dir)
    if (result && typeof result.then === 'function') {
      return result.then((error) => {
        if (error) throw new Error(String(error))
      })
    }
    return Promise.resolve()
  }
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const child = spawn(command, [dir], { detached: true, stdio: 'ignore' })
  child.unref()
  return Promise.resolve()
}

/* ------------------------------------------------------------------ */
/* ZIP writer (store/deflate, UTF-8 names, no dependency)              */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(date) {
  const time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | (Math.floor(date.getSeconds() / 2) & 31)
  const day = (((date.getFullYear() - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31)
  return { time, day }
}

/**
 * Build a ZIP archive from [{ name, data }]. Names use forward slashes.
 * @param {Array<{name: string, data: Buffer}>} files
 * @returns {Buffer}
 */
export function zipArchive(files) {
  const chunks = []
  const central = []
  let offset = 0
  const now = new Date()
  const { time, day } = dosDateTime(now)
  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8')
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data)
    const crc = crc32(data)
    let method = 8
    let payload
    try {
      payload = deflateRawSync(data)
    } catch {
      payload = null
    }
    if (!payload || payload.length >= data.length) {
      method = 0
      payload = data
    }
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(payload.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    chunks.push(local, nameBuf, payload)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(method, 10)
    entry.writeUInt16LE(time, 12)
    entry.writeUInt16LE(day, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(payload.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(nameBuf.length, 28)
    entry.writeUInt16LE(0, 30)
    entry.writeUInt16LE(0, 32)
    entry.writeUInt16LE(0, 34)
    entry.writeUInt16LE(0, 36)
    entry.writeUInt32LE(0, 38)
    entry.writeUInt32LE(offset, 42)
    central.push(Buffer.concat([entry, nameBuf]))
    offset += local.length + nameBuf.length + payload.length
  }
  const centralBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...chunks, centralBuf, eocd])
}

/* ------------------------------------------------------------------ */
/* filesystem helpers                                                  */
/* ------------------------------------------------------------------ */

function walk(baseDir, currentRel, collected, limits) {
  const dir = currentRel === '' ? baseDir : join(baseDir, currentRel)
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  names.sort()
  for (const entry of names) {
    if (collected.files.length >= limits.maxFiles || collected.bytes >= limits.maxBytes) return
    const abs = join(dir, entry)
    let st
    try {
      st = statSync(abs)
    } catch {
      continue
    }
    const rel = currentRel === '' ? entry : currentRel + '/' + entry
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue
      walk(baseDir, rel, collected, limits)
    } else if (st.isFile()) {
      collected.files.push({ rel, abs, size: st.size })
      collected.bytes += st.size
    }
  }
}

/**
 * Resolve the files a skill occupies on disk.
 * @param {string} skillPath absolute path of the SKILL.md or flat .md file
 * @returns {null | { dir: string | null, isBundle: boolean, files: Array<{rel: string, abs: string, size: number}>, bytes: number, truncated: boolean }}
 */
export function collectSkillFiles(skillPath, limits = {}) {
  const maxFiles = limits.maxFiles || MAX_FILES_PER_SKILL
  const maxBytes = limits.maxBytes || MAX_BYTES_PER_SKILL
  if (typeof skillPath !== 'string' || skillPath === '' || !existsSync(skillPath)) return null
  let st
  try {
    st = statSync(skillPath)
  } catch {
    return null
  }
  if (!st.isFile()) return null
  const isBundle = basename(skillPath).toLowerCase() === 'skill.md'
  if (!isBundle) {
    return { dir: null, isBundle: false, files: [{ rel: basename(skillPath), abs: skillPath, size: st.size }], bytes: st.size, truncated: false }
  }
  const baseDir = dirname(skillPath)
  const collected = { files: [], bytes: 0 }
  walk(baseDir, '', collected, { maxFiles, maxBytes })
  const truncated = collected.files.length >= maxFiles || collected.bytes >= maxBytes
  return { dir: baseDir, isBundle: true, files: collected.files, bytes: collected.bytes, truncated }
}

/* ------------------------------------------------------------------ */
/* frozen frontmatter + local roots discovery                          */
/* ------------------------------------------------------------------ */

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function truthy(value) {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim().toLowerCase()
  return text === 'true' || text === 'yes' || text === 'on' || text === '1'
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

/**
 * Minimal YAML frontmatter reader for SKILL.md (top-level scalars, quoted
 * strings, and folded/literal block scalars). Enough for catalog display.
 * @param {string} text
 * @returns {Record<string, string> | null}
 */
export function parseFrontmatter(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n')
  if (lines.length === 0 || lines[0].trim() !== '---') return null
  let end = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      end = i
      break
    }
  }
  if (end < 0) return null
  const data = {}
  let i = 1
  while (i < end) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i])
    if (!match) {
      i += 1
      continue
    }
    const key = match[1]
    const rest = match[2]
    i += 1
    if (/^[>|][+-]?$/.test(rest.trim())) {
      const folded = rest.trim().startsWith('>')
      const block = []
      while (i < end && (lines[i].startsWith(' ') || lines[i].startsWith('\t') || lines[i].trim() === '')) {
        block.push(lines[i])
        i += 1
      }
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

/**
 * Scan configured roots for skill directories (<name>/SKILL.md) and flat
 * <name>.md files. Mirrors dsh-skill-filesystem's top-level-only rule.
 * @param {Array<{label: string, path: string, rank: number}>} roots
 */
export function discoverLocalSkills(roots) {
  const out = []
  const seen = new Set()
  for (const root of roots) {
    let names
    try {
      names = readdirSync(root.path)
    } catch {
      continue
    }
    names.sort()
    for (const entry of names) {
      if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue
      const abs = join(root.path, entry)
      let st
      try {
        st = statSync(abs)
      } catch {
        continue
      }
      let mdPath = null
      if (st.isDirectory()) {
        const candidate = join(abs, 'SKILL.md')
        if (existsSync(candidate)) mdPath = candidate
        else continue
      } else if (st.isFile() && entry.toLowerCase().endsWith('.md')) {
        mdPath = abs
      } else {
        continue
      }
      let text
      try {
        text = readFileSync(mdPath, 'utf8').slice(0, 65536)
      } catch {
        continue
      }
      const fm = parseFrontmatter(text)
      if (!fm || typeof fm.name !== 'string' || !SKILL_NAME.test(fm.name)) continue
      const description = typeof fm.description === 'string' ? fm.description : ''
      if (description === '') continue
      if (seen.has(fm.name)) continue
      seen.add(fm.name)
      const info = collectSkillFiles(mdPath)
      out.push({
        name: fm.name,
        description,
        whenToUse: typeof fm.whenToUse === 'string' ? fm.whenToUse : undefined,
        provider: 'filesystem',
        source: root.label,
        rank: root.rank,
        path: mdPath,
        dir: info && info.dir ? info.dir : dirname(mdPath),
        root: root.label,
        rootPath: root.path,
        invocation: {
          modelInvocable: truthy(fm['disable-model-invocation']) !== true,
          userInvocable: truthy(fm['user-invocable']) !== false,
        },
        metadata: undefined,
        fileCount: info ? info.files.length : 0,
        bytes: info ? info.bytes : 0,
        isBundle: info ? info.isBundle : false,
        truncated: info ? info.truncated : false,
        exists: info !== null,
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* plugin                                                              */
/* ------------------------------------------------------------------ */

function log(profileDir, message) {
  try {
    mkdirSync(profileDir, { recursive: true })
    appendFileSync(join(profileDir, 'skill-panel.log'), new Date().toISOString() + ' ' + message + '\n')
  } catch {
    /* diagnostics only */
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    request.on('data', (chunk) => {
      total += chunk.length
      if (total > BODY_LIMIT_BYTES) {
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
  sendJson(response, 400, { ok: false, error: String(error && error.message ? error.message : error) })
}

function summarize(summary, roots) {
  let info = null
  try {
    info = collectSkillFiles(summary.path)
  } catch {
    info = null
  }
  const dir = info ? (info.dir || dirname(summary.path)) : (summary.path ? dirname(summary.path) : null)
  let rootLabel = ''
  let rootPath = ''
  if (dir) {
    for (const r of roots) {
      if (dir === r.path || dir.startsWith(r.path + sep)) {
        rootLabel = r.label
        rootPath = r.path
        break
      }
    }
  }
  return {
    name: summary.name,
    description: summary.description,
    whenToUse: summary.whenToUse,
    provider: summary.provider,
    source: summary.source,
    rank: summary.rank,
    path: summary.path || null,
    dir,
    root: rootLabel,
    rootPath: rootPath || null,
    invocation: summary.invocation || null,
    metadata: summary.metadata || null,
    fileCount: info ? info.files.length : 0,
    bytes: info ? info.bytes : 0,
    isBundle: info ? info.isBundle : false,
    truncated: info ? info.truncated : false,
    exists: info !== null,
    embedded: !summary.path,
  }
}

export function apply(ctx) {
  const profile = ctx.get('profileContext')
  const profileDir = profile && typeof profile.dir === 'string' ? profile.dir : process.cwd()

  // Refresh the served client bundle after a profile reload so UI changes in
  // client.js apply without restarting the whole host. No-op when unchanged.
  try {
    const clientModules = ctx.get('clientModules')
    if (clientModules && typeof clientModules.rebuilt === 'function') clientModules.rebuilt('dsh-skill-panel')
  } catch (error) {
    log(profileDir, 'clientModules.rebuilt failed: ' + error)
  }

  const rootsFromConfig = () => {
    const loader = ctx.get('loader')
    const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
    const agentsHome = process.env.DSH_AGENTS_HOME || join(homedir(), '.agents')
    let config = {}
    try {
      if (loader && typeof loader.entries === 'function') {
        for (const entry of loader.entries()) {
          const entryName = entry && entry.options && entry.options.name
          if (typeof entryName === 'string' && entryName.includes('dsh-skill-filesystem')) {
            config = entry.options.config && typeof entry.options.config === 'object' ? entry.options.config : {}
            break
          }
        }
      }
    } catch {
      config = {}
    }
    const includeDefaultRoots = config.includeDefaultRoots !== false
    const roots = []
    if (includeDefaultRoots) {
      roots.push({ label: 'user-dsh', path: join(typeof config.dshHome === 'string' ? config.dshHome : dshHome, 'skills'), rank: 400 })
      roots.push({ label: 'user-agents', path: join(typeof config.agentsHome === 'string' ? config.agentsHome : agentsHome, 'skills'), rank: 500 })
    }
    if (Array.isArray(config.customSkillDirs)) {
      for (const dir of config.customSkillDirs) {
        if (typeof dir === 'string' && dir !== '') roots.push({ label: 'custom', path: dir, rank: 300 })
      }
    }
    if (typeof config.bundledSkillDir === 'string' && config.bundledSkillDir !== '') {
      roots.push({ label: 'bundled', path: config.bundledSkillDir, rank: 600 })
    }
    return roots
  }

  const listSkills = async () => {
    const roots = rootsFromConfig()
    const byName = new Map()
    for (const local of discoverLocalSkills(roots)) byName.set(local.name, local)

    const skills = ctx.get('skills')
    if (skills && typeof skills.list === 'function') {
      try {
        const summaries = await skills.list({})
        for (const summary of summaries) {
          const existing = byName.get(summary.name)
          if (existing) {
            if (typeof summary.description === 'string' && summary.description !== '') existing.description = summary.description
            if (typeof summary.provider === 'string') existing.provider = summary.provider
            if (summary.invocation) existing.invocation = summary.invocation
            existing.inRegistry = true
          } else {
            byName.set(summary.name, summarize(summary, roots))
          }
        }
      } catch (error) {
        log(profileDir, 'ctx.skills.list failed, using local scan only: ' + error)
      }
    }
    const merged = [...byName.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    return { roots, skills: merged }
  }

  const stateRoute = async (request, response) => {
    try {
      const { roots, skills } = await listSkills()
      const totals = {
        skills: skills.length,
        modelInvocable: skills.filter((s) => !s.invocation || s.invocation.modelInvocable !== false).length,
        userInvocable: skills.filter((s) => !s.invocation || s.invocation.userInvocable !== false).length,
        bytes: skills.reduce((sum, s) => sum + s.bytes, 0),
        missing: skills.filter((s) => !s.exists && !s.embedded).length,
      }
      let clientBundlePath = null
      try {
        const clientModules = ctx.get('clientModules')
        if (clientModules && typeof clientModules.clientPath === 'function') clientBundlePath = clientModules.clientPath('dsh-skill-panel') || null
      } catch {
        clientBundlePath = null
      }
      sendJson(response, 200, { ok: true, roots, skills, totals, clientBundlePath })
    } catch (error) {
      log(profileDir, 'state failed: ' + (error && error.stack ? error.stack : error))
      sendJson(response, 500, { ok: false, error: String(error && error.message ? error.message : error) })
    }
  }

  const bodyRoute = async (request, response) => {
    const raw = await readBody(request)
    let payload
    try {
      payload = JSON.parse(raw || '{}')
    } catch {
      return sendError(response, new Error('请求体不是合法 JSON'))
    }
    const { roots, skills } = await listSkills()
    void roots
    const skill = skills.find((item) => item.name === payload.name)
    if (!skill) return sendError(response, new Error('找不到 skill：' + String(payload.name)))
    let content = ''
    let truncated = false
    if (skill.path && existsSync(skill.path)) {
      const buf = readFileSync(skill.path)
      if (buf.length > CONTENT_PREVIEW_BYTES) {
        content = buf.subarray(0, CONTENT_PREVIEW_BYTES).toString('utf8')
        truncated = true
      } else {
        content = buf.toString('utf8')
      }
    }
    const info = skill.path ? collectSkillFiles(skill.path) : null
    sendJson(response, 200, {
      ok: true,
      skill: Object.assign({}, skill, { content, contentTruncated: truncated }),
      files: info ? info.files.map((file) => ({ rel: file.rel, size: file.size })) : [],
      filesTruncated: info ? info.truncated : false,
    })
  }

  const revealRoute = async (request, response) => {
    const raw = await readBody(request)
    let payload
    try {
      payload = JSON.parse(raw || '{}')
    } catch {
      return sendError(response, new Error('请求体不是合法 JSON'))
    }
    const { skills } = await listSkills()
    const skill = skills.find((item) => item.name === payload.name)
    if (!skill) return sendError(response, new Error('找不到 skill：' + String(payload.name)))
    if (!skill.dir || !skill.exists) return sendError(response, new Error('该 skill 没有可打开的本地目录'))
    const dir = resolve(skill.dir)
    const rootPath = skill.rootPath ? resolve(skill.rootPath) : null
    if (rootPath && dir !== rootPath && !dir.startsWith(rootPath + sep)) {
      return sendError(response, new Error('拒绝打开技能目录之外的路径'))
    }
    if (!existsSync(dir)) return sendError(response, new Error('目录不存在：' + dir))
    await openDirectory(dir)
    log(profileDir, 'opened directory: ' + dir)
    sendJson(response, 200, { ok: true, opened: dir })
  }

  const exportRoute = async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://x')
      const all = url.searchParams.get('all') === '1'
      const names = (url.searchParams.get('names') || '').split(',').map((name) => name.trim()).filter(Boolean)
      const { skills } = await listSkills()
      let selected = all ? skills : skills.filter((skill) => names.includes(skill.name))
      selected = selected.filter((skill) => skill.path && existsSync(skill.path))
      if (selected.length === 0) return sendError(response, new Error('没有可导出的 skill'))
      if (selected.length > MAX_SKILLS_PER_EXPORT) {
        return sendError(response, new Error('一次最多导出 ' + MAX_SKILLS_PER_EXPORT + ' 个 skill'))
      }
      const entries = []
      const manifest = []
      let totalBytes = 0
      for (const skill of selected) {
        const info = collectSkillFiles(skill.path)
        if (!info) continue
        for (const file of info.files) {
          totalBytes += file.size
          if (totalBytes > MAX_TOTAL_EXPORT_BYTES) return sendError(response, new Error('导出内容超过 200MB 上限'))
          entries.push({ name: skill.name + '/' + file.rel, data: readFileSync(file.abs) })
        }
        manifest.push({
          name: skill.name,
          description: skill.description,
          provider: skill.provider,
          source: skill.source,
          root: skill.root,
          path: skill.path,
          files: info.files.map((file) => file.rel),
          bytes: info.bytes,
        })
      }
      entries.push({ name: '_manifest.json', data: Buffer.from(JSON.stringify({ exportedAt: new Date().toISOString(), skills: manifest }, null, 2) + '\n', 'utf8') })
      const zip = zipArchive(entries)
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const filename = (all ? 'all-skills' : selected.length === 1 ? selected[0].name : 'selected-skills') + '-' + stamp + '.zip'
      response.statusCode = 200
      response.setHeader('content-type', 'application/zip')
      response.setHeader('content-disposition', 'attachment; filename="' + filename.replace(/[^\w.-]+/g, '_') + '"')
      response.setHeader('cache-control', 'no-store')
      response.end(zip)
      log(profileDir, 'exported ' + selected.length + ' skill(s), ' + entries.length + ' file(s), ' + zip.length + ' bytes')
    } catch (error) {
      log(profileDir, 'export failed: ' + (error && error.stack ? error.stack : error))
      sendJson(response, 500, { ok: false, error: String(error && error.message ? error.message : error) })
    }
  }

  ctx.inject(['webServer', 'loader'], (host) => {
    const webServer = host.webServer || ctx.get('webServer')
    if (!webServer || typeof webServer.register !== 'function') {
      log(profileDir, 'webServer unavailable; routes not mounted')
      return
    }
    const unregister = []
    const register = (path, handler) => unregister.push(webServer.register({ kind: 'exact', path, handler }))
    register('/dsh-skill-panel/state', (request, response) => {
      stateRoute(request, response).catch((error) => {
        log(profileDir, 'state failed: ' + (error && error.stack ? error.stack : error))
        sendJson(response, 500, { ok: false, error: String(error && error.message ? error.message : error) })
      })
    })
    register('/dsh-skill-panel/body', (request, response) => {
      bodyRoute(request, response).catch((error) => sendError(response, error))
    })
    register('/dsh-skill-panel/export', (request, response) => {
      exportRoute(request, response).catch((error) => sendError(response, error))
    })
    register('/dsh-skill-panel/reveal', (request, response) => {
      revealRoute(request, response).catch((error) => sendError(response, error))
    })
    log(profileDir, 'routes mounted')
    ctx.effect(() => () => {
      for (const off of unregister) {
        try {
          off()
        } catch {
          /* ignore */
        }
      }
    }, 'dsh-skill-panel routes')
  })
}
