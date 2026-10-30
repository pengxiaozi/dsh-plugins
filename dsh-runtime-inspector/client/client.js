/**
 * Browser half of the DSH runtime inspector.
 *
 * Registers one sidebar entry and the main panel it opens. Every value is read
 * from the Host half's same-origin JSON routes; the page holds no business
 * logic of its own beyond rendering and local filtering controls.
 */
window.__ModuleLoader__.load({
  id: 'dsh-runtime-inspector',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'dshRuntimeInspector'
    const PANEL_ID = 'runtime-inspector'
    const API = '/dsh-runtime-inspector'

    /** Simplified Chinese dictionary; key source of truth. */
    const zh = {
      panel: '运行时透视',
      title: '运行时透视',
      subtitle: '当前 DSH 进程的真实运行逻辑：system prompt 装配链、宿主包字符串常量、默认值与 Loader 生效配置。',
      tabPrompt: '提示词链',
      tabConstants: '字符串常量',
      tabConfigs: '默认值与配置',
      tabHealth: '运行状态',
      refresh: '刷新',
      loading: '读取中…',
      error: '读取失败',
      retry: '重试',
      copy: '复制',
      copied: '已复制',
      empty: '暂无数据',
      assembleNow: '重新装配一次',
      registryTitle: 'Section 链（注册表）',
      registryHint: '来自 systemPrompt 注册表：顺序、插值/完整覆盖标志与字数。点击展开原文。',
      renderTitle: '渲染结果（模型实际收到的 system prompt）',
      latestTitle: '最近一次真实装配',
      latestEmpty: '本进程还没有捕获到装配。发一条消息后即可看到真实装配链。',
      actualTitle: '实际请求（llm/stream）',
      actualEmpty: '还没有捕获到模型请求。',
      ordersTitle: '顺序表',
      ordersHint: '从 dsh-system-prompt 源码里读出的 SECTION_ORDERS / CONTEXT_ORDERS。',
      sourceTitle: '渲染算法源码',
      sourceHint: '渲染真实使用的 renderPrompt / interpolate 等函数源码。',
      contextsTitle: 'runtime contexts',
      variablesTitle: '变量表',
      problemsTitle: '插值问题',
      sections: 'sections',
      contexts: 'contexts',
      tools: 'tools',
      chars: '字符',
      scopedLayers: 'scoped 层',
      kindConstant: '全部常量',
      kindString: '字符串',
      kindNumber: '数字',
      kindObject: '对象',
      kindArray: '数组',
      kindDefault: 'schema 默认值',
      searchPlaceholder: '按名称、值或包名过滤…',
      allPackages: '全部包',
      total: '条',
      loadMore: '加载更多',
      constEmpty: '没有匹配的常量。宿主安装目录可能不可读，见「运行状态」页的探测路径。',
      configsTitle: 'Loader 生效配置',
      configsUnavailable: '当前组合没有提供配置编辑器，无法读取 inherited / override 配置。',
      configsHint: '每个 Loader 条目的 schema 默认值（inherited）与用户 patch 覆盖值（override）。',
      defaultsHint: 'schema 默认值可以在「字符串常量 → schema 默认值」中查看。',
      healthTitle: '进程与安装目录',
      healthServices: '可选服务可用性',
      healthCaptured: '已捕获',
      healthRoots: '安装目录探测',
      healthRoutes: 'HTTP 路由',
      healthTool: 'Agent 工具',
      disabled: '已禁用',
      enabled: '启用',
      expand: '展开',
      collapse: '收起',
      line: '行',
      package: '包',
      name: '名称',
      value: '值',
      count: '数量',
      order: '顺序',
      unknown: '未知',
      functionSection: '该 section 由函数生成，原文见装配快照。',
      tabIntercepts: '拦截',
      hooksTitle: '事件钩子表（谁拦截了什么）',
      hooksHint: '来自 Cordis 活事件表：每个事件挂载的监听器、注册顺序、是否 prepend（更外层，先执行）以及它属于哪个 Loader 包。',
      recordsTitle: '运行时拦截记录',
      recordsHint: 'pass = 未改写；intercept = 被改写或被拒；error = 链路抛错；decision = 记录最终决策。观察者以 prepend 包裹整条链，只读取结果、不改变行为。',
      verdictPass: '未改写',
      verdictIntercept: '被拦截',
      verdictError: '错误',
      verdictDecision: '决策',
      policiesTitle: '执行策略内部状态',
      policiesHint: '从执行服务自身的字段读出的策略快照（只读、有界、可能不完整）。',
      eventsCount: '事件',
      listenersCount: '监听器',
      recordsCount: '记录',
      interceptedCount: '被拦截',
      hookSearch: '按事件名、说明或包名过滤…',
      noHooks: '没有可读的钩子表。',
      noRecords: '还没有捕获到拦截记录。',
      allEvents: '全部事件',
      allVerdicts: '全部判定',
      input: '输入',
      output: '输出',
      unattributed: '(未归属)',
      absent: '不存在',
      fields: '字段',
      tabRules: '规则',
      rulesApproval: '审批规则',
      rulesIntercept: '拦截规则',
      rulesWorkspace: 'workspace 规则',
      approvalHint: '部署策略、权限预设、每个会话的审批覆盖，以及审批链上的监听器与近期决策。',
      interceptHint: '工具运行时呈现模式、护栏 / 限制、相关 Loader 配置，以及 tools/* 与 fs/* 上的监听器。',
      workspaceHint: '工作区注册表、会话目录与审批覆盖、沙箱根，以及归档前会询问的活动来源。',
      rulesDeployment: '部署策略',
      rulesPresets: '权限预设',
      rulesSessions: '会话',
      rulesHooks: '监听器',
      rulesConfigs: '生效配置',
      rulesGuards: '工具护栏 guards',
      rulesRestrictions: '工具限制 restrict',
      rulesRuntime: '工具运行时',
      rulesWorkspaces: '工作区',
      rulesSandbox: '沙箱',
      rulesInternals: '仓储内部集合',
      rulesRecords: '近期决策',
      noGuards: '当前没有注册 guard。',
      noRestrictions: '当前没有注册 restriction。',
      rulesScoped: '作用域内工具',
    }

    /** English dictionary. */
    const en = {
      panel: 'Runtime Inspector',
      title: 'Runtime Inspector',
      subtitle: 'What this DSH process really runs: the system-prompt assembly chain, host-package string constants, defaults and the effective Loader configuration.',
      tabPrompt: 'Prompt chain',
      tabConstants: 'String constants',
      tabConfigs: 'Defaults & config',
      tabHealth: 'Health',
      refresh: 'Refresh',
      loading: 'Loading…',
      error: 'Failed to load',
      retry: 'Retry',
      copy: 'Copy',
      copied: 'Copied',
      empty: 'No data',
      assembleNow: 'Assemble now',
      registryTitle: 'Section chain (registry)',
      registryHint: 'From the systemPrompt registry: placement, interpolation/complete flags and size. Click to expand the raw text.',
      renderTitle: 'Rendered system prompt (what the model receives)',
      latestTitle: 'Latest real assembly',
      latestEmpty: 'No assembly captured yet. Send one message to capture the real chain.',
      actualTitle: 'Actual requests (llm/stream)',
      actualEmpty: 'No model request captured yet.',
      ordersTitle: 'Placement tables',
      ordersHint: 'SECTION_ORDERS / CONTEXT_ORDERS read from the dsh-system-prompt source.',
      sourceTitle: 'Render algorithm source',
      sourceHint: 'Source of the renderPrompt / interpolate functions actually used.',
      contextsTitle: 'Runtime contexts',
      variablesTitle: 'Variables',
      problemsTitle: 'Interpolation problems',
      sections: 'sections',
      contexts: 'contexts',
      tools: 'tools',
      chars: 'chars',
      scopedLayers: 'scoped layers',
      kindConstant: 'All constants',
      kindString: 'Strings',
      kindNumber: 'Numbers',
      kindObject: 'Objects',
      kindArray: 'Arrays',
      kindDefault: 'Schema defaults',
      searchPlaceholder: 'Filter by name, value or package…',
      allPackages: 'All packages',
      total: 'rows',
      loadMore: 'Load more',
      constEmpty: 'No matching constants. The install directory may be unreadable — see the Health tab for the probed paths.',
      configsTitle: 'Effective Loader configuration',
      configsUnavailable: 'This composition provides no config editor, so inherited / override configuration is unavailable.',
      configsHint: 'Schema defaults (inherited) and user patch overrides for every Loader entry.',
      defaultsHint: 'Schema defaults are listed under “String constants → Schema defaults”.',
      healthTitle: 'Process and install directory',
      healthServices: 'Optional services',
      healthCaptured: 'Captured',
      healthRoots: 'Install root probing',
      healthRoutes: 'HTTP routes',
      healthTool: 'Agent tool',
      disabled: 'disabled',
      enabled: 'enabled',
      expand: 'Expand',
      collapse: 'Collapse',
      line: 'line',
      package: 'package',
      name: 'name',
      value: 'value',
      count: 'count',
      order: 'order',
      unknown: 'unknown',
      functionSection: 'This section is produced by a function; read it in the assembly snapshot.',
      tabIntercepts: 'Interceptions',
      hooksTitle: 'Event hook table (who intercepts what)',
      hooksHint: 'From the live Cordis event table: listeners mounted on each event, their registration order, whether they run with prepend (outermost first), and the Loader package that registered them.',
      recordsTitle: 'Runtime interception records',
      recordsHint: 'pass = unchanged; intercept = rewritten or refused; error = the chain threw; decision = the final decision was recorded. Observers wrap the chain with prepend and never change its result.',
      verdictPass: 'unchanged',
      verdictIntercept: 'intercepted',
      verdictError: 'error',
      verdictDecision: 'decision',
      policiesTitle: 'Policy internals',
      policiesHint: 'Policy state read from the enforcing services themselves (read-only, bounded, possibly partial).',
      eventsCount: 'events',
      listenersCount: 'listeners',
      recordsCount: 'records',
      interceptedCount: 'intercepted',
      hookSearch: 'Filter by event, hint or package…',
      noHooks: 'No readable hook table.',
      noRecords: 'No interception captured yet.',
      allEvents: 'All events',
      allVerdicts: 'All verdicts',
      input: 'input',
      output: 'output',
      unattributed: '(unattributed)',
      absent: 'absent',
      fields: 'fields',
      tabRules: 'Rules',
      rulesApproval: 'Approval rules',
      rulesIntercept: 'Interception rules',
      rulesWorkspace: 'Workspace rules',
      approvalHint: 'Deployment policy, permission presets, per-session approval overrides, the approval chain listeners and recent decisions.',
      interceptHint: 'Tool presentation mode, guards / restrictions, related Loader configs, and the listeners on tools/* and fs/*.',
      workspaceHint: 'Workspace registry, session directories and approval overrides, sandbox roots, and the activity sources asked before archiving.',
      rulesDeployment: 'Deployment policy',
      rulesPresets: 'Permission presets',
      rulesSessions: 'Sessions',
      rulesHooks: 'Listeners',
      rulesConfigs: 'Effective configs',
      rulesGuards: 'Tool guards',
      rulesRestrictions: 'Tool restrictions',
      rulesRuntime: 'Tool runtime',
      rulesWorkspaces: 'Workspaces',
      rulesSandbox: 'Sandbox',
      rulesInternals: 'Registry internals',
      rulesRecords: 'Recent decisions',
      noGuards: 'No guard is currently registered.',
      noRestrictions: 'No restriction is currently registered.',
      rulesScoped: 'Scoped tools',
    }

    const S = {
      root: {
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      },
      header: { padding: '18px 24px 0', flex: '0 0 auto' },
      titleRow: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
      title: { margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: 0.2 },
      version: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
      subtitle: { margin: '6px 0 12px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--dsw-alias-label-secondary)', maxWidth: 900 },
      tabs: { display: 'flex', gap: 2, borderBottom: '1px solid var(--dsw-alias-border-l1)' },
      tab: {
        appearance: 'none',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 13,
        padding: '8px 12px',
        cursor: 'pointer',
        borderBottom: '2px solid transparent',
        marginBottom: -1,
      },
      tabActive: { color: 'var(--dsw-alias-label-primary)', borderBottom: '2px solid var(--dsw-alias-brand-primary)', fontWeight: 600 },
      body: { flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: '16px 24px 28px' },
      grid: { display: 'grid', gridTemplateColumns: 'minmax(300px, 420px) minmax(0, 1fr)', gap: 14, alignItems: 'start' },
      card: {
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 14,
        minWidth: 0,
      },
      cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
      cardTitle: { margin: 0, fontSize: 13.5, fontWeight: 600 },
      hint: { margin: '0 0 8px', fontSize: 11.5, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)' },
      chips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
      chip: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11.5,
        color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 999,
        padding: '2px 9px',
        lineHeight: 1.6,
      },
      chipValue: { color: 'var(--dsw-alias-label-primary)', fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
      item: { borderBottom: '1px solid var(--dsw-alias-border-l1)', padding: '5px 0' },
      itemHead: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexWrap: 'wrap' },
      orderChip: {
        flex: '0 0 auto',
        minWidth: 40,
        textAlign: 'center',
        fontSize: 10.5,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 5,
        padding: '1px 4px',
      },
      itemName: { fontSize: 12.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', wordBreak: 'break-all' },
      flag: {
        fontSize: 10.5,
        color: 'var(--dsw-alias-brand-primary)',
        border: '1px solid var(--dsw-alias-brand-primary)',
        borderRadius: 999,
        padding: '0 6px',
        opacity: 0.9,
      },
      muted: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' },
      pre: {
        margin: '6px 0 2px',
        padding: '9px 11px',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 11.5,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'auto',
        maxHeight: 420,
      },
      bigPre: {
        margin: '4px 0 0',
        padding: '11px 13px',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 11.5,
        lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'auto',
        maxHeight: 520,
      },
      button: {
        appearance: 'none',
        fontSize: 11.5,
        padding: '3px 9px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
      },
      input: {
        appearance: 'none',
        fontSize: 12,
        padding: '5px 9px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        minWidth: 200,
        outline: 'none',
      },
      select: {
        appearance: 'none',
        fontSize: 12,
        padding: '5px 9px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        maxWidth: 280,
      },
      toolbar: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 },
      row: {
        display: 'grid',
        gridTemplateColumns: 'minmax(150px, 220px) minmax(120px, 190px) 74px minmax(0, 1fr) 58px',
        gap: 8,
        alignItems: 'baseline',
        borderTop: '1px solid var(--dsw-alias-border-l1)',
        padding: '6px 2px',
        fontSize: 12,
      },
      rowHead: {
        display: 'grid',
        gridTemplateColumns: 'minmax(150px, 220px) minmax(120px, 190px) 74px minmax(0, 1fr) 58px',
        gap: 8,
        fontSize: 11,
        color: 'var(--dsw-alias-label-secondary)',
        padding: '0 2px 5px',
        fontWeight: 600,
      },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 11.5, wordBreak: 'break-all' },
      valueMono: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 11.5,
        color: 'var(--dsw-alias-label-secondary)',
        wordBreak: 'break-all',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      },
      state: { fontSize: 12.5, color: 'var(--dsw-alias-label-secondary)', padding: '10px 0' },
      error: { fontSize: 12.5, color: 'var(--dsw-alias-state-error-primary)', padding: '8px 0', whiteSpace: 'pre-wrap' },
      details: { marginTop: 6 },
    }

