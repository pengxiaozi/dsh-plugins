/**
 * dsh-sensitive-mask — host half.
 *
 * 双向拦截：
 *  - AI 读：用户输入（agent/pre-step）与工具结果（tools/post-execute）在写入会话前按规则脱敏；
 *    脱敏样式可配置：占位符（可还原）/ 部分隐藏（138****8000）/ 固定文本（***）。
 *  - AI 写：工具执行前（tools/pre-execute）把参数里的占位符还原成真实值；会话历史里始终只保存占位符。
 * 规则与日志都留在本机 profile：<profile>/sensitive-mask.json 与 <profile>/sensitive-mask/logs/*.jsonl
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'

export const name = 'dsh-sensitive-mask'

const CONFIG_FILE = 'sensitive-mask.json'
const LOG_DIR = 'sensitive-mask/logs'
const MAX_PLACEHOLDERS = 20000
const MAX_MATCHES_PER_TEXT = 500
const BODY_LIMIT_BYTES = 1024 * 1024

/* ------------------------------------------------------------------ */
/* defaults                                                            */
/* ------------------------------------------------------------------ */

export const PRESETS = [
  { id: 'preset-phone', name: '手机号', type: 'regex', pattern: '(?<!\\d)1[3-9]\\d{9}(?!\\d)', replacement: '手机号', flags: 'g', enabled: true },
  { id: 'preset-idcard', name: '身份证号', type: 'regex', pattern: '(?<!\\d)\\d{17}[\\dXx](?!\\d)', replacement: '证件号', flags: 'g', enabled: true },
  { id: 'preset-bankcard', name: '银行卡号', type: 'regex', pattern: '(?<!\\d)\\d{16,19}(?!\\d)', replacement: '银行卡号', flags: 'g', enabled: true },
  { id: 'preset-email', name: '邮箱', type: 'regex', pattern: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', replacement: '邮箱', flags: 'g', enabled: true },
]

export function defaultConfig() {
  return {
    version: 1,
    enabled: true,
    maskUserInput: true,
    maskToolResults: true,
    demaskModelOutput: true,
    maskStyle: 'placeholder',
    logOriginals: false,
    rules: PRESETS.map((rule) => Object.assign({}, rule)),
  }
}

/* ------------------------------------------------------------------ */
/* config                                                              */
/* ------------------------------------------------------------------ */

const REGEX_SPECIALS = '.*+?^${()[]{}|\\'

function escapeRegExp(text) {
  let out = ''
  for (const ch of String(text)) out += REGEX_SPECIALS.includes(ch) ? '\\' + ch : ch
  return out
}

export function normalizeRule(raw, index) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('规则必须是对象')
  const type = raw.type === 'literal' ? 'literal' : 'regex'
  const pattern = String(raw.pattern === undefined ? '' : raw.pattern).trim()
  if (pattern === '') throw new Error('规则 #' + (index + 1) + ' 缺少匹配内容')
  if (type === 'regex') {
    try {
      new RegExp(pattern)
    } catch (error) {
      throw new Error('规则 #' + (index + 1) + ' 正则无效：' + (error && error.message ? error.message : error))
    }
  }
  const replacement = String(raw.replacement === undefined ? '' : raw.replacement).trim() || '掩码'
  return {
    id: String(raw.id === undefined ? 'r' + (index + 1) : raw.id),
    name: String(raw.name === undefined ? replacement : raw.name).trim() || replacement,
    type,
    pattern,
    replacement,
    flags: String(raw.flags === undefined ? 'g' : raw.flags),
    style: raw.style === 'partial' || raw.style === 'fixed' || raw.style === 'placeholder' ? raw.style : 'inherit',
    keepHead: clampKeep(raw.keepHead, 3),
    keepTail: clampKeep(raw.keepTail, 4),
    enabled: raw.enabled !== false,
  }
}

