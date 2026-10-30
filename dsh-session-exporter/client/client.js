/**
 * dsh-session-exporter — client half.
 * Sidebar entry "会话导出" + a compact, plain main panel that lists workspace
 * sessions and exports them as JSON / JSONL / Markdown / Q&A JSON.
 */
window.__ModuleLoader__.load({
  id: 'dsh-session-exporter',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback } = React

    const NS = 'dshSessionExporter'
    const PANEL_ID = 'session-exporter'
    const API = '/dsh-session-exporter'

    const zh = {
      panel: '会话导出',
      title: '会话导出',
      subtitle: '按工作区导出全部会话记录：单会话或整批导出 JSON / JSONL / Markdown / 问答 JSON，下载 ZIP 或写进工作区；也可以让 AI 基于导出内容提炼 Markdown 文档。',
      workspace: '工作区',
      allSessions: '全部会话（跨工作区）',
      refresh: '刷新',
      loading: '读取中…',
      error: '读取失败',
      sessions: '会话',
      selected: '已选',
      selectAll: '全选',
      clear: '清空',
      formats: '格式',
      downloadAll: '下载 ZIP',
      saveSelected: '导出选中到工作区',
      saveAll: '导出全部到工作区',
      saveEmpty: '请先选择至少一个会话。',
      savedResult: '已写入',
      events: '事件',
      size: '大小',
      created: '创建时间',
      titleCol: '标题',
      idCol: '会话 ID',
      actions: '下载',
      noSessions: '这个工作区没有会话。',
      hint: '数据来自 ctx.sessionPersistence（含冷会话与子会话）。"导出到工作区"写入 <workspace>/dsh-session-exports/<时间戳>/，并生成 all.md / all.json / all.qa.json 与 manifest.json。',
      md: 'MD',
      json: 'JSON',
      jsonl: 'JSONL',
      qa: 'QA',
      current: '当前工作区',
      none: '—',
      unknown: '未命名',
      toolHint: 'Agent 工具：dsh_session_export（list / export / save / workspaces）。',
      total: '共',
    }

    const en = {
      panel: 'Session Export',
      title: 'Session Export',
      subtitle: 'Export every session of a workspace: one session or a batch as JSON / JSONL / Markdown / Q&A JSON, download a ZIP or write files into the workspace; the agent can then distill the export into a Markdown document.',
      workspace: 'Workspace',
      allSessions: 'All sessions (every workspace)',
      refresh: 'Refresh',
      loading: 'Loading…',
      error: 'Failed to load',
      sessions: 'sessions',
      selected: 'selected',
      selectAll: 'Select all',
      clear: 'Clear',
      formats: 'Formats',
      downloadAll: 'Download ZIP',
      saveSelected: 'Write selected',
      saveAll: 'Write all',
      saveEmpty: 'Select at least one session first.',
      savedResult: 'Written to',
      events: 'Events',
      size: 'Size',
      created: 'Created',
      titleCol: 'Title',
      idCol: 'Session id',
      actions: 'Download',
      noSessions: 'No sessions in this workspace.',
      hint: 'Data comes from ctx.sessionPersistence (cold and subagent sessions included). "Write into workspace" saves under <workspace>/dsh-session-exports/<timestamp>/ with all.md / all.json / all.qa.json and manifest.json.',
      md: 'MD',
      json: 'JSON',
      jsonl: 'JSONL',
      qa: 'QA',
      current: 'current workspace',
      none: '—',
      unknown: 'untitled',
      toolHint: 'Agent tool: dsh_session_export (list / export / save / workspaces).',
      total: 'total',
    }

    const FONT = 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

    const S = {
      root: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontFamily: FONT, fontSize: 12 },
      header: { padding: '12px 16px 8px', flex: '0 0 auto', borderBottom: '1px solid var(--dsw-alias-border-l1)' },
      titleRow: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
      title: { margin: 0, fontSize: 15, fontWeight: 650, letterSpacing: 0.1 },
      version: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', fontFamily: MONO },
      subtitle: { margin: '3px 0 0', fontSize: 11.5, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)', maxWidth: 980 },
      body: { flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: '10px 16px 20px' },
      toolbar: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
      spacer: { flex: '1 1 auto' },
      sep: { width: 1, height: 16, background: 'var(--dsw-alias-border-l1)', margin: '0 2px' },
      label: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', whiteSpace: 'nowrap' },
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
        fontFamily: FONT,
      },
      buttonPrimary: {
        appearance: 'none',
        height: 24,
        padding: '0 9px',
        borderRadius: 3,
        border: '1px solid var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-brand-primary)',
        color: '#fff',
        fontSize: 11.5,
        lineHeight: '22px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: FONT,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
      },
      buttonDisabled: { opacity: 0.45, cursor: 'default' },
      linkButton: {
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
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: FONT,
      },
      select: {
        appearance: 'none',
        height: 24,
        padding: '0 6px',
        borderRadius: 3,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 11.5,
        maxWidth: 360,
        fontFamily: FONT,
      },
      checkbox: { width: 13, height: 13, margin: 0, cursor: 'pointer', accentColor: 'var(--dsw-alias-brand-primary)' },
      checkGroup: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer' },
      muted: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', whiteSpace: 'nowrap' },
      tableBox: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 3, overflow: 'auto', background: 'var(--dsw-alias-bg-layer-1)' },
      rowGrid: '22px minmax(150px, 1.6fr) 128px 54px 72px 118px 112px',
      head: { display: 'grid', gridTemplateColumns: '22px minmax(150px, 1.6fr) 128px 54px 72px 118px 112px', gap: 8, alignItems: 'center', padding: '5px 8px', background: 'var(--dsw-alias-bg-layer-2)', fontSize: 10.5, fontWeight: 600, color: 'var(--dsw-alias-label-secondary)', borderBottom: '1px solid var(--dsw-alias-border-l1)' },
      row: { display: 'grid', gridTemplateColumns: '22px minmax(150px, 1.6fr) 128px 54px 72px 118px 112px', gap: 8, alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--dsw-alias-border-l1)', fontSize: 11.5 },
      cellTitle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      mono: { fontFamily: MONO, fontSize: 11, color: 'var(--dsw-alias-label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      num: { fontFamily: MONO, fontSize: 11, color: 'var(--dsw-alias-label-secondary)', textAlign: 'right' },
      link: { color: 'var(--dsw-alias-brand-primary)', textDecoration: 'none', fontSize: 11, marginRight: 6, cursor: 'pointer', whiteSpace: 'nowrap' },
      noticeOk: { fontSize: 11, color: 'var(--dsw-alias-state-success-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 },
      noticeError: { fontSize: 11, color: 'var(--dsw-alias-state-error-primary)', whiteSpace: 'normal', wordBreak: 'break-all' },
      state: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)', padding: '10px 8px' },
      errorBox: { fontSize: 11.5, color: 'var(--dsw-alias-state-error-primary)', padding: '8px', whiteSpace: 'pre-wrap' },
      hint: { margin: '6px 0 0', fontSize: 10.5, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)' },
    }

    function formatTime(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      try {
        const date = new Date(value)
        const pad = (n) => String(n).padStart(2, '0')
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
      } catch {
        return '—'
      }
    }

    function fmtBytes(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      if (value < 1024) return `${value}B`
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)}K`
      return `${(value / 1048576).toFixed(1)}M`
    }

    function shortId(value) {
      if (typeof value !== 'string') return '—'
      const text = value.startsWith('session-') ? value.slice(8) : value
      return text.length > 8 ? text.slice(0, 8) : text
    }

    function useApi(path, deps) {
      const [state, setState] = useState({ status: 'loading' })
      useEffect(() => {
        let alive = true
        setState({ status: 'loading' })
        fetch(`${API}${path}`, { cache: 'no-store', credentials: 'same-origin', headers: { accept: 'application/json' } })
          .then(async (response) => {
            if (!response.ok) {
              const body = await response.text().catch(() => '')
              throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
            }
            return response.json()
          })
          .then((data) => { if (alive) setState({ status: 'ready', data }) })
          .catch((error) => { if (alive) setState({ status: 'error', error: String(error?.message ?? error) }) })
        return () => { alive = false }
      }, deps)
      return state
    }

    function downloadUrl(session, format) {
      return `${API}/export?session=${encodeURIComponent(session)}&format=${format}&download=1`
    }

    function ExporterPage({ t }) {
      const [nonce, setNonce] = useState(0)
      const [workspace, setWorkspace] = useState('')
      const [allMode, setAllMode] = useState(false)
      const [formats, setFormats] = useState(['md'])
      const [selected, setSelected] = useState([])
      const [busy, setBusy] = useState(false)
      const [notice, setNotice] = useState(null)
      const workspacesState = useApi('/workspaces', [nonce])
      const sessionsState = useApi(
        allMode ? '/sessions?all=1&titles=1' : workspace === '' ? '/sessions?titles=1' : `/sessions?workspace=${encodeURIComponent(workspace)}&titles=1`,
        [nonce, workspace, allMode],
      )

      const workspaces = workspacesState.status === 'ready' ? workspacesState.data.workspaces || [] : []
      const sessions = sessionsState.status === 'ready' ? sessionsState.data.sessions || [] : []
      const workspacePath = sessionsState.status === 'ready' ? sessionsState.data.workspace || workspace : workspace
      const allSelected = sessions.length > 0 && selected.length === sessions.length

      useEffect(() => {
        if (workspace === '' && workspaces.length > 0 && !allMode) setWorkspace(workspaces[0].path)
      }, [workspacesState.status, workspace, workspaces.length, allMode])

      useEffect(() => { setSelected([]) }, [workspace, allMode, nonce])

      const toggleFormat = (format) => {
        setFormats((current) => current.includes(format) ? (current.length > 1 ? current.filter((entry) => entry !== format) : current) : [...current, format])
      }

      const toggleSelected = (id) => {
        setSelected((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id])
      }

      const save = useCallback(async (mode) => {
        const ids = mode === 'all' ? 'all' : selected
        if (mode !== 'all' && ids.length === 0) { setNotice({ kind: 'error', text: t('saveEmpty') }); return }
        setBusy(true)
        setNotice(null)
        try {
          const response = await fetch(`${API}/save`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ workspace: workspacePath, sessions: ids, formats }),
          })
          const body = await response.json().catch(() => null)
          if (!response.ok || body === null) throw new Error(body?.error ?? `HTTP ${response.status}`)
          setNotice({ kind: 'ok', text: `${t('savedResult')} ${body.directory}` })
        } catch (error) {
          setNotice({ kind: 'error', text: String(error?.message ?? error) })
        } finally {
          setBusy(false)
        }
      }, [selected, formats, workspacePath, t])

      const busyButton = (disabled) => ({ ...S.button, ...(disabled ? S.buttonDisabled : {}) })

      return h('div', { style: S.root },
        h('div', { style: S.header },
          h('div', { style: S.titleRow }, h('h1', { style: S.title }, t('title')), h('span', { style: S.version }, 'dsh-session-exporter v0.1.0')),
          h('p', { style: S.subtitle }, t('subtitle')),
        ),
        h('div', { style: S.body },
          // row 1: scope + formats
          h('div', { style: S.toolbar },
            h('span', { style: S.label }, t('workspace')),
            h('select', {
              style: S.select,
              value: allMode ? '__all__' : workspace,
              onChange: (event) => {
                if (event.target.value === '__all__') { setAllMode(true); setWorkspace('') }
                else { setAllMode(false); setWorkspace(event.target.value) }
              },
            },
            workspaces.map((entry) => h('option', { key: entry.id ?? entry.path, value: entry.path }, `${entry.title || entry.path} (${entry.sessionCount})`)),
            h('option', { value: '__all__' }, t('allSessions'))),
            h('button', { style: S.button, type: 'button', onClick: () => setNonce(nonce + 1) }, t('refresh')),
            h('span', { style: S.sep }),
            h('span', { style: S.label }, t('formats')),
            ['md', 'json', 'jsonl', 'qa'].map((format) => h('label', { key: format, style: S.checkGroup },
              h('input', { type: 'checkbox', style: S.checkbox, checked: formats.includes(format), onChange: () => toggleFormat(format) }),
              format)),
            h('span', { style: S.spacer }),
            h('span', { style: S.muted }, `${t('total')} ${sessions.length} · ${t('selected')} ${selected.length}`),
          ),
          // row 2: actions
          h('div', { style: S.toolbar },
            h('button', { style: S.button, type: 'button', onClick: () => setSelected(allSelected ? [] : sessions.map((row) => row.id)) }, allSelected ? t('clear') : t('selectAll')),
            h('a', {
              style: S.buttonPrimary,
              href: `${API}/export-all?${allMode ? 'all=1' : `workspace=${encodeURIComponent(workspacePath)}`}&formats=${formats.join(',')}`,
              download: '',
            }, t('downloadAll')),
            h('button', { style: busyButton(busy || allMode || workspacePath === ''), type: 'button', disabled: busy || allMode || workspacePath === '', onClick: () => save('all') }, t('saveAll')),
            h('button', { style: busyButton(busy || allMode || selected.length === 0), type: 'button', disabled: busy || allMode || selected.length === 0, onClick: () => save('selected') }, t('saveSelected')),
            notice === null ? null : h('span', { style: notice.kind === 'error' ? S.noticeError : S.noticeOk, title: notice.text }, notice.text),
          ),
          // table
          h('div', { style: S.tableBox },
            h('div', { style: S.head },
              h('span'),
              h('span', null, t('titleCol')),
              h('span', null, t('idCol')),
              h('span', { style: { textAlign: 'right' } }, t('events')),
              h('span', { style: { textAlign: 'right' } }, t('size')),
              h('span', null, t('created')),
              h('span', null, t('actions')),
            ),
            sessionsState.status === 'loading' ? h('div', { style: S.state }, t('loading')) : null,
            sessionsState.status === 'error' ? h('div', { style: S.errorBox }, `${t('error')}: ${sessionsState.error}`) : null,
            sessionsState.status === 'ready' && sessions.length === 0 ? h('div', { style: S.state }, t('noSessions')) : null,
            sessionsState.status === 'ready' ? sessions.map((row) => h('div', { key: row.id, style: S.row },
              h('input', { type: 'checkbox', style: S.checkbox, checked: selected.includes(row.id), onChange: () => toggleSelected(row.id) }),
              h('span', { style: S.cellTitle, title: row.title || row.id }, row.title || t('unknown')),
              h('span', { style: S.mono, title: row.id }, shortId(row.id)),
              h('span', { style: S.num }, row.events === null ? '—' : String(row.events)),
              h('span', { style: S.num }, fmtBytes(row.bytes)),
              h('span', { style: S.mono }, formatTime(row.createdAt)),
              h('span', null, ['md', 'json', 'qa'].map((format) => h('a', { key: format, style: S.link, href: downloadUrl(row.id, format), download: '' }, t(format)))),
            )) : null,
          ),
          h('p', { style: S.hint }, t('hint')),
          h('p', { style: { ...S.hint, margin: '2px 0 0' } }, t('toolHint')),
        ),
      )
    }

    function PanelIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 18
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, style: { display: 'block' } },
        h('rect', { x: 3, y: 4, width: 13, height: 3.4, rx: 1 }),
        h('rect', { x: 3, y: 9.4, width: 10, height: 3.4, rx: 1 }),
        h('rect', { x: 3, y: 14.8, width: 13, height: 3.4, rx: 1 }),
        h('path', { d: 'M18.5 8.5v7' }),
        h('path', { d: 'M15.8 12.9l2.7 2.7 2.7-2.7' }),
        h('path', { d: 'M16 20h6' }),
      )
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-session-exporter: dictionaries')
      const t = ctx.locale.bind(NS)
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, () => h(ExporterPage, { t })))
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 30,
        locale: NS,
        label: () => t('panel'),
      }, PanelIcon))
    }

    return { apply, inject: ['slots', 'locale'] }
  },
})
