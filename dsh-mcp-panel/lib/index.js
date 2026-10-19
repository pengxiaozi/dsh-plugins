/**
 * dsh-mcp-panel — host half.
 *
 * 在 DSH 设置里提供「MCP 连接」面板所需要的数据与写操作：
 *  - 托管连接：侧车文件 <profile>/mcp-panel.json 是唯一真相；
 *    保存时同步生成 cordis.patch.yml 里的托管区块（带标记注释），由 profile HMR 重载生效。
 *  - 配置连接：profile 里其它 @deepseek-ai/dsh-mcp-client 行，用 configEditor 就地编辑。
 *  - 状态 / 工具数：从 ctx.tools 的 schemas 里按 mcp__<serverName>__ 前缀统计。
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'dsh-mcp-panel'

const MCP_CLIENT_PKG = '@deepseek-ai/dsh-mcp-client'
const MANAGED_ID_PREFIX = 'mcp-panel-'
const MARK_START = '# >>> dsh-mcp-panel managed (auto-generated - use Settings > MCP panel) >>>'
const MARK_END = '# <<< dsh-mcp-panel managed <<<'
const BLOCK_RE = /# >>> dsh-mcp-panel managed[\s\S]*?# <<< dsh-mcp-panel managed <<<\n?/g
const BODY_LIMIT_BYTES = 1024 * 1024
const TRANSPORTS = ['streamable-http', 'stdio']
const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/

/* ------------------------------------------------------------------ */
/* pure helpers (also exported for tests)                              */
/* ------------------------------------------------------------------ */

/** YAML scalar: JSON string is a valid YAML double-quoted scalar. */
function q(value) {
  return JSON.stringify(String(value))
}

/** Normalize + validate one MCP server entry; throws with a Chinese message. */
export function normalizeServer(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('服务器配置必须是对象')
  }
  const serverName = String(input.serverName ?? '').trim()
  if (!SERVER_NAME_RE.test(serverName)) {
    throw new Error('serverName 必须是 1-32 位字母、数字、下划线或连字符')
  }
  const transport = String(input.transport ?? 'streamable-http')
  if (!TRANSPORTS.includes(transport)) {
    throw new Error('transport 只支持 streamable-http 或 stdio')
  }
  const out = { serverName, transport }
  if (transport === 'stdio') {
    const command = String(input.command ?? '').trim()
    if (!command) throw new Error('stdio 模式必须填写 command')
    out.command = command
    const args = input.args
    if (args !== undefined && args !== null) {
      if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
        throw new Error('args 必须是字符串数组')
      }
      out.args = args.map((a) => String(a))
    }
    if (input.env && typeof input.env === 'object' && !Array.isArray(input.env)) {
      const env = {}
      for (const [k, v] of Object.entries(input.env)) {
        if (typeof v !== 'string') throw new Error('env 的值必须是字符串')
        env[String(k)] = v
      }
      if (Object.keys(env).length > 0) out.env = env
    }
  } else {
    const url = String(input.url ?? '').trim()
    if (!/^https?:\/\/\S+$/i.test(url)) {
      throw new Error('streamable-http 模式的 url 必须以 http:// 或 https:// 开头')
    }
    out.url = url
    if (input.headers && typeof input.headers === 'object' && !Array.isArray(input.headers)) {
      const headers = {}
      for (const [k, v] of Object.entries(input.headers)) {
        if (typeof v !== 'string') throw new Error('headers 的值必须是字符串')
        headers[String(k)] = v
      }
      if (Object.keys(headers).length > 0) out.headers = headers
    }
  }
  return out
}

/** Validate a whole managed list (dedupe by serverName). */
export function normalizeServerList(list) {
  if (!Array.isArray(list)) throw new Error('servers 必须是数组')
  const seen = new Set()
  const out = []
  for (const item of list) {
    const server = normalizeServer(item)
    if (seen.has(server.serverName)) throw new Error('serverName 重复：' + server.serverName)
    seen.add(server.serverName)
    out.push(server)
  }
  out.sort((a, b) => a.serverName.localeCompare(b.serverName))
  return out
}

export function managedRowId(serverName, index) {
  const slug = String(serverName)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28)
  return MANAGED_ID_PREFIX + (slug || 'server') + (index === undefined ? '' : '-' + index)
}