export function normalizeConfig(raw) {
  const base = defaultConfig()
  if (raw === null || typeof raw !== 'object') return base
  const rules = Array.isArray(raw.rules) ? raw.rules.map((rule, index) => normalizeRule(rule, index)) : base.rules
  return {
    version: 1,
    enabled: raw.enabled !== false,
    maskUserInput: raw.maskUserInput !== false,
    maskToolResults: raw.maskToolResults !== false,
    demaskModelOutput: raw.demaskModelOutput !== false,
    maskStyle: raw.maskStyle === 'partial' || raw.maskStyle === 'fixed' ? raw.maskStyle : 'placeholder',
    logOriginals: raw.logOriginals === true,
    rules,
  }
}

/* ------------------------------------------------------------------ */
/* placeholder mapping + masking                                       */
/* ------------------------------------------------------------------ */

const placeholderToOriginal = new Map()
const ruleCache = new Map()
const ruleCounters = new Map()

export function placeholderCount() {
  return placeholderToOriginal.size
}

function placeholderFor(rule, original) {
  const key = rule.id + '|' + rule.type + '|' + rule.pattern + '|' + rule.replacement
  let map = ruleCache.get(key)
  if (map === undefined) {
    map = new Map()
    ruleCache.set(key, map)
  }
  const existing = map.get(original)
  if (existing !== undefined) return existing
  let seq = (ruleCounters.get(key) || 0) + 1
  const label = rule.replacement.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').slice(0, 20) || 'MASK'
  let placeholder = '[[' + label + '#' + seq + ']]'
  while (placeholderToOriginal.has(placeholder)) {
    seq += 1
    placeholder = '[[' + label + '#' + seq + ']]'
  }
  ruleCounters.set(key, seq)
  map.set(original, placeholder)
  placeholderToOriginal.set(placeholder, original)
  if (placeholderToOriginal.size > MAX_PLACEHOLDERS) {
    const oldest = placeholderToOriginal.keys().next().value
    if (oldest !== undefined) placeholderToOriginal.delete(oldest)
  }
  return placeholder
}

function hitOf(rule, original, display, options, style) {
  return {
    ruleId: rule.id,
    rule: rule.name,
    type: rule.type,
    style: style || 'placeholder',
    placeholder: display,
    length: original.length,
    hash: createHash('sha256').update(original).digest('hex').slice(0, 12),
    original: options && options.logOriginals === true ? original : undefined,
  }
}

/**
 * Apply every enabled rule to one text. Returns the masked text and hit records.
 * @param {string} text
 * @param {object} config
 * @param {{logOriginals?: boolean, maxMatches?: number}} [options]
 */
function clampKeep(value, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(12, Math.max(0, Math.floor(num)))
}

/** 某条规则最终生效的脱敏样式：规则覆盖优先，否则跟全局。 */
function ruleStyle(rule, config) {
  if (rule.style === 'placeholder' || rule.style === 'partial' || rule.style === 'fixed') return rule.style
  if (config && (config.maskStyle === 'partial' || config.maskStyle === 'fixed')) return config.maskStyle
  return 'placeholder'
}

/** 部分隐藏：保留头尾字符，中间用 * 覆盖；太短则整体隐藏。 */
function partialMask(text, rule) {
  const head = clampKeep(rule.keepHead, 3)
  const tail = clampKeep(rule.keepTail, 4)
  if (text.length <= head + tail) return '*'.repeat(Math.max(1, text.length))
  return text.slice(0, head) + '*'.repeat(text.length - head - tail) + text.slice(-tail)
}

/**
 * Apply every enabled rule to one text. Returns the masked text and hit records.
 * 样式：placeholder（可还原）/ partial（部分隐藏）/ fixed（固定文本）。
 * @param {string} text
 * @param {object} config
 * @param {{logOriginals?: boolean, maxMatches?: number}} [options]
 */
