/**
 * Rule inspection for the three enforcement domains the user asked for:
 * approval, tool interception, and workspace ownership.
 *
 * Every value is read from a live service; nothing is written. Where a policy
 * lives inside an object without a public getter (guards, restrictions, the
 * workspace archive/pin sets), the inspector reads the plain own fields and
 * reports a bounded summary instead of pretending a public API exists.
 */

const MAX_SNIPPET = 320

import { hookInventory } from './intercept.js'

function optional(ctx, key) {
  try {
    return ctx.get(key)
  } catch {
    return undefined
  }
}

function message(error) {
  return error instanceof Error ? error.message : String(error)
}

function bound(value, depth = 0) {
  try {
    if (value === undefined || value === null) return null
    if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}… (${value.length} chars)` : value
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value === 'function') return '[function]'
    if (depth >= 4) return '[depth-limit]'
    if (Array.isArray(value)) return value.slice(0, 40).map((entry) => bound(entry, depth + 1))
    if (value instanceof Set) return { $set: [...value].slice(0, 20).map((entry) => bound(entry, depth + 1)) }
    if (value instanceof Map) {
      const out = {}
      let count = 0
      for (const [key, entry] of value) {
        if (count >= 20) break
        count += 1
        out[String(key)] = bound(entry, depth + 1)
      }
      return out
    }
    if (typeof value === 'object') {
      const out = {}
      let count = 0
      for (const key of Object.keys(value)) {
        if (count >= 40) {
          out['…'] = '[key-limit]'
          break
        }
        count += 1
        out[key] = bound(value[key], depth + 1)
      }
      return out
    }
    return String(value)
  } catch {
    return '[unreadable]'
  }
}

function snippet(fn) {
  try {
    const text = typeof fn === 'function' ? fn.toString().replace(/\s+/g, ' ') : String(fn)
    return text.length > MAX_SNIPPET ? `${text.slice(0, MAX_SNIPPET)}…` : text
  } catch {
    return '[unreadable]'
  }
}

function safeCall(target, method, ...args) {
  try {
    if (target !== undefined && target !== null && typeof target[method] === 'function') return target[method](...args)
  } catch {}
  return undefined
}

/** Curated rule-bearing Loader configs, resolved through the config editor. */
function ruleConfigs(ctx) {
  const ids = [
    'approval',
    'permission',
    'timeout-policy',
    'repeat-tool-reminder',
    'fs-observation-policy',
    'fs-sandbox',
    'sandbox-policy',
    'workspace-changes',
    'agent-instructions',
    'spill-policy',
    'image-offload',
  ]
  const out = []
  try {
    const editor = optional(ctx, 'configEditor')
    const configuration = typeof editor?.configuration === 'function' ? editor.configuration() : []
    for (const record of Array.isArray(configuration) ? configuration : []) {
      const id = record?.entry?.options?.id
      if (typeof id !== 'string' || !ids.includes(id)) continue
      const override = record?.override ?? {}
      const usesOverride = override !== null && typeof override === 'object' && Object.keys(override).length > 0
      out.push({
        id,
        name: record?.entry?.options?.name ?? null,
        disabled: record?.entry?.options?.disabled === true,
        source: usesOverride ? 'override' : 'inherited',
        config: bound(usesOverride ? override : record?.inherited ?? {}),
      })
    }
  } catch (error) {
    out.push({ id: '<configs>', error: message(error) })
  }
  return out
}

/** Guards and restrictions held by the tool runtime's scope layers. */
function toolEnforcement(ctx) {
  const tools = optional(ctx, 'tools')
  const layers = tools?.layers
  const report = {
    available: layers !== undefined && layers !== null,
    presentation: {
      mode: typeof tools?.defaultMode === 'string' ? tools.defaultMode : null,
      maxParallelSubCalls: typeof tools?.maxParallelSubCalls === 'number' ? tools.maxParallelSubCalls : null,
    },
    toolCounts: { global: 0, scopedLayers: 0, scoped: 0 },
    guards: [],
    restrictions: [],
    scopedTools: [],
    notes: [],
  }
  if (!report.available) {
    report.notes.push('ctx.tools exposes no `layers` field in this build')
    return report
  }
  const scopes = new Map()
  const collectLayer = (layer, scopeLabel) => {
    const guardValues = layer?.guards?.values
    if (typeof guardValues === 'function') {
      for (const guard of guardValues.call(layer.guards)) {
        report.guards.push({ scope: scopeLabel, name: typeof guard === 'function' ? guard.name || 'anonymous' : typeof guard, source: snippet(guard) })
      }
    }
    const restrictionValues = layer?.restrictions?.values
    if (typeof restrictionValues === 'function') {
      for (const restriction of restrictionValues.call(layer.restrictions)) {
        report.restrictions.push({
          scope: scopeLabel,
          allow: restriction?.allow instanceof Set ? [...restriction.allow] : null,
          deny: restriction?.deny instanceof Set ? [...restriction.deny] : null,
        })
      }
    }
    const toolEntries = layer?.tools?.entries
    if (typeof toolEntries === 'function') {
      for (const [name] of toolEntries.call(layer.tools)) {
        if (scopeLabel === 'global') {
          report.toolCounts.global += 1
          continue
        }
        report.toolCounts.scoped += 1
        const entry = scopes.get(scopeLabel) ?? { scope: scopeLabel, count: 0, names: [] }
        entry.count += 1
        if (entry.names.length < 14) entry.names.push(name)
        scopes.set(scopeLabel, entry)
      }
    }
  }
  try {
    collectLayer(layers.global, 'global')
    if (layers.scoped instanceof Map) {
      report.toolCounts.scopedLayers = layers.scoped.size
      let index = 0
      for (const layer of layers.scoped.values()) {
        collectLayer(layer, `scope#${index}`)
        index += 1
      }
    }
  } catch (error) {
    report.notes.push(`layer scan failed: ${message(error)}`)
  }
  report.scopedTools = [...scopes.values()].slice(0, 20)
  return report
}