/** Render the managed patch block for a server list ('' for an empty list). */
export function renderManagedBlock(servers) {
  if (!servers || servers.length === 0) return ''
  const rows = servers.map((server, index) => {
    const lines = []
    lines.push('    - id: ' + q(managedRowId(server.serverName, index)))
    lines.push('      name: ' + q(MCP_CLIENT_PKG))
    lines.push('      config:')
    lines.push('        serverName: ' + q(server.serverName))
    lines.push('        transport: ' + q(server.transport))
    if (server.transport === 'stdio') {
      lines.push('        command: ' + q(server.command))
      if (Array.isArray(server.args) && server.args.length > 0) {
        lines.push('        args:')
        for (const arg of server.args) lines.push('          - ' + q(arg))
      }
      if (server.env && Object.keys(server.env).length > 0) {
        lines.push('        env:')
        for (const [k, v] of Object.entries(server.env)) lines.push('          ' + q(k) + ': ' + q(v))
      }
    } else {
      lines.push('        url: ' + q(server.url))
      if (server.headers && Object.keys(server.headers).length > 0) {
        lines.push('        headers:')
        for (const [k, v] of Object.entries(server.headers)) lines.push('          ' + q(k) + ': ' + q(v))
      }
    }
    return lines.join('\n')
  })
  return MARK_START + '\n- insert:\n' + rows.join('\n') + '\n' + MARK_END
}

/** Replace (or insert) the managed block inside the profile patch text. */
export function applyManagedBlock(patchText, block) {
  const source = typeof patchText === 'string' ? patchText : ''
  const matches = source.match(BLOCK_RE)
  if (matches && matches.length > 0) {
    let first = true
    return source.replace(BLOCK_RE, () => {
      if (first) {
        first = false
        return block ? block + '\n' : ''
      }
      return ''
    })
  }
  if (!block) return source
  const sep = source === '' || source.endsWith('\n') ? '' : '\n'
  return source + sep + block + '\n'
}

/** Where a managed server's tool names start. */
export function toolPrefix(serverName) {
  return 'mcp__' + serverName + '__'
}

/* ------------------------------------------------------------------ */
/* runtime                                                             */
/* ------------------------------------------------------------------ */

function log(profileDir, message) {
  try {
    const file = join(profileDir, 'mcp-panel.log')
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, new Date().toISOString() + ' ' + message + '\n', { flag: 'a' })
  } catch {
    /* diagnostics only */
  }
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeFileAtomic(file, text) {
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(tmp, text)
  renameSync(tmp, file)
}

function readSidecar(file) {
  const data = readJsonFile(file, null)
  if (data === null || typeof data !== 'object' || !Array.isArray(data.servers)) return { servers: [] }
  const servers = []
  for (const raw of data.servers) {
    try {
      servers.push(normalizeServer(raw))
    } catch {
      /* skip invalid persisted rows */
    }
  }
  servers.sort((a, b) => a.serverName.localeCompare(b.serverName))
  return { servers }
}