export function maskText(text, config, options = {}) {
  const source = String(text === undefined || text === null ? '' : text)
  if (!config || config.enabled === false || source === '') return { text: source, hits: [] }
  const limit = options.maxMatches || MAX_MATCHES_PER_TEXT
  let out = source
  const hits = []
  const applyRule = (rule, regex) => {
    let count = 0
    out = out.replace(regex, (match) => {
      if (count >= limit) return match
      count += 1
      const style = ruleStyle(rule, config)
      const display = style === 'partial' ? partialMask(match, rule) : style === 'fixed' ? rule.replacement : placeholderFor(rule, match)
      hits.push(hitOf(rule, match, display, options, style))
      return display
    })
  }
  for (const rule of config.rules || []) {
    if (!rule.enabled) continue
    if (rule.type === 'literal') {
      applyRule(rule, new RegExp(escapeRegExp(rule.pattern), 'g'))
      continue
    }
    let re
    try {
      re = new RegExp(rule.pattern, rule.flags && rule.flags.includes('g') ? rule.flags : rule.flags + 'g')
    } catch {
      continue
    }
    applyRule(rule, re)
  }
  return { text: out, hits }
}

/**
 * Mask text content blocks; non-text blocks and unchanged text pass through.
 */
export function maskBlocks(blocks, config, options = {}) {
  if (!Array.isArray(blocks)) return { blocks, hits: [] }
  let changed = false
  const hits = []
  const out = blocks.map((block) => {
    if (!block || block.type !== 'text' || typeof block.text !== 'string') return block
    const result = maskText(block.text, config, options)
    if (result.text === block.text) return block
    changed = true
    for (const hit of result.hits) hits.push(hit)
    return Object.assign({}, block, { text: result.text })
  })
  return { blocks: changed ? out : blocks, hits }
}

/**
 * Demask a buffered string, holding back a trailing partial placeholder.
 */
export function demaskBuffer(text) {
  const source = String(text === undefined || text === null ? '' : text)
  if (!source.includes('[[')) return { out: source, rest: '' }
  const open = source.lastIndexOf('[[')
  const replaceComplete = (text) => {
    const regex = new RegExp('\\[\\[([^\\[\\]]{1,40})#(\\d+)\\]\\]', 'g')
    return text.replace(regex, (full) => {
      const original = placeholderToOriginal.get(full)
      return original === undefined ? full : original
    })
  }
  if (open >= 0 && source.indexOf(']]', open + 2) < 0) {
    return { out: replaceComplete(source.slice(0, open)), rest: source.slice(open) }
  }
  return { out: replaceComplete(source), rest: '' }
}

/**
 * Wrap an LLM chunk stream and restore placeholders in text/reasoning/tool-call
 * deltas, buffering across chunk boundaries.
 */
export async function* demaskStream(source) {
  const pending = new Map()
  const blockTypes = new Map()
  function deltaChunk(index, text) {
    const blockType = blockTypes.get(index)
    if (blockType === 'tool-call') return { type: 'tool-call-delta', index, argumentsDelta: text }
    if (blockType === 'reasoning') return { type: 'reasoning-delta', index, text }
    return { type: 'text-delta', index, text }
  }
  for await (const chunk of source) {
    if (chunk === null || typeof chunk !== 'object') {
      yield chunk
      continue
    }
    if (chunk.type === 'block-start') {
      blockTypes.set(chunk.index, chunk.blockType)
      yield chunk
      continue
    }
    if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
      const index = chunk.index === undefined ? 0 : chunk.index
      const buffer = (pending.get(index) || '') + String(chunk.text === undefined ? '' : chunk.text)
      const result = demaskBuffer(buffer)
      if (result.rest === '') pending.delete(index)
      else pending.set(index, result.rest)
      if (result.out === '') continue
      yield Object.assign({}, chunk, { text: result.out })
      continue
    }
    if (chunk.type === 'tool-call-delta') {
      const index = chunk.index === undefined ? 0 : chunk.index
      const buffer = (pending.get(index) || '') + String(chunk.argumentsDelta === undefined ? '' : chunk.argumentsDelta)
      const result = demaskBuffer(buffer)
      if (result.rest === '') pending.delete(index)
      else pending.set(index, result.rest)
      if (result.out === '') continue
      yield Object.assign({}, chunk, { argumentsDelta: result.out })
      continue
    }
    if (chunk.type === 'block-end') {
      const index = chunk.index === undefined ? 0 : chunk.index
      const rest = pending.get(index)
      if (rest !== undefined) {
        pending.delete(index)
        const result = demaskBuffer(rest)
        const flushed = result.out + result.rest
        if (flushed !== '') yield deltaChunk(index, flushed)
      }
      yield chunk
      continue
    }
    if (chunk.type === 'finish') {
      for (const [index, rest] of pending) {
        const result = demaskBuffer(rest)
        const flushed = result.out + result.rest
        if (flushed !== '') yield deltaChunk(index, flushed)
      }
      pending.clear()
      yield chunk
      continue
    }
    yield chunk
  }
  for (const [index, rest] of pending) {
    const result = demaskBuffer(rest)
    const flushed = result.out + result.rest
    if (flushed !== '') yield deltaChunk(index, flushed)
  }
}