// Compact plain overrides: low radii, tight spacing, flat controls. The base
    // map above keeps the layout semantic; this pass only changes geometry so
    // every panel reads as one dense, direct information surface.
    Object.assign(S, {
      header: { ...S.header, padding: '12px 16px 0' },
      title: { ...S.title, fontSize: 15 },
      version: { ...S.version, fontSize: 11 },
      subtitle: { ...S.subtitle, margin: '3px 0 8px', fontSize: 11.5, maxWidth: 980 },
      tabs: { ...S.tabs, gap: 0 },
      tab: { ...S.tab, padding: '6px 10px', fontSize: 12.5 },
      body: { ...S.body, padding: '10px 16px 20px' },
      grid: { ...S.grid, gap: 10 },
      card: { ...S.card, borderRadius: 3, padding: '9px 11px', marginBottom: 9 },
      cardHead: { ...S.cardHead, marginBottom: 5 },
      cardTitle: { ...S.cardTitle, fontSize: 12.5 },
      hint: { ...S.hint, margin: '0 0 5px', fontSize: 10.5 },
      chips: { ...S.chips, gap: 4, marginBottom: 7 },
      chip: { ...S.chip, borderRadius: 2, padding: '1px 6px', fontSize: 10.5 },
      item: { ...S.item, padding: '4px 0' },
      itemHead: { ...S.itemHead, gap: 6 },
      orderChip: { ...S.orderChip, borderRadius: 2, minWidth: 32, padding: '0 3px', fontSize: 10 },
      itemName: { ...S.itemName, fontSize: 11.5 },
      flag: { ...S.flag, borderRadius: 2, padding: '0 4px', fontSize: 9.5 },
      button: {
        appearance: 'none',
        height: 24,
        padding: '0 8px',
        borderRadius: 3,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 11.5,
        lineHeight: '22px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      input: { ...S.input, borderRadius: 3, height: 24, padding: '0 6px', fontSize: 11.5 },
      select: { ...S.select, borderRadius: 3, height: 24, padding: '0 6px', fontSize: 11.5 },
      toolbar: { ...S.toolbar, gap: 6, marginBottom: 7 },
      pre: { ...S.pre, borderRadius: 3, padding: '7px 9px', fontSize: 11 },
      bigPre: { ...S.bigPre, borderRadius: 3, padding: '8px 10px', fontSize: 11 },
      row: { ...S.row, gap: 6, padding: '4px 2px' },
      rowHead: { ...S.rowHead, fontSize: 10.5, padding: '0 2px 4px' },
      state: { ...S.state, fontSize: 11.5, padding: '8px 0' },
      error: { ...S.error, fontSize: 11.5, padding: '6px 0' },
    })

    function formatTime(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      try {
        return new Date(value).toLocaleString()
      } catch {
        return String(value)
      }
    }

    function fmtNumber(value) {
      return typeof value === 'number' ? value.toLocaleString() : '—'
    }

    function shortId(value) {
      if (typeof value !== 'string' || value.length === 0) return '—'
      const stripped = value.startsWith('session-') ? value.slice(8) : value
      return stripped.length > 10 ? stripped.slice(0, 10) : stripped
    }

    function useApi(path, deps) {
      const [state, setState] = React.useState({ status: 'loading' })
      React.useEffect(() => {
        let alive = true
        setState({ status: 'loading' })
        const controller = typeof AbortController === 'function' ? new AbortController() : undefined
        fetch(`${API}${path}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
          signal: controller === undefined ? undefined : controller.signal,
        })
          .then(async (response) => {
            if (!response.ok) {
              const body = await response.text().catch(() => '')
              throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`)
            }
            return response.json()
          })
          .then((data) => {
            if (alive) setState({ status: 'ready', data })
          })
          .catch((error) => {
            if (!alive) return
            if (error !== null && typeof error === 'object' && error.name === 'AbortError') return
            setState({ status: 'error', error: String((error !== null && typeof error === 'object' && error.message) || error) })
          })
        return () => {
          alive = false
          if (controller !== undefined) controller.abort()
        }
      }, deps)
      return state
    }

    function Chip(props) {
      return h('span', { style: S.chip }, props.label, props.value === undefined ? null : h('span', { style: S.chipValue }, String(props.value)))
    }

    function Card(props) {
      return h(
        'section',
        { style: S.card },
        h(
          'div',
          { style: S.cardHead },
          h('h2', { style: S.cardTitle }, props.title),
          props.actions === undefined ? null : h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } }, props.actions),
        ),
        props.hint === undefined ? null : h('p', { style: S.hint }, props.hint),
        props.children,
      )
    }

    function CopyButton(props) {
      const [done, setDone] = React.useState(false)
      return h(
        'button',
        {
          style: S.button,
          type: 'button',
          onClick: () => {
            const text = typeof props.text === 'string' ? props.text : ''
            const clipboard = typeof navigator === 'object' && navigator !== null ? navigator.clipboard : undefined
            if (clipboard === undefined || typeof clipboard.writeText !== 'function') return
            clipboard.writeText(text).then(() => {
              setDone(true)
              setTimeout(() => setDone(false), 1200)
            }).catch(() => {})
          },
        },
        done ? props.t('copied') : (props.label || props.t('copy')),
      )
    }

    function StateLine(props) {
      if (props.state.status === 'loading') return h('div', { style: S.state }, props.t('loading'))
      if (props.state.status === 'error') return h('div', { style: S.error }, `${props.t('error')}: ${props.state.error}`)
      return null
    }

    function Pre(props) {
      return h('pre', { style: props.big === true ? S.bigPre : S.pre }, props.text === undefined || props.text === null ? '' : String(props.text))
    }

    function SectionItem(props) {
      const [open, setOpen] = React.useState(false)
      const item = props.item
      const flags = []
      if (item.complete === true) flags.push('complete')
      if (item.interpolate === false) flags.push('raw')
      if (item.kind === 'function') flags.push('fn')
      const size = item.kind === 'string' ? `${fmtNumber(item.chars)} ${props.t('chars')}` : props.t('functionSection')
      return h(
        'div',
        { style: S.item },
        h(
          'div',
          { style: S.itemHead, onClick: () => setOpen(!open) },
          h('span', { style: S.orderChip }, item.order === null || item.order === undefined ? '—' : String(item.order)),
          h('span', { style: S.itemName }, item.name),
          flags.map((flag) => h('span', { key: flag, style: S.flag }, flag)),
          h('span', { style: S.muted }, size),
        ),
        open && item.text !== undefined ? h(Pre, { text: item.text }) : null,
        open && item.text === undefined ? h('div', { style: S.muted }, props.t('functionSection')) : null,
      )
    }

    function Ordered({ title, value, t }) {
      if (value === null || typeof value !== 'object') return null
      const rows = Object.keys(value).sort((a, b) => value[a] - value[b])
      if (rows.length === 0) return null
      return h(
        Card,
        { title, hint: t('ordersHint') },
        h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0 18px' } },
          rows.map((name) => h(
            'div',
            { key: name, style: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5, padding: '3px 0', borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
            h('span', { style: S.mono }, name),
            h('span', { style: { ...S.mono, color: 'var(--dsw-alias-label-secondary)' } }, String(value[name])),
          )),
        ),
      )
    }

    function PromptTab({ t }) {
      const [nonce, setNonce] = React.useState(0)
      const [assemble, setAssemble] = React.useState(false)
      const state = useApi(`/prompt${assemble ? '?assemble=1' : ''}`, [nonce])
      const data = state.status === 'ready' ? state.data : undefined

      const header = h(
        'div',
        { style: S.toolbar },
        h('button', { style: S.button, type: 'button', onClick: () => setNonce(nonce + 1) }, t('refresh')),
        h(
          'button',
          {
            style: S.button,
            type: 'button',
            onClick: () => {
              setAssemble(true)
              setNonce(nonce + 1)
            },
          },
          t('assembleNow'),
        ),
        data === undefined ? null : h('span', { style: S.muted }, `${formatTime(data.generatedAt)}`),
      )

      if (state.status !== 'ready') {
        return h('div', null, header, h(StateLine, { state, t }))
      }

      const registry = data.registry || { sections: [], contexts: [], variables: [], notes: [] }
      const latest = data.latestAssembly
      const rendered = data.rendered
      const actuals = data.actuals || []
      const source = data.source || { found: false, functions: {} }
      const assembled = data.assembledNow

      return h(
        'div',
        null,
        header,
        h(
          'div',
          { style: S.chips },
          h(Chip, { label: t('sections'), value: fmtNumber(latest === null ? 0 : latest.sections) }),
          h(Chip, { label: t('contexts'), value: fmtNumber(latest === null ? 0 : latest.contexts) }),
          h(Chip, { label: t('tools'), value: fmtNumber(latest === null ? 0 : latest.tools) }),
          h(Chip, { label: t('chars'), value: rendered === null ? '0' : fmtNumber(rendered.systemChars) }),
          h(Chip, { label: t('scopedLayers'), value: fmtNumber(registry.scopedLayers) }),
        ),
        assembled !== undefined && assembled !== null && assembled.ok === true
          ? h(
            Card,
            { title: t('assembleNow') },
            h(Pre, { text: assembled.rendered === undefined ? '' : assembled.rendered.system }),
          )
          : null,
        assembled !== undefined && assembled !== null && assembled.ok === false
          ? h(Card, { title: t('assembleNow') }, h('div', { style: S.error }, assembled.error))
          : null,
        h(
          'div',
          { style: S.grid },
          h(
            'div',
            null,
            h(
              Card,
              { title: t('registryTitle'), hint: t('registryHint') },
              registry.sections.length === 0
                ? h('div', { style: S.muted }, t('empty'))
                : registry.sections.map((item) => h(SectionItem, { key: `s:${item.name}`, item, t })),
              (registry.notes || []).map((note, index) => h('div', { key: `note:${index}`, style: S.muted }, note)),
            ),
            h(
              Card,
              { title: t('contextsTitle') },
              registry.contexts.length === 0
                ? h('div', { style: S.muted }, t('empty'))
                : registry.contexts.map((item) => h(SectionItem, { key: `c:${item.name}`, item, t })),
            ),
            h(
              Card,
              { title: t('variablesTitle') },
              registry.variables.length === 0
                ? h('div', { style: S.muted }, t('empty'))
                : h('div', { style: S.chips }, registry.variables.map((name) => h(Chip, { key: name, label: name }))),
            ),
          ),
          h(
            'div',
            null,
            h(
              Card,
              {
                title: t('renderTitle'),
                actions: rendered === null ? null : h(CopyButton, { text: rendered.system, t }),
              },
              rendered === null
                ? h('div', { style: S.muted }, t('latestEmpty'))
                : h(Pre, { text: rendered.system, big: true }),
              rendered !== null && (rendered.problems || []).length > 0
                ? h(
                  'div',
                  null,
                  h('p', { style: { ...S.hint, color: 'var(--dsw-alias-state-warn-primary)' } }, t('problemsTitle')),
                  (rendered.problems || []).map((problem, index) => h('div', { key: index, style: S.error }, problem)),
                )
                : null,
            ),
            h(
              Card,
              { title: t('latestTitle') },
              latest === null
                ? h('div', { style: S.muted }, t('latestEmpty'))
                : h(
                  'div',
                  null,
                  h(
                    'div',
                    { style: S.chips },
                    h(Chip, { label: t('sections'), value: latest.sections }),
                    h(Chip, { label: t('contexts'), value: latest.contexts }),
                    h(Chip, { label: t('tools'), value: latest.tools }),
                    h(Chip, { label: t('chars'), value: fmtNumber(latest.chars) }),
                    h(Chip, { label: 'at', value: formatTime(latest.at) }),
                  ),
                  latest.assembly.sections.map((section) => h(
                    'div',
                    { key: section.name, style: S.item },
                    h('div', { style: S.itemHead }, h('span', { style: S.itemName }, section.name), h('span', { style: S.muted }, `${fmtNumber(section.chars)} ${t('chars')}`)),
                  )),
                  Object.keys(latest.assembly.variables || {}).length === 0
                    ? null
                    : h('div', { style: S.chips }, Object.keys(latest.assembly.variables).map((name) => h(Chip, { key: name, label: name }))),
                ),
            ),
            h(
              Card,
              { title: t('actualTitle') },
              actuals.length === 0
                ? h('div', { style: S.muted }, t('actualEmpty'))
                : actuals.map((actual, index) => h(
                  'div',
                  { key: index, style: S.item },
                  h(
                    'div',
                    { style: { ...S.itemHead, cursor: 'default' } },
                    h('span', { style: S.itemName }, actual.model || actual.provider || t('unknown')),
                    actual.source === undefined || actual.source === 'none' ? null : h('span', { style: S.flag }, actual.source),
                    actual.purpose === null ? null : h('span', { style: S.flag }, actual.purpose),
                    h('span', { style: S.muted }, `${fmtNumber(actual.chars)} ${t('chars')} · ${actual.messages} msg · ${actual.tools} tools`),
                    h('span', { style: S.muted }, formatTime(actual.at)),
                  ),
                  h('details', { style: S.details }, h('summary', { style: S.muted }, t('expand')), h(Pre, { text: actual.system })),
                )),
            ),
            h(Ordered, { title: `${t('ordersTitle')} · sections`, value: source.sectionOrders, t }),
            h(Ordered, { title: `${t('ordersTitle')} · contexts`, value: source.contextOrders, t }),
            h(
              Card,
              { title: t('sourceTitle'), hint: source.found === false ? `${t('error')}: ${source.reason}` : t('sourceHint') },
              source.found === false
                ? null
                : h(
                  'div',
                  null,
                  Object.keys(source.functions || {}).map((name) => h(
                    'details',
                    { key: name, style: S.details },
                    h('summary', { style: { ...S.mono, cursor: 'pointer' } }, name),
                    h(Pre, { text: source.functions[name], big: true }),
                  )),
                ),
            ),
          ),
        ),
      )
    }

    function ConstantsTab({ t, kind, onKind }) {
      const [query, setQuery] = React.useState('')
      const [debounced, setDebounced] = React.useState('')
      const [packageName, setPackageName] = React.useState('')
      const [limit, setLimit] = React.useState(200)
      const packagesState = useApi('/packages', [])

      React.useEffect(() => {
        const timer = setTimeout(() => setDebounced(query), 250)
        return () => clearTimeout(timer)
      }, [query])

      React.useEffect(() => {
        setLimit(200)
      }, [debounced, kind, packageName])

      const params = new URLSearchParams()
      params.set('kind', kind)
      params.set('limit', String(limit))
      if (debounced.length > 0) params.set('q', debounced)
      if (packageName.length > 0) params.set('pkg', packageName)
      const state = useApi(`/constants?${params.toString()}`, [kind, debounced, packageName, limit])

      const packages = packagesState.status === 'ready' ? packagesState.data.packages || [] : []
      const data = state.status === 'ready' ? state.data : undefined

      const kinds = [
        ['constant', t('kindConstant')],
        ['string', t('kindString')],
        ['number', t('kindNumber')],
        ['object', t('kindObject')],
        ['array', t('kindArray')],
        ['default', t('kindDefault')],
      ]

      return h(
        'div',
        null,
        h(
          'div',
          { style: S.toolbar },
          h('input', {
            style: S.input,
            placeholder: t('searchPlaceholder'),
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          h(
            'select',
            { style: S.select, value: kind, onChange: (event) => onKind(event.target.value) },
            kinds.map(([value, label]) => h('option', { key: value, value }, label)),
          ),
          h(
            'select',
            { style: S.select, value: packageName, onChange: (event) => setPackageName(event.target.value) },
            h('option', { value: '' }, t('allPackages')),
            packages.map((entry) => h('option', { key: entry.name, value: entry.name }, `${entry.name} (${entry.constants}/${entry.defaults})`)),
          ),
          data === undefined ? null : h('span', { style: S.muted }, `${fmtNumber(data.total)} ${t('total')}`),
          data !== undefined && data.truncated === true ? h(Chip, { label: 'scan', value: 'truncated' }) : null,
        ),
        state.status !== 'ready' ? h(StateLine, { state, t }) : null,
        state.status === 'ready' && (data.items || []).length === 0 ? h('div', { style: S.state }, t('constEmpty')) : null,
        state.status === 'ready' && (data.items || []).length > 0
          ? h(
            'div',
            null,
            h(
              'div',
              { style: S.rowHead },
              h('span', null, t('package')),
              h('span', null, t('name')),
              h('span', null, 'kind'),
              h('span', null, t('value')),
              h('span', null, t('line')),
            ),
            data.items.map((row, index) => h(ConstantRow, { key: `${row.package}:${row.name}:${index}`, row, t })),
          )
          : null,
        state.status === 'ready' && data.total > data.items.length
          ? h('div', { style: { marginTop: 10 } }, h('button', { style: S.button, type: 'button', onClick: () => setLimit(limit + 300) }, t('loadMore')))
          : null,
      )
    }

    function ConstantRow({ row, t }) {
      const [open, setOpen] = React.useState(false)
      const detail = row.kind === 'object' && row.entries !== undefined
        ? Object.keys(row.entries).map((key) => `${key}: ${row.entries[key]}`).join('\n')
        : row.value === undefined ? '' : String(row.value)
      return h(
        'div',
        { style: { ...S.item, padding: 0 } },
        h(
          'div',
          { style: { ...S.row, cursor: 'pointer' }, onClick: () => setOpen(!open) },
          h('span', { style: { ...S.mono, color: 'var(--dsw-alias-label-secondary)' } }, row.package.replace('@deepseek-ai/', '')),
          h('span', { style: S.mono }, row.name),
          h('span', { style: { ...S.mono, color: 'var(--dsw-alias-brand-primary)' } }, row.kind),
          h('span', { style: S.valueMono, title: detail }, detail.replace(/\s+/g, ' ').slice(0, 160)),
          h('span', { style: { ...S.mono, color: 'var(--dsw-alias-label-secondary)' } }, row.line === undefined ? '—' : String(row.line)),
        ),
        open ? h(Pre, { text: detail }) : null,
      )
    }

    function ConfigsTab({ t, openDefaults }) {
      const state = useApi('/configs', [])
      if (state.status !== 'ready') return h('div', null, h(StateLine, { state, t }))
      const data = state.data
      if (data.available !== true) {
        return h(
          Card,
          { title: t('configsTitle'), hint: t('configsHint') },
          h('div', { style: S.muted }, t('configsUnavailable')),
          (data.notes || []).map((note, index) => h('div', { key: index, style: S.muted }, note)),
          h('div', { style: { marginTop: 10 } }, h('button', { style: S.button, type: 'button', onClick: openDefaults }, t('defaultsHint'))),
        )
      }
      const entries = data.entries || []
      return h(
        'div',
        null,
        h(
          'div',
          { style: S.toolbar },
          h(Chip, { label: t('count'), value: fmtNumber(entries.length) }),
          h('button', { style: S.button, type: 'button', onClick: openDefaults }, t('kindDefault')),
        ),
        entries.map((entry) => h(ConfigEntry, { key: `${entry.name}:${entry.id}`, entry, t })),
      )
    }

    function ConfigEntry({ entry, t }) {
      const [open, setOpen] = React.useState(false)
      return h(
        'div',
        { style: S.item },
        h(
          'div',
          { style: S.itemHead, onClick: () => setOpen(!open) },
          h('span', { style: S.itemName }, entry.name || t('unknown')),
          h('span', { style: S.muted }, entry.id === null ? '' : String(entry.id)),
          entry.disabled === true ? h('span', { style: { ...S.flag, color: 'var(--dsw-alias-state-warn-primary)', borderColor: 'var(--dsw-alias-state-warn-primary)' } }, t('disabled')) : null,
        ),
        open
          ? h(
            'div',
            null,
            h('p', { style: S.hint }, `inherited`),
            h(Pre, { text: JSON.stringify(entry.inherited, null, 2) }),
            h('p', { style: S.hint }, `override`),
            h(Pre, { text: JSON.stringify(entry.override, null, 2) }),
            h('p', { style: S.hint }, `config`),
            h(Pre, { text: JSON.stringify(entry.config, null, 2) }),
          )
          : null,
      )
    }

    function HealthTab({ t }) {
      const state = useApi('/health', [])
      if (state.status !== 'ready') return h('div', null, h(StateLine, { state, t }))
      const data = state.data
      return h(
        'div',
        null,
        h(
          Card,
          { title: t('healthTitle') },
          h(
            'div',
            { style: S.chips },
            h(Chip, { label: 'node', value: data.process.node }),
            h(Chip, { label: 'platform', value: `${data.process.platform}/${data.process.arch}` }),
            data.process.electron === null ? null : h(Chip, { label: 'electron', value: data.process.electron }),
            h(Chip, { label: 'pid', value: fmtNumber(data.process.pid) }),
          ),
          h('p', { style: S.hint }, `${t('healthRoots')}`),
          h(Pre, { text: data.installRoot === null ? data.triedRoots.join('\n') : `${data.installRoot}\n\n${data.triedRoots.join('\n')}` }),
        ),
        h(
          Card,
          { title: t('healthServices') },
          h('div', { style: S.chips }, Object.keys(data.services).map((name) => h(
            Chip,
            { key: name, label: name, value: data.services[name] === true ? '✓' : '—' },
          ))),
          h(
            'div',
            { style: S.chips },
            h(Chip, { label: t('healthCaptured'), value: `${data.captured.assemblies} / ${data.captured.actualRequests}` }),
          ),
        ),
        h(
          Card,
          { title: t('healthRoutes') },
          data.routes.map((route) => h('div', { key: route, style: S.mono }, route)),
          h('p', { style: S.hint }, `${t('healthTool')}: ${data.tool}`),
        ),
      )
    }

    function verdictTone(verdict) {
      if (verdict === 'intercept') return 'var(--dsw-alias-state-warn-primary)'
      if (verdict === 'error') return 'var(--dsw-alias-state-error-primary)'
      if (verdict === 'decision') return 'var(--dsw-alias-brand-primary)'
      return 'var(--dsw-alias-state-success-primary)'
    }

    function HookEvent({ event, t }) {
      const [open, setOpen] = React.useState(event.observed === true)
      return h(
        'div',
        { style: S.item },
        h(
          'div',
          { style: S.itemHead, onClick: () => setOpen(!open) },
          h('span', { style: S.orderChip }, String(event.count)),
          h('span', { style: S.itemName }, event.name),
          event.label ? h('span', { style: S.muted }, event.label) : null,
          event.mode ? h('span', { style: S.flag }, event.mode) : null,
          event.internal ? h('span', { style: S.flag }, 'internal') : null,
        ),
        open
          ? (event.listeners || []).map((listener) => h(
            'div',
            { key: listener.order, style: { display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', padding: '3px 0 3px 18px', fontSize: 11.5 } },
            h('span', { style: S.mono, color: 'var(--dsw-alias-label-secondary)' }, `#${listener.order}`),
            h('span', { style: S.mono }, listener.package || t('unattributed')),
            listener.entryId ? h('span', { style: S.muted }, listener.entryId) : null,
            listener.prepend ? h('span', { style: S.flag }, 'prepend') : null,
            listener.global ? h('span', { style: S.flag }, 'global') : null,
            listener.self ? h('span', { style: S.flag }, 'self') : null,
            listener.disabled ? h('span', { style: { ...S.flag, color: 'var(--dsw-alias-state-warn-primary)' } }, t('disabled')) : null,
          ))
          : null,
      )
    }

    function RecordRow({ record, t }) {
      const [open, setOpen] = React.useState(false)
      return h(
        'div',
        { style: S.item },
        h(
          'div',
          { style: S.itemHead, onClick: () => setOpen(!open) },
          h('span', { style: { ...S.orderChip, minWidth: 62, color: verdictTone(record.verdict) } }, record.verdict),
          h('span', { style: S.itemName }, record.seam),
          h('span', { style: S.muted }, record.action || ''),
          h('span', { style: S.muted }, `${record.ms} ms`),
          record.reason ? h('span', { style: { ...S.muted, color: 'var(--dsw-alias-state-warn-primary)' } }, String(record.reason).slice(0, 120)) : null,
          h('span', { style: S.muted }, formatTime(record.at)),
        ),
        open
          ? h(
            'div',
            null,
            h('p', { style: S.hint }, t('input')),
            h(Pre, { text: JSON.stringify(record.input, null, 2) }),
            h('p', { style: S.hint }, t('output')),
            h(Pre, { text: JSON.stringify(record.output, null, 2) }),
          )
          : null,
      )
    }

    function InterceptsTab({ t }) {
      const [nonce, setNonce] = React.useState(0)
      const [hookQuery, setHookQuery] = React.useState('')
      const [eventFilter, setEventFilter] = React.useState('')
      const [verdictFilter, setVerdictFilter] = React.useState('')
      const params = new URLSearchParams()
      params.set('limit', '60')
      if (eventFilter.length > 0) params.set('event', eventFilter)
      if (verdictFilter.length > 0) params.set('verdict', verdictFilter)
      const state = useApi(`/intercepts?${params.toString()}`, [nonce, eventFilter, verdictFilter])
      const header = h(
        'div',
        { style: S.toolbar },
        h('button', { style: S.button, type: 'button', onClick: () => setNonce(nonce + 1) }, t('refresh')),
        state.status === 'ready' ? h('span', { style: S.muted }, formatTime(state.data.generatedAt)) : null,
      )
      if (state.status !== 'ready') return h('div', null, header, h(StateLine, { state, t }))
      const data = state.data
      const hooks = data.hooks || { events: [], totalEvents: 0, totalListeners: 0, notes: [] }
      const summary = data.summary || {}
      const needle = hookQuery.trim().toLowerCase()
      const events = (hooks.events || []).filter((event) => needle.length === 0
        || event.name.toLowerCase().includes(needle)
        || String(event.label || '').toLowerCase().includes(needle)
        || (event.listeners || []).some((listener) => String(listener.package || '').toLowerCase().includes(needle)))
      const seams = data.seams || []
      return h(
        'div',
        null,
        header,
        h(
          'div',
          { style: S.chips },
          h(Chip, { label: t('eventsCount'), value: fmtNumber(hooks.totalEvents) }),
          h(Chip, { label: t('listenersCount'), value: fmtNumber(hooks.totalListeners) }),
          h(Chip, { label: t('recordsCount'), value: fmtNumber(summary.total ?? 0) }),
          h(Chip, { label: t('interceptedCount'), value: fmtNumber(summary.intercepted ?? 0) }),
          summary.errors > 0 ? h(Chip, { label: t('verdictError'), value: fmtNumber(summary.errors) }) : null,
        ),
        h(
          Card,
          { title: t('hooksTitle'), hint: t('hooksHint') },
          h('div', { style: S.toolbar }, h('input', { style: S.input, placeholder: t('hookSearch'), value: hookQuery, onChange: (event) => setHookQuery(event.target.value) })),
          (hooks.notes || []).map((note, index) => h('div', { key: index, style: S.muted }, note)),
          events.length === 0 ? h('div', { style: S.state }, t('noHooks')) : events.map((event) => h(HookEvent, { key: event.name, event, t })),
        ),
        h(
          Card,
          { title: t('recordsTitle'), hint: t('recordsHint') },
          h(
            'div',
            { style: S.toolbar },
            h(
              'select',
              { style: S.select, value: eventFilter, onChange: (event) => setEventFilter(event.target.value) },
              h('option', { value: '' }, t('allEvents')),
              seams.map((seam) => h('option', { key: seam.event, value: seam.event }, `${seam.label} · ${seam.event}`)),
            ),
            h(
              'select',
              { style: S.select, value: verdictFilter, onChange: (event) => setVerdictFilter(event.target.value) },
              h('option', { value: '' }, t('allVerdicts')),
              ['intercept', 'pass', 'error', 'decision'].map((value) => h('option', { key: value, value }, `${value} · ${t(`verdict${value.charAt(0).toUpperCase()}${value.slice(1)}`)}`)),
            ),
            h('span', { style: S.muted }, `${fmtNumber(data.records?.total ?? 0)} ${t('total')}`),
          ),
          (data.records?.items || []).length === 0
            ? h('div', { style: S.state }, t('noRecords'))
            : (data.records.items).map((record, index) => h(RecordRow, { key: `${record.at}:${index}`, record, t })),
        ),
        h(
          Card,
          { title: t('policiesTitle'), hint: t('policiesHint') },
          (data.policies || []).map((policy) => h(
            'div',
            { key: policy.service, style: S.item },
            h(
              'div',
              { style: S.itemHead },
              h('span', { style: S.itemName }, policy.service),
              h('span', { style: S.muted }, policy.present ? `${(policy.fields || []).length} ${t('fields')}` : t('absent')),
            ),
            policy.present
              ? h('details', { style: S.details }, h('summary', { style: S.muted }, t('expand')), h(Pre, { text: JSON.stringify(policy.fields, null, 2) }))
              : null,
          )),
        ),
      )
    }

    function RulesTab({ t }) {
      const [nonce, setNonce] = React.useState(0)
      const state = useApi('/rules', [nonce])
      const header = h(
        'div',
        { style: S.toolbar },
        h('button', { style: S.button, type: 'button', onClick: () => setNonce(nonce + 1) }, t('refresh')),
        state.status === 'ready' ? h('span', { style: S.muted }, formatTime(state.data.generatedAt)) : null,
      )
      if (state.status !== 'ready') return h('div', null, header, h(StateLine, { state, t }))
      const data = state.data
      const approval = data.approval || {}
      const interception = data.interception || {}
      const workspace = data.workspace || {}
      const runtime = interception.toolRuntime || {}
      const counts = runtime.toolCounts || {}
      return h(
        'div',
        null,
        header,
        h(
          'div',
          { style: S.chips },
          h(Chip, { label: t('rulesDeployment'), value: String(approval.deploymentPolicy ?? '—') }),
          h(Chip, { label: t('rulesRuntime'), value: String(runtime.presentation?.mode ?? '—') }),
          h(Chip, { label: 'maxParallel', value: fmtNumber(runtime.presentation?.maxParallelSubCalls) }),
          h(Chip, { label: t('rulesGuards'), value: fmtNumber((runtime.guards || []).length) }),
          h(Chip, { label: t('rulesRestrictions'), value: fmtNumber((runtime.restrictions || []).length) }),
          h(Chip, { label: t('rulesWorkspaces'), value: fmtNumber((workspace.registry || []).length) }),
        ),
        h(
          Card,
          { title: t('rulesApproval'), hint: t('approvalHint') },
          h('p', { style: S.hint }, t('rulesPresets')),
          h(Pre, { text: JSON.stringify(approval.presets, null, 2) }),
          h('p', { style: S.hint }, `${t('rulesSessions')} · ${t('rulesDeployment')}: ${String(approval.deploymentPolicy ?? '—')}`),
          (approval.sessions || []).map((session, index) => h(
            'div',
            { key: index, style: S.item },
            h(
              'div',
              { style: S.itemHead },
              h('span', { style: S.itemName }, shortId(session.id)),
              h('span', { style: S.muted }, session.agentPreset || '—'),
              h('span', { style: S.flag }, `approval: ${session.approvalOverride ?? '—'}`),
              h('span', { style: { ...S.muted, wordBreak: 'break-all' } }, session.cwd || '—'),
            ),
          )),
          h('p', { style: S.hint }, t('rulesHooks')),
          (approval.hooks || []).map((event) => h(HookEvent, { key: `a:${event.name}`, event, t })),
          h('p', { style: S.hint }, t('rulesRecords')),
          (approval.seams?.toolAsksAndDenials || []).length === 0
            ? h('div', { style: S.muted }, t('noRecords'))
            : (approval.seams.toolAsksAndDenials).map((record, index) => h(RecordRow, { key: `ad:${index}`, record, t })),
        ),
        h(
          Card,
          { title: t('rulesIntercept'), hint: t('interceptHint') },
          h(
            'div',
            { style: S.chips },
            h(Chip, { label: t('rulesRuntime'), value: String(runtime.presentation?.mode ?? '—') }),
            h(Chip, { label: 'global tools', value: fmtNumber(counts.global) }),
            h(Chip, { label: t('rulesScoped'), value: fmtNumber(counts.scoped) }),
            h(Chip, { label: 'scoped layers', value: fmtNumber(counts.scopedLayers) }),
          ),
          h('p', { style: S.hint }, t('rulesGuards')),
          (runtime.guards || []).length === 0
            ? h('div', { style: S.muted }, t('noGuards'))
            : runtime.guards.map((guard, index) => h(
              'div',
              { key: index, style: S.item },
              h('div', { style: S.itemHead }, h('span', { style: S.orderChip }, guard.scope), h('span', { style: S.itemName }, guard.name)),
              h(Pre, { text: guard.source }),
            )),
          h('p', { style: S.hint }, t('rulesRestrictions')),
          (runtime.restrictions || []).length === 0
            ? h('div', { style: S.muted }, t('noRestrictions'))
            : runtime.restrictions.map((restriction, index) => h(
              'div',
              { key: index, style: S.item },
              h(
                'div',
                { style: S.itemHead },
                h('span', { style: S.orderChip }, restriction.scope),
                h('span', { style: S.itemName }, `allow: ${(restriction.allow || []).join(', ') || '—'} · deny: ${(restriction.deny || []).join(', ') || '—'}`),
              ),
            )),
          h('p', { style: S.hint }, t('rulesScoped')),
          (runtime.scopedTools || []).map((scope) => h(
            'div',
            { key: scope.scope, style: S.item },
            h(
              'div',
              { style: S.itemHead },
              h('span', { style: S.orderChip }, String(scope.count)),
              h('span', { style: S.itemName }, scope.scope),
              h('span', { style: S.muted }, (scope.names || []).join(', ')),
            ),
          )),
          h('p', { style: S.hint }, t('rulesConfigs')),
          (interception.configs || []).map((config, index) => h(
            'div',
            { key: `${config.id}:${index}`, style: S.item },
            h(
              'div',
              { style: S.itemHead },
              h('span', { style: S.itemName }, config.id),
              h('span', { style: S.muted }, config.name || ''),
              h('span', { style: S.flag }, config.source || ''),
              config.disabled ? h('span', { style: S.flag }, t('disabled')) : null,
            ),
            h(Pre, { text: JSON.stringify(config.config, null, 2) }),
          )),
          h('p', { style: S.hint }, t('rulesHooks')),
          (interception.hooks || []).map((event) => h(HookEvent, { key: `i:${event.name}`, event, t })),
        ),
        h(
          Card,
          { title: t('rulesWorkspace'), hint: t('workspaceHint') },
          h(
            'div',
            { style: S.chips },
            h(Chip, { label: t('rulesSandbox'), value: `${workspace.sandbox?.defaultMode ?? '—'} @ ${workspace.sandbox?.workspaceRoot ?? '—'}` }),
          ),
          h('p', { style: S.hint }, t('rulesWorkspaces')),
          (workspace.registry || []).map((entry) => h(
            'div',
            { key: entry.id ?? entry.path, style: S.item },
            h(
              'div',
              { style: S.itemHead },
              h('span', { style: S.itemName }, entry.title || entry.path || '—'),
              h('span', { style: S.muted }, `${entry.sessionCount} ${t('rulesSessions')}`),
            ),
            h('div', { style: { ...S.muted, wordBreak: 'break-all' } }, entry.path || ''),
          )),
          h('p', { style: S.hint }, t('rulesInternals')),
          h(Pre, { text: JSON.stringify(workspace.internals, null, 2) }),
          h('p', { style: S.hint }, t('rulesHooks')),
          (workspace.hooks || []).map((event) => h(HookEvent, { key: `w:${event.name}`, event, t })),
          (workspace.activityRecords || []).length === 0
            ? null
            : h('p', { style: S.hint }, t('rulesRecords')),
          (workspace.activityRecords || []).map((record, index) => h(RecordRow, { key: `wr:${index}`, record, t })),
        ),
      )
    }

    function InspectorPage({ t }) {
      const [tab, setTab] = React.useState('prompt')
      const [constantsKind, setConstantsKind] = React.useState('constant')
      const tabs = [
        ['prompt', t('tabPrompt')],
        ['intercepts', t('tabIntercepts')],
        ['rules', t('tabRules')],
        ['constants', t('tabConstants')],
        ['configs', t('tabConfigs')],
        ['health', t('tabHealth')],
      ]
      const openDefaults = () => {
        setConstantsKind('default')
        setTab('constants')
      }
      return h(
        'div',
        { style: S.root },
        h(
          'div',
          { style: S.header },
          h(
            'div',
            { style: S.titleRow },
            h('h1', { style: S.title }, t('title')),
            h('span', { style: S.version }, 'dsh-runtime-inspector · v0.1.0'),
          ),
          h('p', { style: S.subtitle }, t('subtitle')),
          h(
            'div',
            { style: S.tabs, role: 'tablist' },
            tabs.map(([value, label]) => h(
              'button',
              {
                key: value,
                type: 'button',
                role: 'tab',
                'aria-selected': tab === value,
                style: tab === value ? { ...S.tab, ...S.tabActive } : S.tab,
                onClick: () => setTab(value),
              },
              label,
            )),
          ),
        ),
        h(
          'div',
          { style: S.body },
          tab === 'prompt' ? h(PromptTab, { t }) : null,
          tab === 'intercepts' ? h(InterceptsTab, { t }) : null,
          tab === 'rules' ? h(RulesTab, { t }) : null,
          tab === 'constants' ? h(ConstantsTab, { t, kind: constantsKind, onKind: setConstantsKind }) : null,
          tab === 'configs' ? h(ConfigsTab, { t, openDefaults }) : null,
          tab === 'health' ? h(HealthTab, { t }) : null,
        ),
      )
    }

    function PanelIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 18
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block', opacity: props.active === false ? 0.75 : 1 },
        },
        h('path', { d: 'M3.5 7h5M3.5 12h4M3.5 17h5' }),
        h('circle', { cx: 13, cy: 12, r: 4.2 }),
        h('path', { d: 'M16.2 15.2 20 19' }),
        h('circle', { cx: 13, cy: 12, r: 1.2, fill: 'currentColor', stroke: 'none' }),
      )
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-runtime-inspector: dictionaries')
      const t = ctx.locale.bind(NS)
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, () => h(InspectorPage, { t })))
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 20,
        locale: NS,
        label: () => t('panel'),
      }, PanelIcon))
    }

    return { apply, inject: ['slots', 'locale'] }
  },
})