function writeSidecar(file, servers) {
  writeFileAtomic(file, JSON.stringify({ version: 1, servers }, null, 2) + '\n')
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

export function apply(ctx) {
  const profile = ctx.get('profileContext')
  if (!profile || typeof profile.dir !== 'string') {
    log(process.cwd(), 'profileContext unavailable; host half disabled')
    return
  }
  const profileDir = profile.dir
  const sidecarPath = join(profileDir, 'mcp-panel.json')
  const patchPath = profile.patchPath || join(profileDir, 'cordis.patch.yml')

  const state = () => {
    const loader = ctx.get('loader')
    const tools = ctx.get('tools')
    const configEditor = ctx.get('configEditor')

    const sidecar = readSidecar(sidecarPath)
    const managedNames = new Set(sidecar.servers.map((s) => s.serverName))

    // tool names, grouped per MCP server
    const byServer = new Map()
    let totalTools = 0
    if (tools && typeof tools.schemas === 'function') {
      try {
        for (const schema of tools.schemas()) {
          const toolName = schema && schema.name
          if (typeof toolName !== 'string' || !toolName.startsWith('mcp__')) continue
          totalTools += 1
          const rest = toolName.slice('mcp__'.length)
          const sep = rest.indexOf('__')
          if (sep <= 0) continue
          const server = rest.slice(0, sep)
          const list = byServer.get(server) || []
          list.push(toolName)
          byServer.set(server, list)
        }
      } catch (error) {
        log(profileDir, 'tools.schemas() failed: ' + error)
      }
    }

    const statusOf = (serverName) => {
      const list = byServer.get(serverName) || []
      return { toolCount: list.length, tools: list.slice(0, 12), connected: list.length > 0 }
    }

    // external rows: addressable profile rows created by something else than this panel
    const external = []
    const seen = new Set()
    const collect = (entry) => {
      const options = entry && entry.options
      if (!options) return
      const id = options.id
      const entryName = String(options.name || '')
      if (!id || !entryName.includes('dsh-mcp-client')) return
      if (String(id).startsWith(MANAGED_ID_PREFIX)) return
      if (seen.has(id)) return
      seen.add(id)
      const config = options.config && typeof options.config === 'object' ? options.config : {}
      const serverName = String(config.serverName || id)
      external.push({
        id,
        source: 'profile',
        serverName,
        transport: config.transport || 'streamable-http',
        url: config.url,
        command: config.command,
        args: Array.isArray(config.args) ? config.args : undefined,
        config,
        status: statusOf(serverName),
        editable: !!configEditor,
      })
    }
    try {
      const addressable = configEditor && typeof configEditor.entries === 'function' ? configEditor.entries() : null
      if (addressable) for (const entry of addressable) collect(entry)
      else if (loader && typeof loader.entries === 'function') for (const entry of loader.entries()) collect(entry)
    } catch (error) {
      log(profileDir, 'enumerate entries failed: ' + error)
    }

    const managed = sidecar.servers.map((server) => ({
      id: managedRowId(server.serverName),
      source: 'managed',
      ...server,
      status: statusOf(server.serverName),
      editable: true,
    }))

    let clientBundlePath = null
    try {
      const clientModules = ctx.get('clientModules')
      if (clientModules && typeof clientModules.clientPath === 'function') clientBundlePath = clientModules.clientPath('dsh-mcp-panel') || null
    } catch (error) {
      log(profileDir, 'clientModules clientPath failed: ' + error)
    }

    return {
      ok: true,
      profile: { name: profile.name, dir: profileDir, patchPath },
      clientBundlePath,
      servers: [...managed, ...external],
      totals: {
        servers: managed.length + external.length,
        managed: managed.length,
        external: external.length,
        tools: totalTools,
      },
      hasConfigEditor: !!configEditor,
    }
  }

  const writeManaged = (servers) => {
    writeSidecar(sidecarPath, servers)
    const block = renderManagedBlock(servers)
    let current = ''
    try {
      current = readFileSync(patchPath, 'utf8')
    } catch {
      current = ''
    }
    const next = applyManagedBlock(current, block)
    if (next !== current) writeFileAtomic(patchPath, next)
    log(profileDir, 'managed servers written: ' + servers.map((s) => s.serverName).join(', '))
  }

  const saveManaged = async (request, response) => {
    const raw = await readBody(request)
    let payload
    try {
      payload = JSON.parse(raw || '{}')
    } catch {
      return sendError(response, new Error('请求体不是合法 JSON'))
    }
    let servers
    try {
      servers = normalizeServerList(payload.servers)
    } catch (error) {
      return sendError(response, error)
    }
    beforeWrite()
    writeManaged(servers)
    sendJson(response, 200, { ok: true, servers })
    afterWrite()
  }

  const saveExternal = async (request, response) => {
    const configEditor = ctx.get('configEditor')
    const raw = await readBody(request)
    let payload
    try {
      payload = JSON.parse(raw || '{}')
    } catch {
      return sendError(response, new Error('请求体不是合法 JSON'))
    }
    if (!configEditor || typeof configEditor.edit !== 'function' || typeof configEditor.entries !== 'function') {
      return sendError(response, new Error('当前 profile 没有可用的 configEditor，无法编辑 profile 行'))
    }
    let config
    try {
      config = normalizeServer(payload.config || {})
    } catch (error) {
      return sendError(response, error)
    }
    const id = String(payload.id || '')
    const entry = configEditor.entries().find((e) => e && e.options && e.options.id === id)
    if (!entry) return sendError(response, new Error('找不到 id 为 ' + id + ' 的配置行'))
    beforeWrite()
    await configEditor.edit(entry, () => config)
    sendJson(response, 200, { ok: true })
    afterWrite()
  }

  let reloadTimer = null
  const beforeWrite = () => {}
  const afterWrite = () => {
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => {
      reloadTimer = null
      log(profileDir, 'write settled')
    }, 2000)
  }

  ctx.inject(['webServer'], (host) => {
    const webServer = host.webServer || ctx.get('webServer')
    if (!webServer || typeof webServer.register !== 'function') {
      log(profileDir, 'webServer service unavailable; routes not mounted')
      return
    }
    const unregister = []
    const register = (path, handler) => {
      unregister.push(webServer.register({ kind: 'exact', path, handler }))
    }
    register('/dsh-mcp-panel/state', (request, response) => {
      try {
        sendJson(response, 200, state())
      } catch (error) {
        log(profileDir, 'state failed: ' + (error && error.stack ? error.stack : error))
        sendJson(response, 500, { ok: false, error: String(error && error.message ? error.message : error) })
      }
    })
    register('/dsh-mcp-panel/save-managed', (request, response) => {
      saveManaged(request, response).catch((error) => {
        log(profileDir, 'save-managed failed: ' + (error && error.stack ? error.stack : error))
        sendError(response, error)
      })
    })
    register('/dsh-mcp-panel/save-external', (request, response) => {
      saveExternal(request, response).catch((error) => {
        log(profileDir, 'save-external failed: ' + (error && error.stack ? error.stack : error))
        sendError(response, error)
      })
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
    }, 'dsh-mcp-panel routes')
  })
}