/* ------------------------------------------------------------------ */
/* filesystem / logging helpers                                        */
/* ------------------------------------------------------------------ */

const requireFromHere = createRequire(import.meta.url)

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

function dayStamp(date) {
  const d = date || new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export function logFilePath(baseDir, date) {
  return join(baseDir, LOG_DIR, 'mask-' + dayStamp(date) + '.jsonl')
}

function appendHits(baseDir, hits, context, logOriginals) {
  if (hits.length === 0) return
  const file = logFilePath(baseDir, new Date())
  mkdirSync(dirname(file), { recursive: true })
  const stamp = new Date().toISOString()
  const lines = hits.map((hit) => JSON.stringify({
    ts: stamp,
    dir: context.dir || 'unknown',
    source: context.source,
    tool: context.tool,
    file: context.file,
    session: context.session,
    turn: context.turn,
    step: context.step,
    ruleId: hit.ruleId,
    rule: hit.rule,
    type: hit.type,
    style: hit.style || 'placeholder',
    placeholder: hit.placeholder,
    matchLength: hit.length,
    hash: hit.hash,
    original: logOriginals === true ? hit.original : undefined,
  }))
  appendFileSync(file, lines.join('\n') + '\n')
}

function listLogFiles(baseDir) {
  const dir = join(baseDir, LOG_DIR)
  const out = []
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const fileName of names) {
    if (!/^mask-\d{4}-\d{2}-\d{2}\.jsonl$/.test(fileName)) continue
    const full = join(dir, fileName)
    try {
      const st = statSync(full)
      out.push({ name: fileName, size: st.size, mtime: st.mtime.toISOString() })
    } catch {
      /* ignore */
    }
  }
  out.sort((a, b) => (a.name < b.name ? 1 : -1))
  return out
}

function readLogEntries(baseDir, fileName, limit) {
  if (!/^mask-\d{4}-\d{2}-\d{2}\.jsonl$/.test(String(fileName))) throw new Error('非法日志文件名')
  const full = join(baseDir, LOG_DIR, fileName)
  if (!existsSync(full)) throw new Error('日志文件不存在')
  const lines = readFileSync(full, 'utf8').split('\n').filter(Boolean)
  const out = []
  for (let i = lines.length - 1; i >= 0 && out.length < (limit || 200); i -= 1) {
    try {
      out.push(JSON.parse(lines[i]))
    } catch {
      /* skip malformed */
    }
  }
  return out
}