/** Archive/pin sets kept inside the workspace registry (no public getter). */
function registryInternals(registry) {
  const out = []
  try {
    for (const key of Object.getOwnPropertyNames(registry)) {
      if (key === 'constructor' || key === 'ctx' || key === 'name') continue
      let value
      try {
        value = registry[key]
      } catch {
        continue
      }
      if (value instanceof Set) out.push({ name: key, type: 'set', size: value.size, sample: [...value].slice(0, 10).map(String) })
      else if (value instanceof Map) out.push({ name: key, type: 'map', size: value.size, sample: [...value.keys()].slice(0, 10).map(String) })
    }
  } catch {}
  return out
}

/** Build the approval / interception / workspace rule report. */
export function buildRulesReport(ctx, recorder) {
  const approval = optional(ctx, 'approval')
  const presets = optional(ctx, 'permissionPresets')
  const sandbox = optional(ctx, 'sandboxPolicy')
  const sessions = optional(ctx, 'sessions')
  const workingDirectory = optional(ctx, 'workingDirectory')
  const registry = optional(ctx, 'workspaceRegistry')
  const inventory = hookInventory(ctx)
  const seamHooks = (names) => names
    .map((name) => inventory.events.find((event) => event.name === name) ?? null)
    .filter((event) => event !== null)
    .map((event) => JSON.parse(JSON.stringify(event)))

  const sessionRows = []
  try {
    const live = safeCall(sessions, 'list') ?? []
    for (const session of (Array.isArray(live) ? live : []).slice(0, 60)) {
      let approvalOverride = null
      try {
        approvalOverride = typeof approval?.overrideOf === 'function' ? approval.overrideOf(session) ?? null : null
      } catch {}
      let directory = null
      try {
        directory = typeof workingDirectory?.get === 'function' ? workingDirectory.get(session) ?? null : null
      } catch {}
      sessionRows.push({
        id: session?.id ?? null,
        cwd: session?.header?.cwd ?? null,
        directory,
        agentPreset: session?.header?.agentPreset ?? null,
        approvalOverride,
      })
    }
  } catch (error) {
    sessionRows.push({ error: message(error) })
  }

  const workspaces = []
  try {
    for (const workspace of safeCall(registry, 'list') ?? []) {
      workspaces.push({
        id: workspace?.id ?? null,
        title: workspace?.title ?? null,
        path: workspace?.path ?? null,
        sessionCount: Array.isArray(workspace?.sessionIds) ? workspace.sessionIds.length : 0,
        sessionIds: (Array.isArray(workspace?.sessionIds) ? workspace.sessionIds : []).slice(0, 12),
      })
    }
  } catch (error) {
    workspaces.push({ error: message(error) })
  }

  const records = recorder?.records ?? []
  const pick = (seam) => records.filter((record) => record.seam === seam).slice(0, 12)
  const toolDecisions = records
    .filter((record) => record.seam === 'tools/pre-execute' && (record.action === 'deny' || record.action === 'ask'))
    .slice(0, 12)

  let deploymentPolicy = null
  try {
    deploymentPolicy = bound(approval?.config?.policy ?? null)
  } catch {}

  return {
    generatedAt: Date.now(),
    approval: {
      deploymentPolicy,
      presets: bound(presets?.presets ?? safeCall(presets, 'presets') ?? null),
      sessions: sessionRows,
      hooks: seamHooks(['approval/request', 'user-questions/request', 'tools/pre-execute']),
      seams: {
        approvalRequests: pick('approval/request'),
        userQuestions: pick('user-questions/request'),
        toolAsksAndDenials: toolDecisions,
      },
    },
    interception: {
      toolRuntime: toolEnforcement(ctx),
      configs: ruleConfigs(ctx),
      hooks: seamHooks(['tools/pre-execute', 'tools/post-execute', 'tools/execute', 'fs/write-intent', 'fs/edit-intent']),
    },
    workspace: {
      registry: workspaces,
      internals: registryInternals(registry),
      sandbox: {
        defaultMode: typeof sandbox?.defaultMode === 'string' ? sandbox.defaultMode : null,
        workspaceRoot: typeof sandbox?.workspaceRoot === 'string' ? sandbox.workspaceRoot : null,
      },
      hooks: seamHooks(['workspace/session-activity', 'workspace/session-stop']),
      activityRecords: pick('workspace/session-activity'),
    },
    hookInventory: { available: inventory.available, totalEvents: inventory.totalEvents, totalListeners: inventory.totalListeners, notes: inventory.notes },
  }
}
