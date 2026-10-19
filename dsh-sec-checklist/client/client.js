/**
 * dsh-sec-checklist — client half.
 * Settings section "安全清单": tabbed workspace for project/auth, scope,
 * credentials, checklist items, skill selection and generated docs.
 */
window.__ModuleLoader__.load({
  id: 'dsh-sec-checklist',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement
    const { useState, useEffect } = React

    const NS = 'dsh-sec-checklist'
    const API = {
      state: '/dsh-sec-checklist/state',
      config: '/dsh-sec-checklist/config',
      preview: '/dsh-sec-checklist/preview',
      doc: '/dsh-sec-checklist/doc',
      reveal: '/dsh-sec-checklist/reveal',
      reset: '/dsh-sec-checklist/reset',
    }

    const CSS = ".sc { --sc-line: rgba(125,135,155,.20); --sc-line-strong: rgba(125,135,155,.34); --sc-fill: rgba(125,135,155,.06); --sc-fill-2: rgba(125,135,155,.10); --sc-muted: .58; --sc-accent: #2f6fed; --sc-accent-soft: rgba(47,111,237,.10); --sc-ok: #1f9d55; --sc-danger: #d64545; display: flex; flex-direction: column; gap: 16px; padding: 2px 2px 40px; font-size: 13px; color: var(--dsh-text, #1f2329); }\n@media (prefers-color-scheme: dark) { .sc { --sc-line: rgba(190,200,220,.18); --sc-line-strong: rgba(190,200,220,.3); --sc-fill: rgba(190,200,220,.06); --sc-fill-2: rgba(190,200,220,.1); --sc-accent-soft: rgba(96,150,255,.16); } }\n.sc * { box-sizing: border-box; }\n.sc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }\n.sc-title { font-size: 19px; font-weight: 650; margin: 0 0 6px; letter-spacing: .2px; }\n.sc-sub { margin: 0; max-width: 860px; line-height: 1.65; color: rgba(125,135,155,.95); font-size: 12.5px; }\n.sc-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; flex-shrink: 0; }\n.sc-btn { border: 1px solid var(--sc-line-strong); background: transparent; color: inherit; border-radius: 9px; padding: 6px 12px; font-size: 12.5px; cursor: pointer; line-height: 1.35; white-space: nowrap; transition: background .15s, border-color .15s, transform .05s; }\n.sc-btn:hover { background: var(--sc-fill-2); border-color: var(--sc-line-strong); }\n.sc-btn:active { transform: translateY(1px); }\n.sc-btn.primary { background: var(--sc-accent); border-color: var(--sc-accent); color: #fff; box-shadow: 0 2px 10px rgba(47,111,237,.28); }\n.sc-btn.primary:hover { background: #2559c4; border-color: #2559c4; }\n.sc-btn.sm { padding: 3px 9px; font-size: 12px; border-radius: 7px; }\n.sc-btn.ghost { border-color: transparent; background: transparent; opacity: .8; }\n.sc-btn.ghost:hover { opacity: 1; background: var(--sc-fill); }\n.sc-btn.danger { color: var(--sc-danger); border-color: rgba(214,69,69,.34); }\n.sc-btn.danger:hover { background: rgba(214,69,69,.08); }\n.sc-btn:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }\n.sc-chips { display: flex; flex-wrap: wrap; gap: 10px; }\n.sc-chip { display: inline-flex; align-items: baseline; gap: 7px; border: 1px solid var(--sc-line); border-radius: 12px; padding: 8px 14px; background: var(--sc-fill); }\n.sc-chip b { font-size: 18px; font-weight: 650; font-variant-numeric: tabular-nums; }\n.sc-chip span { color: var(--sc-muted); font-size: 12px; }\n.sc-tabs { display: flex; gap: 4px; flex-wrap: wrap; padding: 5px; border: 1px solid var(--sc-line); border-radius: 12px; background: var(--sc-fill); }\n.sc-tab { border: 0; background: transparent; color: inherit; padding: 7px 13px; border-radius: 9px; font-size: 12.5px; cursor: pointer; opacity: .72; display: inline-flex; align-items: center; gap: 7px; transition: background .15s, opacity .15s; }\n.sc-tab:hover { opacity: .95; background: var(--sc-fill-2); }\n.sc-tab.active { background: var(--dsh-bg, #fff); opacity: 1; font-weight: 600; box-shadow: 0 1px 6px rgba(15,23,42,.10); }\n.sc-tab .n { display: inline-block; min-width: 18px; padding: 0 6px; border-radius: 999px; font-size: 11px; line-height: 18px; text-align: center; background: var(--sc-fill-2); opacity: .8; }\n.sc-card { border: 1px solid var(--sc-line); border-radius: 14px; background: var(--dsh-bg, #fff); box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px -20px rgba(15,23,42,.35); overflow: hidden; }\n.sc-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 14px 16px 10px; border-bottom: 1px solid var(--sc-line); }\n.sc-card-title { margin: 0; font-size: 14px; font-weight: 650; display: flex; align-items: center; gap: 8px; }\n.sc-card-title::before { content: ''; width: 3px; height: 14px; border-radius: 2px; background: var(--sc-accent); opacity: .85; }\n.sc-card-desc { margin: 5px 0 0; font-size: 12px; color: var(--sc-muted); line-height: 1.6; }\n.sc-card-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 14px; }\n.sc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px 16px; }\n.sc-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }\n.sc-field > span { font-size: 12px; color: var(--sc-muted); }\n.sc-field > small { font-size: 11px; color: var(--sc-muted); line-height: 1.5; }\n.sc input[type=text], .sc input[type=password], .sc input[type=number], .sc select, .sc textarea { border: 1px solid var(--sc-line-strong); border-radius: 8px; background: transparent; color: inherit; padding: 6px 9px; font-size: 12.5px; font-family: inherit; width: 100%; transition: border-color .15s, box-shadow .15s; }\n.sc input:focus, .sc select:focus, .sc textarea:focus { outline: none; border-color: var(--sc-accent); box-shadow: 0 0 0 3px var(--sc-accent-soft); }\n.sc textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; min-height: 64px; resize: vertical; line-height: 1.55; }\n.sc .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }\n.sc .muted { color: var(--sc-muted); }\n.sc table { width: 100%; border-collapse: collapse; }\n.sc th, .sc td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--sc-line); vertical-align: top; }\n.sc th { font-weight: 600; font-size: 11.5px; color: var(--sc-muted); white-space: nowrap; letter-spacing: .2px; }\n.sc tbody tr:hover td { background: var(--sc-fill); }\n.sc tr:last-child td { border-bottom: none; }\n.sc-tag { display: inline-flex; align-items: center; padding: 0 7px; border-radius: 6px; font-size: 11px; line-height: 18px; border: 1px solid var(--sc-line-strong); color: var(--sc-muted); white-space: nowrap; }\n.sc-tag.rec { color: var(--sc-ok); border-color: rgba(31,157,85,.35); background: rgba(31,157,85,.08); }\n.sc-tag.acc { color: var(--sc-accent); border-color: rgba(47,111,237,.35); background: var(--sc-accent-soft); }\n.sc-tag.on { color: var(--sc-ok); border-color: rgba(31,157,85,.3); }\n.sc-progress { height: 8px; border-radius: 999px; background: var(--sc-fill-2); overflow: hidden; }\n.sc-progress > i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #2f6fed, #41b3a3); transition: width .3s; }\n.sc-ready { display: flex; flex-direction: column; gap: 8px; }\n.sc-ready-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--sc-line); border-radius: 10px; background: var(--sc-fill); }\n.sc-ready-row .dot { width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; border: 1px solid var(--sc-line-strong); color: var(--sc-muted); }\n.sc-ready-row.ok .dot { background: rgba(31,157,85,.14); border-color: rgba(31,157,85,.4); color: var(--sc-ok); }\n.sc-ready-row .lbl { flex: 1; }\n.sc-item { border: 1px solid var(--sc-line); border-radius: 12px; padding: 11px 12px; display: flex; flex-direction: column; gap: 9px; background: var(--dsh-bg, #fff); transition: border-color .15s, box-shadow .15s; }\n.sc-item:hover { border-color: var(--sc-line-strong); box-shadow: 0 6px 18px -14px rgba(15,23,42,.5); }\n.sc-item.off { opacity: .55; }\n.sc-item-head { display: flex; align-items: center; gap: 9px; }\n.sc-item-head input[type=checkbox] { width: 15px; height: 15px; flex-shrink: 0; }\n.sc-item-title { flex: 1; font-weight: 600; min-width: 0; }\n.sc-item-fields { display: grid; grid-template-columns: 1.35fr 1fr 1.1fr 1fr; gap: 8px; }\n.sc-item-fields > * { min-width: 0; }\n.sc-cat-block { display: flex; flex-direction: column; gap: 9px; }\n.sc-cat-head { display: flex; align-items: center; gap: 10px; font-weight: 650; font-size: 13px; }\n.sc-cat-head small { font-weight: 400; color: var(--sc-muted); font-size: 11.5px; }\n.sc-cat-head .sc-btn { margin-left: auto; }\n.sc-skill-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }\n.sc-skill { border: 1px solid var(--sc-line); border-radius: 12px; padding: 10px 12px; display: flex; gap: 10px; align-items: flex-start; cursor: pointer; transition: border-color .15s, background .15s; }\n.sc-skill:hover { border-color: var(--sc-line-strong); background: var(--sc-fill); }\n.sc-skill.on { border-color: rgba(47,111,237,.55); background: var(--sc-accent-soft); }\n.sc-skill input[type=checkbox] { width: 15px; height: 15px; margin-top: 2px; flex-shrink: 0; }\n.sc-skill-main { min-width: 0; flex: 1; }\n.sc-skill-name { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-weight: 600; font-size: 12.5px; }\n.sc-skill-desc { margin-top: 4px; font-size: 11.5px; line-height: 1.5; color: var(--sc-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n.sc-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }\n.sc-toolbar .grow { flex: 1; min-width: 180px; }\n.sc-pre { margin: 0; white-space: pre-wrap; word-break: break-word; max-height: 520px; overflow: auto; background: var(--sc-fill); border: 1px solid var(--sc-line); border-radius: 10px; padding: 12px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.65; }\n.sc-msg { border-radius: 10px; padding: 9px 13px; border: 1px solid rgba(47,111,237,.3); background: var(--sc-accent-soft); font-size: 12.5px; }\n.sc-msg.err { border-color: rgba(214,69,69,.35); background: rgba(214,69,69,.08); }\n.sc-empty { padding: 22px 12px; text-align: center; color: var(--sc-muted); border: 1px dashed var(--sc-line-strong); border-radius: 12px; font-size: 12.5px; }\n.sc-toggle { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; font-size: 12.5px; }\n.sc-toggle input { width: 15px; height: 15px; }\n.sc-toggle small { color: var(--sc-muted); font-size: 11px; }\n.sc-hint { font-size: 11.5px; color: var(--sc-muted); line-height: 1.6; }\n.sc-kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }\n.sc-kv > div { border: 1px solid var(--sc-line); border-radius: 10px; padding: 9px 11px; background: var(--sc-fill); min-width: 0; }\n.sc-kv b { display: block; font-size: 15px; font-weight: 650; margin-top: 3px; word-break: break-word; }\n.sc-kv span { font-size: 11.5px; color: var(--sc-muted); }\n.sc-steps { display: flex; flex-direction: column; gap: 8px; }\n.sc-step { display: flex; gap: 10px; align-items: flex-start; font-size: 12.5px; line-height: 1.55; }\n.sc-step i { flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; background: var(--sc-accent-soft); color: var(--sc-accent); font-style: normal; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; font-weight: 650; }\n.sc-savebar { position: sticky; bottom: 0; display: flex; justify-content: flex-end; gap: 8px; padding: 10px 0 2px; background: linear-gradient(180deg, transparent, var(--dsh-bg, #fff) 45%); }"

    let styleEl = null
    function ensureStyle() {
      if (styleEl || typeof document === 'undefined') return
      styleEl = document.createElement('style')
      styleEl.setAttribute('data-dsh-sec-checklist', '')
      styleEl.textContent = CSS
      document.head.appendChild(styleEl)
    }

    async function request(url, options) {
      const res = await fetch(url, options)
      let body = null
      try { body = await res.json() } catch (e) { body = null }
      if (!res.ok || !body || body.ok === false) {
        const reason = body && body.error ? body.error : ('HTTP ' + res.status)
        throw new Error(String(reason))
      }
      return body
    }

    function post(url, payload) {
      return request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload || {}),
      })
    }

    function Field(props) {
      return h('label', { className: 'sc-field' },
        h('span', null, props.label),
        h('input', {
          type: props.type || 'text',
          value: props.value === undefined || props.value === null ? '' : props.value,
          placeholder: props.placeholder || '',
          onChange: (e) => props.onChange(e.target.value),
        }),
        props.hint ? h('small', null, props.hint) : null)
    }

    function Area(props) {
      return h('label', { className: 'sc-field', style: props.span ? { gridColumn: '1 / -1' } : undefined },
        h('span', null, props.label),
        h('textarea', {
          value: props.value === undefined || props.value === null ? '' : props.value,
          placeholder: props.placeholder || '',
          rows: props.rows || 3,
          onChange: (e) => props.onChange(e.target.value),
        }),
        props.hint ? h('small', null, props.hint) : null)
    }

    function Toggle(props) {
      return h('label', { className: 'sc-toggle' },
        h('input', { type: 'checkbox', checked: props.checked === true, onChange: (e) => props.onChange(e.target.checked) }),
        h('span', null, props.label),
        props.hint ? h('small', null, props.hint) : null)
    }

    function Card(props) {
      return h('section', { className: 'sc-card' + (props.className ? ' ' + props.className : '') },
        h('div', { className: 'sc-card-head' },
          h('div', null,
            h('h4', { className: 'sc-card-title' }, props.title),
            props.desc ? h('p', { className: 'sc-card-desc' }, props.desc) : null),
          props.actions ? h('div', { className: 'sc-actions' }, props.actions) : null),
        h('div', { className: 'sc-card-body' }, props.children))
    }

    function Panel() {
      const [state, setState] = useState(null)
      const [config, setConfig] = useState(null)
      const [tab, setTab] = useState('overview')
      const [loading, setLoading] = useState(true)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [message, setMessage] = useState('')
      const [preview, setPreview] = useState('')
      const [doc, setDoc] = useState('')
      const [docMode, setDocMode] = useState('preview')
      const [skillSearch, setSkillSearch] = useState('')
      const [onlyRecommended, setOnlyRecommended] = useState(false)
      const [itemFilter, setItemFilter] = useState('all')
      const [itemSearch, setItemSearch] = useState('')
      const [revealed, setRevealed] = useState({})

      const flash = (text) => {
        setMessage(text)
        setTimeout(() => setMessage(''), 5000)
      }

      const load = async () => {
        setLoading(true)
        setError('')
        try {
          const body = await request(API.state)
          setState(body)
          setConfig(body.config)
        } catch (e) {
          setError(e.message)
        } finally {
          setLoading(false)
        }
      }

      useEffect(() => { ensureStyle(); load() }, [])

      if (!config) {
        return h('div', { className: 'sc' },
          h('div', { className: 'sc-top' }, h('div', null, h('h3', { className: 'sc-title' }, '安全清单'), h('p', { className: 'sc-sub' }, '加载中…'))),
          error ? h('div', { className: 'sc-msg err' }, error) : null)
      }

      const categories = (state && state.categories) || []
      const skills = (state && state.skills) || []
      const yakitTools = (state && state.yakitTools) || []
      const recommendedSkills = (state && state.recommendedSkills) || []
      const stats = (state && state.stats) || { items: 0, enabledItems: 0, selectedSkills: 0, credentials: 0, skills: 0 }
      const selectedSkillSet = new Set(config.selectedSkills || [])
      const enabledItems = config.items.filter((item) => item.enabled !== false).length

      const readiness = [
        { ok: String(config.project.name || '').trim() !== '', label: '项目名称已填写', tab: 'project' },
        { ok: String(config.scope.targets || '').trim() !== '', label: '目标范围已填写', tab: 'scope' },
        { ok: (config.credentials || []).length > 0, label: '至少一个测试账号', tab: 'accounts' },
        { ok: (config.selectedSkills || []).length > 0, label: '已选择渗透技能', tab: 'skills' },
        { ok: enabledItems > 0, label: '清单有启用项', tab: 'items' },
      ]
      const readyCount = readiness.filter((entry) => entry.ok).length
      const readyPercent = Math.round((readyCount / readiness.length) * 100)

      const setProject = (key, value) => setConfig((prev) => Object.assign({}, prev, {
        project: Object.assign({}, prev.project, { [key]: value }),
      }))
      const setScope = (key, value) => setConfig((prev) => Object.assign({}, prev, {
        scope: Object.assign({}, prev.scope, { [key]: value }),
      }))
      const updateItem = (index, patch) => setConfig((prev) => Object.assign({}, prev, {
        items: prev.items.map((item, i) => (i === index ? Object.assign({}, item, patch) : item)),
      }))
      const removeItem = (index) => setConfig((prev) => Object.assign({}, prev, {
        items: prev.items.filter((item, i) => i !== index),
      }))
      const addItem = (cat) => setConfig((prev) => Object.assign({}, prev, {
        items: prev.items.concat([{ id: 'custom-' + Date.now() + '-' + prev.items.length, cat, title: '新检查项', detail: '', skill: '', yakitTool: '', yakitArgs: '', enabled: true }]),
      }))
      const addCredential = () => setConfig((prev) => Object.assign({}, prev, {
        credentials: prev.credentials.concat([{ id: 'cred-' + Date.now(), label: '新账号', service: '', username: '', note: '', hasPassword: false, _pw: '' }]),
      }))
      const updateCredential = (index, patch) => setConfig((prev) => Object.assign({}, prev, {
        credentials: prev.credentials.map((credential, i) => (i === index ? Object.assign({}, credential, patch) : credential)),
      }))
      const removeCredential = (index) => setConfig((prev) => Object.assign({}, prev, {
        credentials: prev.credentials.filter((credential, i) => i !== index),
      }))
      const toggleSkill = (name) => setConfig((prev) => {
        const set = new Set(prev.selectedSkills || [])
        if (set.has(name)) set.delete(name)
        else set.add(name)
        return Object.assign({}, prev, { selectedSkills: Array.from(set) })
      })
      const selectAllRecommended = () => setConfig((prev) => {
        const set = new Set(prev.selectedSkills || [])
        for (const entry of recommendedSkills) set.add(entry.name)
        return Object.assign({}, prev, { selectedSkills: Array.from(set) })
      })
      const clearSkills = () => setConfig((prev) => Object.assign({}, prev, { selectedSkills: [] }))

      const save = async () => {
        setBusy(true)
        setError('')
        try {
          const credentials = (config.credentials || []).map((credential) => {
            const out = { id: credential.id, label: credential.label, service: credential.service, username: credential.username, note: credential.note }
            if (credential._pw !== undefined && credential._pw !== '') out.password = credential._pw
            return out
          })
          const payload = Object.assign({}, config, { credentials })
          const body = await post(API.config, { config: payload })
          setConfig(body.config)
          const refreshed = await request(API.state)
          setState(refreshed)
          flash('已保存，运行时技能 security-checklist 已更新。')
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }

      const resetItems = async () => {
        setBusy(true)
        setError('')
        try {
          const body = await post(API.reset, {})
          setConfig(body.config)
          const refreshed = await request(API.state)
          setState(refreshed)
          flash('已恢复内置检查清单。')
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }

      const loadPreview = async () => {
        try {
          const body = await request(API.preview)
          setPreview(body.markdown || '')
          setDocMode('preview')
          setTab('docs')
        } catch (e) {
          setError(e.message)
        }
      }

      const loadDoc = async () => {
        try {
          const body = await request(API.doc)
          setDoc(body.markdown || '')
          setDocMode('playbook')
          setTab('docs')
        } catch (e) {
          setError(e.message)
        }
      }

      const reveal = async (id) => {
        try {
          const body = await post(API.reveal, { id })
          setRevealed((prev) => Object.assign({}, prev, { [id]: body.password || '' }))
        } catch (e) {
          setError(e.message)
        }
      }

      const copyText = async (value) => {
        try {
          await navigator.clipboard.writeText(String(value))
          flash('已复制到剪贴板。')
        } catch (e) {
          flash('复制失败：' + e.message)
        }
      }

      const downloadMarkdown = () => {
        if (!preview) return
        const blob = new Blob([preview], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'security-checklist.md'
        link.click()
        URL.revokeObjectURL(url)
      }

      const text = docMode === 'playbook' ? doc : preview
      const filteredSkills = skills.filter((skill) => {
        if (onlyRecommended && !skill.recommended) return false
        const query = skillSearch.trim().toLowerCase()
        if (query === '') return true
        return skill.name.toLowerCase().includes(query) || String(skill.description || '').toLowerCase().includes(query)
      })
      const itemQuery = itemSearch.trim().toLowerCase()
      const visibleItems = config.items.filter((item) => {
        if (itemFilter !== 'all' && item.cat !== itemFilter) return false
        if (itemQuery === '') return true
        return String(item.title || '').toLowerCase().includes(itemQuery) || String(item.detail || '').toLowerCase().includes(itemQuery)
      })

      const tabs = [
        { id: 'overview', label: '概览' },
        { id: 'project', label: '项目授权' },
        { id: 'scope', label: '范围环境' },
        { id: 'accounts', label: '测试账号', count: config.credentials.length },
        { id: 'items', label: '检查清单', count: config.items.length },
        { id: 'skills', label: '渗透技能', count: (config.selectedSkills || []).length },
        { id: 'docs', label: '文档' },
      ]

      const header = h('div', { className: 'sc-top' },
        h('div', null,
          h('h3', { className: 'sc-title' }, '安全清单'),
          h('p', { className: 'sc-sub' }, '渗透测试的固定配置与检查清单。填好项目、授权、范围与测试账号，勾选本阶段要用的渗透技能；保存后插件会生成运行时技能 security-checklist，AI 加载后即可按清单逐项执行并调用 Yakit MCP 工具。')),
        h('div', { className: 'sc-actions' },
          h(Toggle, {
            checked: config.enabled === true,
            onChange: (value) => setConfig(Object.assign({}, config, { enabled: value })),
            label: '启用',
          }),
          h('button', { className: 'sc-btn', onClick: loadPreview }, '预览清单'),
          h('button', { className: 'sc-btn', onClick: resetItems, disabled: busy }, '恢复内置'),
          h('button', { className: 'sc-btn', onClick: load, disabled: loading }, loading ? '刷新中…' : '刷新'),
          h('button', { className: 'sc-btn primary', onClick: save, disabled: busy }, busy ? '保存中…' : '保存配置')))

      const chips = h('div', { className: 'sc-chips' },
        h('div', { className: 'sc-chip' }, h('b', null, stats.items), h('span', null, '检查项')),
        h('div', { className: 'sc-chip' }, h('b', null, stats.enabledItems), h('span', null, '启用项')),
        h('div', { className: 'sc-chip' }, h('b', null, stats.selectedSkills), h('span', null, '选中技能')),
        h('div', { className: 'sc-chip' }, h('b', null, stats.credentials), h('span', null, '测试账号')),
        h('div', { className: 'sc-chip' }, h('b', null, stats.skills), h('span', null, '可用技能')))

      const tabBar = h('div', { className: 'sc-tabs' }, tabs.map((entry) => h('button', {
        key: entry.id,
        className: 'sc-tab' + (tab === entry.id ? ' active' : ''),
        onClick: () => setTab(entry.id),
      }, entry.label, entry.count !== undefined ? h('span', { className: 'n' }, entry.count) : null)))

      const overview = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        h(Card, { title: '项目摘要', desc: '保存后会写进 security-checklist 的开头，AI 每次加载都能看到。' },
          h('div', { className: 'sc-kv' },
            h('div', null, h('span', null, '项目'), h('b', null, config.project.name || '未填写')),
            h('div', null, h('span', null, '客户'), h('b', null, config.project.client || '未填写')),
            h('div', null, h('span', null, '授权'), h('b', null, (config.project.authorizedBy || '未填写') + (config.project.authorizationNo ? ' / ' + config.project.authorizationNo : ''))),
            h('div', null, h('span', null, '时间窗'), h('b', null, config.project.window || '未填写')),
            h('div', null, h('span', null, '目标'), h('b', null, (String(config.scope.targets || '').trim().split(/\n+/).filter(Boolean).length) + ' 个')),
            h('div', null, h('span', null, '默认样式/账号'), h('b', null, config.credentials.length + ' 个账号'))),
          h('div', { className: 'sc-toolbar' },
            h('button', { className: 'sc-btn sm', onClick: () => setTab('project') }, '编辑项目'),
            h('button', { className: 'sc-btn sm', onClick: () => setTab('scope') }, '编辑范围'),
            h('button', { className: 'sc-btn sm', onClick: () => setTab('accounts') }, '管理账号'),
            h('button', { className: 'sc-btn sm', onClick: () => setTab('items') }, '检查清单'),
            h('button', { className: 'sc-btn sm', onClick: loadDoc }, '看 Playbook'))),
        h(Card, { title: '就绪度', desc: '开测前建议把这 5 项补齐。' },
          h('div', { className: 'sc-toolbar' },
            h('div', { className: 'sc-progress', style: { flex: 1, minWidth: '160px' } }, h('i', { style: { width: readyPercent + '%' } })),
            h('b', null, readyCount + '/' + readiness.length)),
          h('div', { className: 'sc-ready' }, readiness.map((entry) => h('div', { key: entry.label, className: 'sc-ready-row' + (entry.ok ? ' ok' : '') },
            h('span', { className: 'dot' }, entry.ok ? '✓' : '·'),
            h('span', { className: 'lbl' }, entry.label),
            h('button', { className: 'sc-btn sm ghost', onClick: () => setTab(entry.tab) }, entry.ok ? '查看' : '去填写'))))),
        h(Card, { title: '使用步骤' },
          h('div', { className: 'sc-steps' },
            h('div', { className: 'sc-step' }, h('i', null, '1'), h('span', null, '在「项目授权」「范围环境」填好本次测试的边界；在「测试账号」添加只读/测试账号。')),
            h('div', { className: 'sc-step' }, h('i', null, '2'), h('span', null, '在「检查清单」按需增删检查项；在「渗透技能」勾选本阶段要 AI 加载的 skill。')),
            h('div', { className: 'sc-step' }, h('i', null, '3'), h('span', null, '保存配置，然后对 AI 说：「加载 security-checklist，按清单开始渗透测试」。')),
            h('div', { className: 'sc-step' }, h('i', null, '4'), h('span', null, 'AI 会按分类逐项执行，用 mcp__yakit__* 工具侦察/测试/登记风险，最后按 Playbook 出报告。')))))

      const projectTab = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        h(Card, { title: '项目与授权', desc: '这些信息会写进 skills 的开头，AI 每次加载都会看到。' },
          h('div', { className: 'sc-grid' },
            h(Field, { label: '项目名称', value: config.project.name, onChange: (value) => setProject('name', value), placeholder: '例如：某客户 2026 年度渗透测试' }),
            h(Field, { label: '客户/甲方', value: config.project.client, onChange: (value) => setProject('client', value) }),
            h(Field, { label: '授权人', value: config.project.authorizedBy, onChange: (value) => setProject('authorizedBy', value) }),
            h(Field, { label: '授权书编号', value: config.project.authorizationNo, onChange: (value) => setProject('authorizationNo', value) }),
            h(Field, { label: '测试时间窗', value: config.project.window, onChange: (value) => setProject('window', value), placeholder: '例如：2026-10-20 ~ 2026-10-27 09:00-18:00' })),
          h(Area, { label: '备注', value: config.project.notes, onChange: (value) => setProject('notes', value), rows: 3, placeholder: '对接人、变更窗口、已知风险点…' })))

      const scopeTab = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        h(Card, { title: '范围与环境', desc: '只测这里列出的资产；排除项优先级高于目标范围。' },
          h('div', { className: 'sc-grid' },
            h(Area, { label: '目标范围（每行一个）', value: config.scope.targets, onChange: (value) => setScope('targets', value), rows: 4, placeholder: 'demo.example.com\n10.0.0.0/24\nhttps://app.example.com' }),
            h(Area, { label: '排除项（每行一个）', value: config.scope.excludes, onChange: (value) => setScope('excludes', value), rows: 4, placeholder: 'admin.example.com\n*.prod.example.com' }),
            h(Field, { label: '环境', value: config.scope.environment, onChange: (value) => setScope('environment', value), placeholder: '测试环境 / 预发 / 生产（只读）' }),
            h(Field, { label: '代理', value: config.scope.proxy, onChange: (value) => setScope('proxy', value), placeholder: '例如：127.0.0.1:8083' })),
          h(Area, { label: '规则/约束', value: config.scope.rules, onChange: (value) => setScope('rules', value), rows: 3, placeholder: '限速、禁止项、变更窗口、应急联系人…' })))

      const credentialRows = (config.credentials || []).map((credential, index) => {
        const shown = revealed[credential.id]
        return h('tr', { key: credential.id },
          h('td', null, h('input', { type: 'text', value: credential.label || '', onChange: (e) => updateCredential(index, { label: e.target.value }) })),
          h('td', null, h('input', { type: 'text', value: credential.service || '', placeholder: '服务/URL/主机', onChange: (e) => updateCredential(index, { service: e.target.value }) })),
          h('td', null, h('input', { type: 'text', value: credential.username || '', placeholder: '用户名', onChange: (e) => updateCredential(index, { username: e.target.value }) })),
          h('td', null,
            h('input', {
              type: 'password',
              value: credential._pw === undefined ? '' : credential._pw,
              placeholder: credential.hasPassword ? '已保存（留空不修改）' : '未设置',
              onChange: (e) => updateCredential(index, { _pw: e.target.value }),
            }),
            shown !== undefined ? h('div', { className: 'mono muted', style: { marginTop: '4px' } }, shown || '（空）') : null),
          h('td', null, h('input', { type: 'text', value: credential.note || '', placeholder: '备注', onChange: (e) => updateCredential(index, { note: e.target.value }) })),
          h('td', null,
            h('div', { className: 'sc-toolbar' },
              h('button', { className: 'sc-btn sm ghost', onClick: () => reveal(credential.id) }, '显示'),
              h('button', { className: 'sc-btn sm ghost', onClick: async () => {
                let value = revealed[credential.id]
                if (value === undefined) {
                  try {
                    const body = await post(API.reveal, { id: credential.id })
                    value = body.password || ''
                    setRevealed((prev) => Object.assign({}, prev, { [credential.id]: value }))
                  } catch (e) {
                    setError(e.message)
                    return
                  }
                }
                copyText(value)
              } }, '复制'),
              h('button', { className: 'sc-btn sm danger', onClick: () => removeCredential(index) }, '删除'))))
      })
      const accountsTab = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        h(Card, {
          title: '测试账号',
          desc: '密码只保存在本机 profile；默认不会写进发给模型的内容。',
          actions: [h('button', { key: 'add', className: 'sc-btn sm', onClick: addCredential }, '添加账号')],
        },
          config.credentials.length === 0
            ? h('div', { className: 'sc-empty' }, '还没有测试账号。点右上角「添加账号」，填服务、用户名和密码。')
            : h('div', { style: { overflowX: 'auto' } },
                h('table', null,
                  h('thead', null, h('tr', null,
                    h('th', { style: { width: '110px' } }, '名称'),
                    h('th', null, '服务/URL'),
                    h('th', { style: { width: '130px' } }, '用户名'),
                    h('th', { style: { width: '190px' } }, '密码'),
                    h('th', { style: { width: '140px' } }, '备注'),
                    h('th', { style: { width: '160px' } }, '操作'))),
                  h('tbody', null, credentialRows))),
          h(Toggle, {
            checked: config.shareCredentialsWithModel === true,
            onChange: (value) => setConfig(Object.assign({}, config, { shareCredentialsWithModel: value })),
            label: '把密码写进清单（默认关闭）',
            hint: '（打开后密码会进入运行时技能与会话上下文，仅在明确需要 AI 使用账号时开启）',
          })))

      const catChips = h('div', { className: 'sc-toolbar' },
        h('button', { className: 'sc-btn sm' + (itemFilter === 'all' ? ' primary' : ''), onClick: () => setItemFilter('all') }, '全部 ' + config.items.length),
        categories.map((category) => {
          const count = config.items.filter((item) => item.cat === category.id).length
          return h('button', {
            key: category.id,
            className: 'sc-btn sm' + (itemFilter === category.id ? ' primary' : ''),
            onClick: () => setItemFilter(category.id),
          }, category.name + ' ' + count)
        }))

      const itemList = visibleItems.map((item) => {
        const index = config.items.indexOf(item)
        const skillOptions = [''].concat(skills.map((skill) => skill.name))
        if (item.skill && skillOptions.indexOf(item.skill) < 0) skillOptions.push(item.skill)
        return h('div', { className: 'sc-item' + (item.enabled === false ? ' off' : ''), key: item.id },
          h('div', { className: 'sc-item-head' },
            h('input', { type: 'checkbox', checked: item.enabled !== false, onChange: (e) => updateItem(index, { enabled: e.target.checked }) }),
            h('input', { type: 'text', className: 'mono sc-item-title', value: item.title || '', onChange: (e) => updateItem(index, { title: e.target.value }) }),
            h('span', { className: 'sc-tag acc' }, '分类'),
            h('select', { value: item.cat, onChange: (e) => updateItem(index, { cat: e.target.value }), style: { maxWidth: '130px' } },
              categories.map((category) => h('option', { key: category.id, value: category.id }, category.name))),
            h('button', { className: 'sc-btn sm danger', onClick: () => removeItem(index) }, '删除')),
          h('div', { className: 'sc-item-fields' },
            h('input', { type: 'text', value: item.detail || '', placeholder: '说明 / 验收标准', onChange: (e) => updateItem(index, { detail: e.target.value }) }),
            h('select', { value: item.skill || '', onChange: (e) => updateItem(index, { skill: e.target.value }) },
              skillOptions.map((name) => h('option', { key: 'sk-' + name, value: name }, name === '' ? '（不关联技能）' : name))),
            h('input', { type: 'text', className: 'mono', value: item.yakitTool || '', placeholder: 'Yakit 工具（mcp__yakit__…）', onChange: (e) => updateItem(index, { yakitTool: e.target.value }) }),
            h('input', { type: 'text', className: 'mono', value: item.yakitArgs || '', placeholder: '示例参数 JSON', onChange: (e) => updateItem(index, { yakitArgs: e.target.value }) })))
      })
      const itemsTab = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        h(Card, {
          title: '检查清单（' + config.items.length + ' 项，启用 ' + enabledItems + '）',
          desc: '分类来自内置模板；每项可关联渗透技能与 Yakit 工具，AI 会照着执行。',
          actions: [
            h('button', { key: 'add', className: 'sc-btn sm', onClick: () => addItem(itemFilter === 'all' ? 'vuln' : itemFilter) }, '添加检查项'),
          ],
        },
          h('div', { className: 'sc-toolbar' },
            h('input', { type: 'text', className: 'grow', value: itemSearch, placeholder: '搜索标题或说明…', onChange: (e) => setItemSearch(e.target.value) })),
          catChips,
          itemList.length > 0
            ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, itemList)
            : h('div', { className: 'sc-empty' }, '没有匹配的检查项。可以点「添加检查项」，或点「恢复内置」找回模板。')))

      const skillCards = filteredSkills.map((skill) => h('label', {
        key: skill.name,
        className: 'sc-skill' + (selectedSkillSet.has(skill.name) ? ' on' : ''),
        onClick: (e) => {
          if (e.target && e.target.tagName === 'INPUT') return
          e.preventDefault()
          toggleSkill(skill.name)
        },
      },
        h('input', { type: 'checkbox', checked: selectedSkillSet.has(skill.name), onChange: () => toggleSkill(skill.name) }),
        h('div', { className: 'sc-skill-main' },
          h('div', { className: 'sc-skill-name' }, skill.name,
            skill.recommended ? h('span', { className: 'sc-tag rec' }, '推荐') : null,
            h('span', { className: 'sc-tag' }, skill.source || 'skill')),
          h('div', { className: 'sc-skill-desc' }, skill.description || ''))))
      const missingSelected = (config.selectedSkills || []).filter((name) => !skills.some((skill) => skill.name === name))
      const skillsTab = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        h(Card, {
          title: '渗透技能（已选 ' + (config.selectedSkills || []).length + ' 个）',
          desc: '选中的技能会写进 security-checklist；AI 按阶段用 skill 工具加载对应 playbook。',
          actions: [
            h('button', { key: 'all', className: 'sc-btn sm', onClick: selectAllRecommended }, '全选推荐'),
            h('button', { key: 'none', className: 'sc-btn sm', onClick: clearSkills }, '清空'),
          ],
        },
          h('div', { className: 'sc-toolbar' },
            h('input', { type: 'text', className: 'grow', value: skillSearch, placeholder: '搜索技能（hack / api / sqli / recon …）', onChange: (e) => setSkillSearch(e.target.value) }),
            h(Toggle, { checked: onlyRecommended, onChange: setOnlyRecommended, label: '只看推荐' })),
          skillCards.length > 0 ? h('div', { className: 'sc-skill-grid' }, skillCards) : h('div', { className: 'sc-empty' }, '没有匹配的技能。'),
          missingSelected.length > 0 ? h('div', { className: 'sc-hint' }, '已选但未安装：' + missingSelected.join('、')) : null))

      const docsTab = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        h(Card, {
          title: '文档与预览',
          desc: '预览 AI 实际会看到的 security-checklist 内容，或查看内置渗透 Playbook。',
          actions: [
            h('button', { key: 'p', className: 'sc-btn sm' + (docMode === 'preview' ? ' primary' : ''), onClick: loadPreview }, '预览清单'),
            h('button', { key: 'd', className: 'sc-btn sm' + (docMode === 'playbook' ? ' primary' : ''), onClick: loadDoc }, 'Playbook'),
            h('button', { key: 'c', className: 'sc-btn sm', onClick: () => copyText(text), disabled: text === '' }, '复制'),
            h('button', { key: 'x', className: 'sc-btn sm', onClick: downloadMarkdown, disabled: preview === '' }, '下载 .md'),
          ],
        },
          text === ''
            ? h('div', { className: 'sc-empty' }, '点「预览清单」查看 AI 实际会看到的清单；点「Playbook」查看内置渗透流程文档。')
            : h('pre', { className: 'sc-pre' }, text)))

      const yakitTable = h('div', { style: { overflowX: 'auto' } },
        h('table', null,
          h('thead', null, h('tr', null, h('th', null, '工具'), h('th', null, '用途'), h('th', null, '示例参数'))),
          h('tbody', null, yakitTools.map((entry) => h('tr', { key: entry.tool },
            h('td', { className: 'mono' }, entry.tool),
            h('td', null, entry.use),
            h('td', { className: 'mono muted' }, entry.args))))))

      const bodyByTab = {
        overview,
        project: projectTab,
        scope: scopeTab,
        accounts: accountsTab,
        items: itemsTab,
        skills: skillsTab,
        docs: docsTab,
      }
      const current = bodyByTab[tab] || overview

      return h('div', { className: 'sc' },
        header,
        chips,
        error ? h('div', { className: 'sc-msg err' }, error) : null,
        message ? h('div', { className: 'sc-msg' }, message) : null,
        tabBar,
        current,
        tab === 'overview' ? h('div', { className: 'sc-savebar' },
          h('button', { className: 'sc-btn', onClick: loadPreview }, '预览清单'),
          h('button', { className: 'sc-btn primary', onClick: save, disabled: busy }, busy ? '保存中…' : '保存配置')) : null,
        h('details', { className: 'sc-card', style: { marginTop: '2px' } },
          h('summary', { style: { cursor: 'pointer', padding: '12px 16px', fontWeight: 600, fontSize: '13px' } }, 'Yakit 工具对照（16 个常用 MCP 工具）'),
          h('div', { className: 'sc-card-body' }, yakitTable)))
    }

    function apply(ctx) {
      ensureStyle()
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: NS,
        order: 64,
        label: () => '安全清单',
        inject: () => ({}),
      }, () => h(Panel)))
    }

    exports.name = NS
    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
