/**
 * dsh-session-exporter — client half.
 * Sidebar entry "会话导出" + a main panel that lists workspace sessions and
 * exports them as JSON / JSONL / Markdown / Q&A JSON (download or write into
 * the workspace). All data comes from the host half's same-origin routes.
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
      downloadZip: '下载选中 ZIP',
      downloadAll: '下载整工作区 ZIP',
      saveToWorkspace: '导出到工作区',
      saveAll: '导出整工作区到磁盘',
      savedAt: '已写入',
      openDir: '目录',
      events: '事件',
      size: '大小',
      created: '创建时间',
      titleCol: '标题',
      idCol: '会话 ID',
      actions: '操作',
      noSessions: '这个工作区没有会话。',
      hint: '数据来自 ctx.sessionPersistence（含冷会话与子会话）；"导出到工作区"会写到 <workspace>/dsh-session-exports/<时间戳>/，并生成 all.md / all.json / all.qa.json 与 manifest.json。',
      md: 'Markdown',
      json: 'JSON（无损）',
      jsonl: 'JSONL',
      qa: '问答 JSON',
      exportSingle: '下载',
      copied: '已复制',
      current: '当前工作区',
      subtitles: '子会话',
      parent: '父会话',
      formatCount: '格式',
      saveEmpty: '请先选择至少一个会话。',
      savedResult: '导出完成',
      files: '文件',
      sessionsCol: '会话',
      noWorkspace: '没有可用的工作区，请在左侧打开一个工作区会话。',
      unknown: '未知',
      toolHint: 'Agent 工具：dsh_session_export（action=list / export / save / workspaces）。',
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
      downloadZip: 'Download selected ZIP',
      downloadAll: 'Download workspace ZIP',
      saveToWorkspace: 'Write into workspace',
      saveAll: 'Write whole workspace',
      savedAt: 'Written to',
      openDir: 'Directory',
      events: 'events',
      size: 'size',
      created: 'created',
      titleCol: 'Title',
      idCol: 'Session id',
      actions: 'Actions',
      noSessions: 'No sessions in this workspace.',
      hint: 'Data comes from ctx.sessionPersistence (cold sessions and subagent sessions included). "Write into workspace" saves under <workspace>/dsh-session-exports/<timestamp>/ with all.md / all.json / all.qa.json and manifest.json.',
      md: 'Markdown',
      json: 'JSON (lossless)',
      jsonl: 'JSONL',
      qa: 'Q&A JSON',
      exportSingle: 'Download',
      copied: 'Copied',
      current: 'current workspace',
      subtitles: 'subagent',
      parent: 'parent',
      formatCount: 'formats',
      saveEmpty: 'Select at least one session first.',
      savedResult: 'Export finished',
      files: 'files',
      sessionsCol: 'sessions',
      noWorkspace: 'No workspace available — open a workspace session on the left first.',
      unknown: 'unknown',
      toolHint: 'Agent tool: dsh_session_export (action=list / export / save / workspaces).',
    }

    const S = {
      root: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontFamily: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif' },
      header: { padding: '18px 24px 0', flex: '0 0 auto' },
      titleRow: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
      title: { margin: 0, fontSize: 18, fontWeight: 600 },
      version: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
      subtitle: { margin: '6px 0 12px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--dsw-alias-label-secondary)', maxWidth: 920 },
      body: { flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: '14px 24px 28px' },
      card: { border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, minWidth: 0 },
      cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
      cardTitle: { margin: 0, fontSize: 13.5, fontWeight: 600 },
      hint: { margin: '0 0 10px', fontSize: 11.5, lineHeight: 1.55, color: 'var(--dsw-alias-label-secondary)' },
      toolbar: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 },
      chips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
      chip: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)', background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 999, padding: '2px 9px', lineHeight: 1.6 },
      chipValue: { color: 'var(--dsw-alias-label-primary)', fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
      button: { appearance: 'none', fontSize: 11.5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', cursor: 'pointer' },
      buttonPrimary: { appearance: 'none', fontSize: 11.5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--dsw-alias-brand-primary)', background: 'var(--dsw-alias-brand-primary)', color: '#fff', cursor: 'pointer' },
      input: { appearance: 'none', fontSize: 12, padding: '5px 9px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', minWidth: 220 },
      select: { appearance: 'none', fontSize: 12, padding: '5px 9px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', maxWidth: 380 },
      rowHead: { display: 'grid', gridTemplateColumns: '28px minmax(180px, 1.6fr) minmax(120px, 1.1fr) 78px 78px 86px minmax(120px, 1fr)', gap: 8, fontSize: 11, color: 'var(--dsw-alias-label-secondary)', padding: '0 2px 6px', fontWeight: 600, borderBottom: '1px solid var(--dsw-alias-border-l1)' },
      row: { display: 'grid', gridTemplateColumns: '28px minmax(180px, 1.6fr) minmax(120px, 1.1fr) 78px 78px 86px minmax(120px, 1fr)', gap: 8, alignItems: 'center', fontSize: 12, padding: '6px 2px', borderBottom: '1px solid var(--dsw-alias-border-l1)' },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      muted: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' },
      state: { fontSize: 12.5, color: 'var(--dsw-alias-label-secondary)', padding: '10px 0' },
      error: { fontSize: 12.5, color: 'var(--dsw-alias-state-error-primary)', padding: '8px 0', whiteSpace: 'pre-wrap' },
      link: { fontSize: 11.5, color: 'var(--dsw-alias-brand-primary)', textDecoration: 'none', marginRight: 8, cursor: 'pointer' },
      pre: { margin: '6px 0 0', padding: '9px 11px', background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 11.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflow: 'auto' },
      checkbox: { width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--dsw-alias-brand-primary)' },
    }

    function formatTime(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      try {
        return new Date(value).toLocaleString()
      } catch {
        return String(value)
      }
    }

    function fmtBytes(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      if (value < 1024) return `${value} B`
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
      return `${(value / 1048576).toFixed(1)} MiB`
    }

    function shortId(value) {
      if (typeof value !== 'string') return '—'
      const text = value.startsWith('session-') ? value.slice(8) : value
      return text.length > 10 ? `${text.slice(0, 10)}…` : text
    }

    function Chip(props) {
      return h('span', { style: S.chip }, props.label, props.value === undefined ? null : h('span', { style: S.chipValue }, String(props.value)))
    }

    function Card(props) {
      return h('section', { style: S.card },
        h('div', { style: S.cardHead }, h('h2', { style: S.cardTitle }, props.title), props.actions === undefined ? null : h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, props.actions)),
        props.hint === undefined ? null : h('p', { style: S.hint }, props.hint),
        props.children)
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
      const [busy, setBusy] = useState('')
      const [notice, setNotice] = useState(null)
      const workspacesState = useApi('/workspaces', [nonce])
      const query = allMode ? '?all=1&titles=1' : `?workspace=${encodeURIComponent(workspace)}&titles=1`
      const sessionsState = useApi(`/sessions${workspace === '' && !allMode ? '?titles=1' : query}`, [nonce, workspace, allMode])

      const workspaces = workspacesState.status === 'ready' ? workspacesState.data.workspaces || [] : []
      const sessions = sessionsState.status === 'ready' ? sessionsState.data.sessions || [] : []
      const workspacePath = sessionsState.status === 'ready' ? sessionsState.data.workspace || workspace : workspace

      useEffect(() => {
        if (workspace === '' && workspaces.length > 0) setWorkspace(workspaces[0].path)
      }, [workspacesState.status, workspace, workspaces.length])

      useEffect(() => { setSelected([]) }, [workspace, allMode, nonce])

      const toggleFormat = (format) => {
        setFormats((current) => current.includes(format) ? (current.length > 1 ? current.filter((entry) => entry !== format) : current) : [...current, format])
      }

      const toggleSelected = (id) => {
        setSelected((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id])
      }

      const allSelected = sessions.length > 0 && selected.length === sessions.length

      const save = useCallback(async (mode) => {
        const ids = mode === 'all' ? 'all' : selected
        if (mode !== 'all' && ids.length === 0) { setNotice({ kind: 'error', text: t('saveEmpty') }); return }
        setBusy('save')
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
          setNotice({ kind: 'ok', text: `${t('savedResult')} · ${body.sessions} ${t('sessionsCol')} → ${body.directory}` })
        } catch (error) {
          setNotice({ kind: 'error', text: String(error?.message ?? error) })
        } finally {
          setBusy('')
        }
      }, [selected, formats, workspacePath, t])

      const refresh = () => setNonce(nonce + 1)

      return h('div', { style: S.root },
        h('div', { style: S.header },
          h('div', { style: S.titleRow }, h('h1', { style: S.title }, t('title')), h('span', { style: S.version }, 'dsh-session-exporter · v0.1.0')),
          h('p', { style: S.subtitle }, t('subtitle')),
        ),
        h('div', { style: S.body },
          h('div', { style: S.toolbar },
            h('button', { style: S.button, type: 'button', onClick: refresh }, t('refresh')),
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
            h('span', { style: S.muted }, `${sessions.length} ${t('sessions')} · ${selected.length} ${t('selected')}`),
            h('span', { style: S.muted }, t('formats')),
            ['md', 'json', 'jsonl', 'qa'].map((format) => h('label', { key: format, style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' } },
              h('input', { type: 'checkbox', style: S.checkbox, checked: formats.includes(format), onChange: () => toggleFormat(format) }),
              format)),
          ),
          sessionsState.status === 'loading' ? h('div', { style: S.state }, t('loading')) : null,
          sessionsState.status === 'error' ? h('div', { style: S.error }, `${t('error')}: ${sessionsState.error}`) : null,
          h(Card, {
            title: `${t('title')} · ${allMode ? t('allSessions') : workspacePath || t('unknown')}`,
            hint: t('hint'),
            actions: [
              h('button', { key: 'all', style: S.button, type: 'button', onClick: () => setSelected(allSelected ? [] : sessions.map((row) => row.id)) }, allSelected ? t('clear') : t('selectAll')),
              h('a', { key: 'zip', style: S.buttonPrimary, href: `${API}/export-all?${allMode ? 'all=1' : `workspace=${encodeURIComponent(workspacePath)}`}&formats=${formats.join(',')}`, download: '' }, t('downloadAll')),
              h('button', { key: 'saveall', style: S.button, type: 'button', disabled: busy !== '', onClick: () => save('all') }, t('saveAll')),
              h('button', { key: 'savesel', style: S.button, type: 'button', disabled: busy !== '' || selected.length === 0, onClick: () => save('selected') }, t('saveToWorkspace')),
            ],
          },
            notice === null ? null : h('div', { style: notice.kind === 'error' ? S.error : { ...S.muted, marginBottom: 8, wordBreak: 'break-all' } }, notice.text),
            sessionsState.status === 'ready' && sessions.length === 0 ? h('div', { style: S.state }, t('noSessions')) : null,
            sessionsState.status === 'ready' && sessions.length > 0 ? h('div', null,
              h('div', { style: S.rowHead },
                h('span', null, ''),
                h('span', null, t('titleCol')),
                h('span', null, t('idCol')),
                h('span', null, t('events')),
                h('span', null, t('size')),
                h('span', null, t('created')),
                h('span', null, t('actions')),
              ),
              sessions.map((row) => h('div', { key: row.id, style: S.row },
                h('input', { type: 'checkbox', style: S.checkbox, checked: selected.includes(row.id), onChange: () => toggleSelected(row.id) }),
                h('span', { style: { ...S.mono, whiteSpace: 'normal' }, title: row.title || row.id }, row.title || `${t('unknown')} ${shortId(row.id)}`),
                h('span', { style: S.mono, title: row.id }, shortId(row.id)),
                h('span', { style: S.mono }, row.events === null ? '—' : String(row.events)),
                h('span', { style: S.mono }, fmtBytes(row.bytes)),
                h('span', { style: S.mono }, formatTime(row.createdAt)),
                h('span', null, ['md', 'json', 'qa'].map((format) => h('a', { key: format, style: S.link, href: downloadUrl(row.id, format), download: '' }, format))),
              )),
            ) : null,
          ),
          h('p', { style: S.hint }, t('toolHint')),
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