function extractFilePath(args) {
  if (args === null || typeof args !== 'object') return undefined
  for (const key of ['file_path', 'file', 'path', 'filename', 'filepath', 'dir', 'filename1', 'filename2']) {
    if (typeof args[key] === 'string' && args[key] !== '') return args[key]
  }
  return undefined
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

function writeFileAtomic(file, text) {
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(tmp, text)
  renameSync(tmp, file)
}

/** Recursively demask strings inside a JSON-like value. */
export function demaskValue(value) {
  if (typeof value === 'string') return demaskBuffer(value).out
  if (Array.isArray(value)) return value.map((item) => demaskValue(item))
  if (value !== null && typeof value === 'object') {
    const out = {}
    let changed = false
    for (const [key, item] of Object.entries(value)) {
      const next = demaskValue(item)
      if (next !== item) changed = true
      out[key] = next
    }
    return changed ? out : value
  }
  return value
}

/* ------------------------------------------------------------------ */
/* plugin                                                              */
/* ------------------------------------------------------------------ */

export function apply(ctx) {
  const profile = ctx.get('profileContext')
  const profileDir = profile && typeof profile.dir === 'string' ? profile.dir : process.cwd()
  const configPath = join(profileDir, CONFIG_FILE)
  const logDir = join(profileDir, LOG_DIR)

  mkdirSync(logDir, { recursive: true })
  if (!existsSync(configPath)) writeFileAtomic(configPath, JSON.stringify(defaultConfig(), null, 2) + '\n')

  let cache = { mtime: -1, config: null }
  function getConfig() {
    try {
      const st = statSync(configPath)
      if (cache.mtime !== st.mtimeMs || cache.config === null) {
        const parsed = JSON.parse(readFileSync(configPath, 'utf8'))
        cache = { mtime: st.mtimeMs, config: normalizeConfig(parsed) }
      }
    } catch {
      if (cache.config === null) cache = { mtime: -1, config: normalizeConfig(null) }
    }
    return cache.config
  }

  function saveConfig(raw) {
    const config = normalizeConfig(raw)
    writeFileAtomic(configPath, JSON.stringify(config, null, 2) + '\n')
    cache = { mtime: -1, config: null }
    return config
  }

  // 1) AI 读：用户输入在写入会话前打码
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    const config = getConfig()
    if (!config.enabled || !config.maskUserInput || !decision || decision.kind !== 'enter') return decision
    let total = 0
    const messages = decision.messages.map((message) => {
      if (!message || message.role !== 'user' || !Array.isArray(message.content)) return message
      const kind = message.source && message.source.kind
      if (kind !== undefined && kind !== 'user' && kind !== 'agent-message') return message
      const logContext = { dir: 'user-input', source: kind || 'user', turn: payload.turn, step: payload.step }
      const masked = maskBlocks(message.content, config, { logOriginals: config.logOriginals })
      if (masked.hits.length === 0) return message
      total += masked.hits.length
      appendHits(profileDir, masked.hits, logContext, config.logOriginals)
      return Object.assign({}, message, { content: masked.blocks })
    })
    if (total === 0) return decision
    return Object.assign({}, decision, { messages })
  }, { global: true, prepend: true })

  // 2) AI 读：工具结果在进入模型历史前打码
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    const config = getConfig()
    if (!config.enabled || !config.maskToolResults || !decision || decision.kind !== 'accept') return decision
    const content = Object.prototype.hasOwnProperty.call(decision, 'content') ? decision.content : result && result.content
    if (!Array.isArray(content)) return decision
    const logContext = {
      dir: 'tool-result',
      tool: exec && exec.name,
      file: extractFilePath(exec && exec.arguments),
      session: exec && exec.agent && exec.agent.session ? exec.agent.session.id : undefined,
    }
    const masked = maskBlocks(content, config, { logOriginals: config.logOriginals })
    if (masked.hits.length === 0) return decision
    appendHits(profileDir, masked.hits, logContext, config.logOriginals)
    return Object.assign({}, decision, { content: masked.blocks })
  }, { global: true, prepend: true })

  // 3) AI 写：工具执行前把参数里的占位符还原成真实值。
  // 会话历史里始终保存占位符（不把真实值写回日志），真实值只在本地工具执行的那一瞬间出现。
  // 注意：模型的流式输出（llm/stream）在本 harness 的实际调用链上不会命中，不能依赖它还原。
  ctx.on('tools/pre-execute', (exec, next) => {
    const config = getConfig()
    if (!config.enabled || !config.demaskModelOutput || !exec || exec.arguments === undefined) return next()
    try {
      if (!Object.isFrozen(exec)) {
        const demasked = demaskValue(exec.arguments)
        if (demasked !== exec.arguments) exec.arguments = demasked
      }
    } catch {
      /* arguments are deep-frozen on some builds: leave the placeholder in place */
    }
    return next()
  }, { global: true, prepend: true })

  // 4) 注意：不要改写 ctx.llm.prepareCall 返回的对象 —— 它被 Object.freeze 冻结
  // （dsh-llm 的 PreparedLlmCall），给 .stream 赋值会抛
  // "Cannot assign to read only property 'stream'"，届时所有模型请求都会失败。
  // 也无需补丁：prepareCall 内部的 stream 已经由 streamWithRegistration 走 llm/stream 瀑布，
  // 上面的钩子就能覆盖 DeepSeek 适配器。工具参数由 registry 深冻结，同样不能改写。

  // 5) 设置页 API
  ctx.inject(['webServer'], (host) => {
    const webServer = host.webServer || ctx.get('webServer')
    if (!webServer || typeof webServer.register !== 'function') return
    const unregister = []
    const register = (path, handler) => unregister.push(webServer.register({ kind: 'exact', path, handler }))

    register('/dsh-sensitive-mask/state', (request, response) => {
      const config = getConfig()
      const files = listLogFiles(profileDir)
      let todayCount = 0
      try {
        todayCount = readLogEntries(profileDir, 'mask-' + dayStamp(new Date()) + '.jsonl', 100000).length
      } catch {
        todayCount = 0
      }
      sendJson(response, 200, {
        ok: true,
        config,
        placeholders: placeholderCount(),
        todayCount,
        logFiles: files,
        configPath,
        logDir,
      })
    })

    register('/dsh-sensitive-mask/config', async (request, response) => {
      try {
        const raw = await readBody(request)
        let payload
        try {
          payload = JSON.parse(raw || '{}')
        } catch {
          return sendError(response, new Error('请求体不是合法 JSON'))
        }
        const config = saveConfig(payload.config === undefined ? payload : payload.config)
        sendJson(response, 200, { ok: true, config })
      } catch (error) {
        sendError(response, error)
      }
    })

    register('/dsh-sensitive-mask/test', async (request, response) => {
      try {
        const raw = await readBody(request)
        let payload
        try {
          payload = JSON.parse(raw || '{}')
        } catch {
          return sendError(response, new Error('请求体不是合法 JSON'))
        }
        const config = getConfig()
        const result = maskText(String(payload.text || ''), config, { logOriginals: true })
        sendJson(response, 200, {
          ok: true,
          input: String(payload.text || ''),
          output: result.text,
          hits: result.hits.map((hit) => ({
            rule: hit.rule,
            type: hit.type,
            style: hit.style || 'placeholder',
            placeholder: hit.placeholder,
            matchLength: hit.length,
            original: hit.original,
          })),
        })
      } catch (error) {
        sendError(response, error)
      }
    })

    register('/dsh-sensitive-mask/log', (request, response) => {
      try {
        const url = new URL(request.url || '/', 'http://x')
        const file = url.searchParams.get('file')
        if (!file) return sendJson(response, 200, { ok: true, files: listLogFiles(profileDir) })
        const limit = Number(url.searchParams.get('limit') || 200)
        sendJson(response, 200, { ok: true, file, entries: readLogEntries(profileDir, file, Number.isFinite(limit) ? limit : 200) })
      } catch (error) {
        sendError(response, error)
      }
    })

    register('/dsh-sensitive-mask/open-log-dir', (request, response) => {
      openDirectory(logDir).then(
        () => sendJson(response, 200, { ok: true, opened: logDir }),
        (error) => sendError(response, error),
      )
    })

    ctx.effect(() => () => {
      for (const off of unregister) {
        try {
          off()
        } catch {
          /* ignore */
        }
      }
    }, 'dsh-sensitive-mask routes')
  })

  // 6) 客户端 bundle 在 profile 重载后自动重建（无变化时 no-op）
  try {
    const clientModules = ctx.get('clientModules')
    if (clientModules && typeof clientModules.rebuilt === 'function') clientModules.rebuilt(name)
  } catch {
    /* optional host service */
  }
}
