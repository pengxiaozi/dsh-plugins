/**
 * Host-side discovery of the DeepSeek Harness installation plus static
 * extraction of exported constants and schema default values from the shipped
 * packages.
 *
 * Everything here is read-only: files are opened for reading, results are
 * cached in process memory, and no package module is imported, so scanning can
 * never run third-party plugin code.
 */
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'

const SCOPE = '@deepseek-ai'
const MAX_FILE_BYTES = 1024 * 1024
const MAX_TOTAL_BYTES = 32 * 1024 * 1024
const MAX_PACKAGES = 400
const MAX_SCAN_MS = 8000
const MAX_CONSTANTS_PER_PACKAGE = 400
const MAX_DEFAULTS_PER_PACKAGE = 400

function message(error) {
  return error instanceof Error ? error.message : String(error)
}

function pushUnique(target, value) {
  if (typeof value !== 'string' || value.length === 0) return
  if (!target.includes(value)) target.push(value)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function envCandidates() {
  const out = []
  for (const key of ['DSH_NODE_MODULES', 'DSH_APP_NODE_MODULES']) pushUnique(out, process.env[key])
  const nodePath = process.env.NODE_PATH
  if (typeof nodePath === 'string' && nodePath.length > 0) {
    for (const part of nodePath.split(sep === '\\' ? ';' : ':')) pushUnique(out, part)
  }
  return out
}

/** Every plausible `<install>/node_modules` directory, most specific first. */
export function candidateRoots() {
  const out = []
  for (const value of envCandidates()) pushUnique(out, value)
  const resources = /** @type {{ resourcesPath?: unknown }} */ (process).resourcesPath
  if (typeof resources === 'string' && resources.length > 0) {
    pushUnique(out, join(resources, 'app.asar', 'dsh', 'node_modules'))
    pushUnique(out, join(resources, 'app.asar', 'node_modules'))
    pushUnique(out, join(resources, 'app', 'node_modules'))
  }
  const execDir = dirname(process.execPath)
  pushUnique(out, join(execDir, 'resources', 'app.asar', 'dsh', 'node_modules'))
  pushUnique(out, join(execDir, 'resources', 'app.asar', 'node_modules'))
  pushUnique(out, join(execDir, 'resources', 'app', 'node_modules'))
  pushUnique(out, join(execDir, 'node_modules'))
  for (const arg of process.argv) {
    if (typeof arg !== 'string') continue
    const at = arg.indexOf('app.asar')
    if (at <= 0) continue
    const prefix = arg.slice(0, at + 'app.asar'.length)
    pushUnique(out, join(prefix, 'dsh', 'node_modules'))
    pushUnique(out, join(prefix, 'node_modules'))
  }
  try {
    const require = createRequire(import.meta.url)
    const resolved = require.resolve(`${SCOPE}/dsh-system-prompt`)
    let dir = dirname(resolved)
    for (let depth = 0; depth < 5; depth += 1) {
      if (dir.endsWith('node_modules')) {
        pushUnique(out, dir)
        break
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  } catch {}
  return out
}

let rootCache
/** Resolve the installation's `node_modules`, or report every path tried. */
export async function findNodeModules() {
  if (rootCache !== undefined) return rootCache
  const tried = []
  for (const dir of candidateRoots()) {
    tried.push(dir)
    try {
      const entries = await readdir(join(dir, SCOPE))
      if (entries.length > 0) {
        rootCache = { dir, tried }
        return rootCache
      }
    } catch {}
  }
  rootCache = { dir: undefined, tried }
  return rootCache
}

const sourceCache = new Map()
/** Read one shipped package's entry module text (cached, never imported). */
export async function readPackageSource(packageName) {
  const cached = sourceCache.get(packageName)
  if (cached !== undefined) return cached
  const pending = (async () => {
    const root = await findNodeModules()
    if (root.dir === undefined) return { found: false, reason: 'no-install-root' }
    const file = join(root.dir, packageName.split('/').join(sep), 'lib', 'index.js')
    try {
      const source = await readFile(file, 'utf8')
      return { found: true, file, source }
    } catch (error) {
      return { found: false, file, reason: message(error) }
    }
  })()
  sourceCache.set(packageName, pending)
  return pending
}

const fileCache = new Map()
/**
 * Read one file inside a shipped `@deepseek-ai` package. `relativePath` is
 * slash-separated and may not escape the package directory; nothing outside
 * the installation's `@deepseek-ai` scope is reachable.
 */
export async function readPackageFile(packageName, relativePath) {
  const key = `${packageName}\u0000${relativePath}`
  const cached = fileCache.get(key)
  if (cached !== undefined) return cached
  const pending = (async () => {
    const root = await findNodeModules()
    if (root.dir === undefined) return { found: false, reason: 'no-install-root' }
    if (!/^@deepseek-ai\/[A-Za-z0-9._-]+$/.test(packageName)) return { found: false, reason: 'package-not-allowed' }
    const segments = String(relativePath).split('/').filter((part) => part.length > 0)
    if (segments.length === 0 || segments.some((part) => part === '..' || part === '.')) return { found: false, reason: 'invalid-path' }
    const base = join(root.dir, packageName.split('/').join(sep))
    const file = join(base, segments.join(sep))
    if (!file.startsWith(base + sep)) return { found: false, reason: 'path-escape' }
    try {
      const text = await readFile(file, 'utf8')
      return { found: true, file, text }
    } catch (error) {
      return { found: false, file, reason: message(error) }
    }
  })()
  fileCache.set(key, pending)
  return pending
}

/** Line start offsets of one source file, for O(log n) line lookup. */
function lineStarts(source) {
  const starts = [0]
  for (let index = 0; index < source.length; index += 1) if (source.charCodeAt(index) === 10) starts.push(index + 1)
  return starts
}

function lineAt(starts, index) {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (starts[mid] <= index) low = mid
    else high = mid - 1
  }
  return low + 1
}

/**
 * Slice one bracket-balanced region from `source` starting at `start`.
 * String-aware, so braces inside literals do not count.
 * @returns the index of the matching close bracket, or -1.
 */
export function matchBalanced(source, start, open, close) {
  let depth = 0
  let quote = ''
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (quote !== '') {
      if (char === '\\') {
        index += 1
        continue
      }
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === open) depth += 1
    else if (char === close) {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

/**
 * Read one top-level initializer expression: stops at a top-level `;` or a
 * newline at depth 0.
 */
function readExpression(source, start, limit = 20000) {
  const end = Math.min(source.length, start + limit)
  let depth = 0
  let quote = ''
  for (let index = start; index < end; index += 1) {
    const char = source[index]
    if (quote !== '') {
      if (char === '\\') {
        index += 1
        continue
      }
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '{' || char === '[' || char === '(') {
      depth += 1
      continue
    }
    if (char === '}' || char === ']' || char === ')') {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (depth === 0 && char === ';') return source.slice(start, index)
    if (depth === 0 && (char === '\n' || char === '\r')) return source.slice(start, index)
  }
  return source.slice(start, end)
}

function splitTopLevel(text, separator) {
  const parts = []
  let depth = 0
  let quote = ''
  let last = 0
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quote !== '') {
      if (char === '\\') {
        index += 1
        continue
      }
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '{' || char === '[' || char === '(') depth += 1
    else if (char === '}' || char === ']' || char === ')') depth = Math.max(0, depth - 1)
    else if (char === separator && depth === 0) {
      parts.push(text.slice(last, index))
      last = index + 1
    }
  }
  parts.push(text.slice(last))
  return parts
}

function primitivesOfObjectLiteral(objectText) {
  const pairs = {}
  for (const part of splitTopLevel(objectText.replace(/^\{/, '').replace(/\}$/, ''), ',')) {
    const match = /^\s*([A-Za-z_$][\w$]*)\s*:\s*("[^"]*"|'[^']*'|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|true|false|null)\s*$/.exec(part)
    if (match === null) continue
    pairs[match[1]] = match[2]
  }
  return pairs
}

function describeConstant(name, rawExpression, line) {
  const value = rawExpression.trim().replace(/;$/, '').trim()
  if (value.length === 0) return undefined
  if (/^["'`]/.test(value)) {
    return { name, kind: 'string', line, chars: value.length, value: value.slice(0, 400) }
  }
  if (/^-?\d/.test(value)) {
    return { name, kind: 'number', line, chars: value.length, value: value.slice(0, 200) }
  }
  if (value.startsWith('[')) {
    const inner = value.replace(/^\[/, '').replace(/\]$/, '')
    const items = splitTopLevel(inner, ',').map((item) => item.trim()).filter((item) => item.length > 0)
    return {
      name,
      kind: 'array',
      line,
      chars: value.length,
      count: items.length,
      value: items.slice(0, 8).map((item) => item.slice(0, 80)).join(', '),
    }
  }
  if (value.startsWith('{')) {
    const inner = value.replace(/^\{/, '').replace(/\}$/, '')
    const entries = primitivesOfObjectLiteral(value)
    const keys = splitTopLevel(inner, ',').map((part) => /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(part)).filter(Boolean).map((match) => match[1])
    return {
      name,
      kind: 'object',
      line,
      chars: value.length,
      count: keys.length,
      keys: keys.slice(0, 60),
      entries: Object.keys(entries).length > 0 ? entries : undefined,
      value: keys.slice(0, 12).join(', '),
    }
  }
  return { name, kind: 'expression', line, chars: value.length, value: value.slice(0, 200) }
}

/** Extract exported uppercase constants with their value classification. */
export function extractConstants(source) {
  const starts = lineStarts(source)
  const constants = []
  const declaration = /(^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Z][A-Z0-9_]{2,})\s*=\s*/g
  for (const match of source.matchAll(declaration)) {
    if (constants.length >= MAX_CONSTANTS_PER_PACKAGE) break
    const name = match[2]
    const start = (match.index ?? 0) + match[0].length
    const expression = readExpression(source, start)
    const described = describeConstant(name, expression, lineAt(starts, start))
    if (described !== undefined) constants.push(described)
  }
  return constants
}

/** Extract `key: z.…default(value)` pairs, the schema defaults of a Config. */
export function extractDefaults(source) {
  const starts = lineStarts(source)
  const defaults = []
  const seen = new Set()
  const call = /\.default\(\s*/g
  for (const match of source.matchAll(call)) {
    if (defaults.length >= MAX_DEFAULTS_PER_PACKAGE) break
    const open = (match.index ?? 0) + match[0].length - 1
    const close = matchBalanced(source, open, '(', ')')
    if (close < 0) continue
    const value = source.slice(open + 1, close).trim().replace(/\s+/g, ' ')
    if (value.length === 0 || value.length > 160) continue
    const before = source.slice(Math.max(0, (match.index ?? 0) - 400), match.index ?? 0)
    const keyMatch = /([A-Za-z_$][\w$]*)\s*:\s*[^,;{}]*$/.exec(before)
    const key = keyMatch === null ? undefined : keyMatch[1]
    if (key !== undefined) {
      const identity = `${key}\u0000${value}`
      if (seen.has(identity)) continue
      seen.add(identity)
    }
    const line = lineAt(starts, match.index ?? 0)
    defaults.push(key === undefined ? { line, value } : { key, line, value })
  }
  return defaults
}

/** Slice a `const NAME = {…}` object literal out of a source file. */
export function sliceObjectLiteral(source, name) {
  const pattern = new RegExp(`(?:const|let|var)\\s+${escapeRegExp(name)}\\s*=\\s*\\{`)
  const match = pattern.exec(source)
  if (match === null) return undefined
  const start = source.indexOf('{', match.index)
  const end = matchBalanced(source, start, '{', '}')
  return end < 0 ? undefined : source.slice(start, end + 1)
}

/** Slice a `function NAME(…) {…}` declaration (comments between are included). */
export function sliceFunction(source, name) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${escapeRegExp(name)}\\s*\\(`)
  const match = pattern.exec(source)
  if (match === null) return undefined
  const open = source.indexOf('(', match.index)
  const close = matchBalanced(source, open, '(', ')')
  if (close < 0) return undefined
  const brace = source.indexOf('{', close)
  if (brace < 0) return undefined
  const end = matchBalanced(source, brace, '{', '}')
  return end < 0 ? undefined : source.slice(match.index, end + 1)
}

/** Parse `{ KEY: 123, OTHER: -1e3 }` into a plain name→number map. */
export function parseNumericEntries(objectText) {
  const entries = {}
  if (typeof objectText !== 'string') return entries
  for (const part of splitTopLevel(objectText.replace(/^\{/, '').replace(/\}$/, ''), ',')) {
    const match = /^\s*([A-Za-z_$][\w$]*)\s*:\s*(-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)\s*$/.exec(part)
    if (match !== null) entries[match[1]] = Number(match[2])
  }
  return entries
}

/**
 * Resolve a default expression that names one of the package's own constants,
 * so the catalog shows the effective value instead of an internal identifier.
 * Returns undefined when the expression is not such a reference.
 */
function resolveDefaultValue(raw, byName) {
  const trimmed = String(raw).trim()
  const spread = /^\[\.\.\.([A-Z][A-Z0-9_]+)\]$/.exec(trimmed)
  if (spread !== null) {
    const constant = byName.get(spread[1])
    if (constant === undefined) return undefined
    return `[...${spread[1]}] ${constant.value ?? ''}`.trim()
  }
  const single = /^([A-Z][A-Z0-9_]+)$/.exec(trimmed)
  if (single !== null) {
    const constant = byName.get(single[1])
    if (constant === undefined) return undefined
    return constant.kind === 'string' ? constant.value : `${single[1]} = ${constant.value ?? ''}`.trim()
  }
  return undefined
}

/** Rewrite default rows whose value is a local constant reference. */
function resolveDefaults(defaults, constants) {
  if (defaults.length === 0 || constants.length === 0) return defaults
  const byName = new Map(constants.map((constant) => [constant.name, constant]))
  return defaults.map((entry) => {
    const resolved = resolveDefaultValue(entry.value, byName)
    return resolved === undefined ? entry : { ...entry, value: resolved, resolvedFrom: entry.value }
  })
}

let scanCache
/** Scan every shipped `@deepseek-ai/*` package once per process. */
export async function scanPackages() {
  if (scanCache !== undefined) return scanCache
  const started = Date.now()
  const root = await findNodeModules()
  const report = {
    nodeModules: root.dir ?? null,
    tried: root.tried,
    scannedAt: Date.now(),
    durationMs: 0,
    totalBytes: 0,
    truncated: false,
    packages: [],
    errors: [],
  }
  if (root.dir === undefined) {
    report.durationMs = Date.now() - started
    scanCache = report
    return report
  }
  let names = []
  try {
    const entries = await readdir(join(root.dir, SCOPE), { withFileTypes: true })
    names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  } catch (error) {
    report.errors.push(`readdir ${SCOPE}: ${message(error)}`)
  }
  let totalBytes = 0
  for (const name of names) {
    if (report.packages.length >= MAX_PACKAGES) {
      report.truncated = true
      break
    }
    if (Date.now() - started > MAX_SCAN_MS) {
      report.truncated = true
      break
    }
    const dir = join(root.dir, SCOPE, name)
    const record = {
      name: `${SCOPE}/${name}`,
      version: null,
      description: null,
      bytes: 0,
      constants: [],
      defaults: [],
    }
    try {
      const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
      record.name = typeof manifest.name === 'string' ? manifest.name : record.name
      record.version = typeof manifest.version === 'string' ? manifest.version : null
      record.description = typeof manifest.description === 'string' ? manifest.description : null
    } catch {}
    try {
      const source = await readFile(join(dir, 'lib', 'index.js'), 'utf8')
      record.bytes = source.length
      totalBytes += source.length
      if (source.length > MAX_FILE_BYTES) {
        record.skipped = 'file-too-large'
      } else {
        record.constants = extractConstants(source)
        record.defaults = resolveDefaults(extractDefaults(source), record.constants)
      }
    } catch (error) {
      record.skipped = message(error)
    }
    report.packages.push(record)
    if (totalBytes > MAX_TOTAL_BYTES) {
      report.truncated = true
      break
    }
  }
  report.totalBytes = totalBytes
  report.durationMs = Date.now() - started
  scanCache = report
  return report
}

/** Flatten the scan into searchable constant rows. */
export function constantRows(report) {
  if (report === undefined || report === null) return []
  const rows = []
  for (const record of report.packages ?? []) {
    for (const constant of record.constants ?? []) {
      rows.push({ package: record.name, version: record.version, ...constant })
    }
  }
  return rows
}

/** Flatten the scan into searchable schema-default rows. */
export function defaultRows(report) {
  if (report === undefined || report === null) return []
  const rows = []
  for (const record of report.packages ?? []) {
    for (const entry of record.defaults ?? []) {
      rows.push({ package: record.name, version: record.version, ...entry })
    }
  }
  return rows
}

/** Package names with data, for the UI's filter dropdown. */
export function packageSummary(report) {
  if (report === undefined || report === null) return []
  return (report.packages ?? []).map((record) => ({
    name: record.name,
    version: record.version,
    description: record.description,
    constants: (record.constants ?? []).length,
    defaults: (record.defaults ?? []).length,
    bytes: record.bytes,
    skipped: record.skipped,
  }))
}
