/**
 * dsh-skill-panel — client half.
 * Registers the "Skills" section in Settings; talks to the host half over
 * /dsh-skill-panel/{state,body,export}.
 */
window.__ModuleLoader__.load({
  id: 'dsh-skill-panel',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useMemo } = React

    const NS = 'dsh-skill-panel'
    const API = {
      state: '/dsh-skill-panel/state',
      body: '/dsh-skill-panel/body',
      export: '/dsh-skill-panel/export',
    }

    const CSS = `
.skill-panel { display: flex; flex-direction: column; gap: 14px; padding: 4px 2px 24px; font-size: 13px; color: var(--dsh-text, #1f2329); }
.skill-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.skill-panel-title { font-size: 17px; font-weight: 600; margin: 0 0 4px; }
.skill-panel-sub { margin: 0; opacity: .62; line-height: 1.6; max-width: 760px; }
.skill-panel-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
.skill-panel-btn { border: 1px solid rgba(127,127,127,.32); background: transparent; color: inherit; border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; line-height: 1.4; white-space: nowrap; }
.skill-panel-btn:hover { border-color: rgba(127,127,127,.6); background: rgba(127,127,127,.08); }
.skill-panel-btn.primary { background: #2f6fed; border-color: #2f6fed; color: #fff; }
.skill-panel-btn.primary:hover { background: #2559c4; border-color: #2559c4; }
.skill-panel-btn.sm { padding: 3px 8px; font-size: 12px; border-radius: 6px; }
.skill-panel-btn:disabled { opacity: .45; cursor: not-allowed; }
.skill-panel-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.skill-panel-chip { display: inline-flex; align-items: baseline; gap: 6px; border: 1px solid rgba(127,127,127,.22); border-radius: 10px; padding: 7px 13px; background: rgba(127,127,127,.04); }
.skill-panel-chip b { font-size: 17px; font-weight: 650; }
.skill-panel-chip span { opacity: .6; }
.skill-panel-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.skill-panel-toolbar input[type=search], .skill-panel-toolbar select { border: 1px solid rgba(127,127,127,.32); border-radius: 8px; background: transparent; color: inherit; padding: 6px 10px; font-size: 13px; font-family: inherit; min-width: 200px; }
.skill-panel-selected { opacity: .7; }
.skill-panel-card { border: 1px solid rgba(127,127,127,.24); border-radius: 12px; overflow: hidden; }
.skill-panel table { width: 100%; border-collapse: collapse; }
.skill-panel th, .skill-panel td { text-align: left; padding: 9px 12px; border-bottom: 1px solid rgba(127,127,127,.14); vertical-align: top; }
.skill-panel th { font-weight: 600; font-size: 12px; opacity: .62; white-space: nowrap; }
.skill-panel tr:last-child td { border-bottom: none; }
.skill-panel td.c { width: 30px; }
.skill-panel .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; word-break: break-all; }
.skill-panel .muted { opacity: .55; }
.skill-panel .desc { max-width: 520px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.skill-panel .tag { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; line-height: 18px; border: 1px solid transparent; white-space: nowrap; margin: 1px 4px 1px 0; }
.skill-panel .tag.root { background: rgba(47,111,237,.12); color: #2f6fed; border-color: rgba(47,111,237,.3); }
.skill-panel .tag.model { background: rgba(31,157,85,.1); color: #1f9d55; border-color: rgba(31,157,85,.26); }
.skill-panel .tag.user { background: rgba(127,127,127,.12); border-color: rgba(127,127,127,.28); }
.skill-panel .tag.missing { background: rgba(217,48,38,.1); color: #d93026; border-color: rgba(217,48,38,.3); }
.skill-panel-msg { border-radius: 10px; padding: 9px 14px; border: 1px solid rgba(47,111,237,.3); background: rgba(47,111,237,.08); }
.skill-panel-msg.err { border-color: rgba(217,48,38,.4); background: rgba(217,48,38,.08); color: #b0241c; }
.skill-panel-empty { padding: 26px 14px; text-align: center; opacity: .6; }
.skill-panel-detail { border: 1px solid rgba(127,127,127,.28); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.skill-panel-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.skill-panel-detail-title { font-size: 15px; font-weight: 650; margin: 0; }
.skill-panel-meta { display: flex; flex-direction: column; gap: 2px; font-size: 12px; opacity: .7; }
.skill-panel-files { display: flex; flex-wrap: wrap; gap: 6px; max-height: 130px; overflow: auto; }
.skill-panel-file { border: 1px solid rgba(127,127,127,.22); border-radius: 6px; padding: 2px 7px; font-family: ui-monospace, monospace; font-size: 11px; }
.skill-panel-pre { margin: 0; padding: 12px; border: 1px solid rgba(127,127,127,.22); border-radius: 8px; background: rgba(127,127,127,.05); max-height: 360px; overflow: auto; font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.skill-panel-cols { display: flex; gap: 14px; align-items: flex-start; }
.skill-panel-cols > .skill-panel-card { flex: 1 1 auto; min-width: 0; }
.skill-panel-cols > .skill-panel-detail { flex: 0 0 460px; max-width: 46%; }
@media (max-width: 1100px) { .skill-panel-cols { flex-direction: column; } .skill-panel-cols > .skill-panel-detail { flex: 1 1 auto; max-width: none; width: 100%; } }
`

    let styleEl = null
    function ensureStyle() {
      if (styleEl || typeof document === 'undefined') return
      styleEl = document.createElement('style')
      styleEl.setAttribute('data-dsh-skill-panel', '')
      styleEl.textContent = CSS
      document.head.appendChild(styleEl)
    }

    function fmtBytes(bytes) {
      const n = Number(bytes) || 0
      if (n < 1024) return n + ' B'
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
      return (n / 1024 / 1024).toFixed(2) + ' MB'
    }

    async function request(url, options) {
      const response = await fetch(url, Object.assign({ credentials: 'same-origin', headers: { accept: 'application/json' } }, options || {}))
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (!response.ok || !body || body.ok === false) throw new Error(body && body.error ? body.error : 'HTTP ' + response.status)
      return body
    }

    async function download(url, fallbackName) {
      const response = await fetch(url, { credentials: 'same-origin' })
      if (!response.ok) {
        let message = 'HTTP ' + response.status
        try {
          const body = await response.json()
          if (body && body.error) message = body.error
        } catch {
          /* ignore */
        }
        throw new Error(message)
      }
      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') || ''
      const match = /filename="([^"]+)"/.exec(disposition)
      const filename = match ? match[1] : fallbackName || 'skills.zip'
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(href), 4000)
      return filename
    }

    function Toolbar(props) {
      const { query, setQuery, roots, source, setSource, selectedCount, busy, onExportSelected, onRefresh, loading } = props
      return h('div', { className: 'skill-panel-toolbar' },
        h('input', {
          type: 'search',
          value: query,
          placeholder: '搜索名称 / 描述 / 路径…',
          onChange: (e) => setQuery(e.target.value),
        }),
        h('select', { value: source, onChange: (e) => setSource(e.target.value) },
          h('option', { value: '' }, '全部来源'),
          roots.map((root) => h('option', { key: root.label + root.path, value: root.label }, root.label + ' · ' + root.path))),
        h('span', { className: 'skill-panel-selected' }, '已选 ' + selectedCount + ' 个'),
        h('button', { className: 'skill-panel-btn sm primary', disabled: busy || selectedCount === 0, onClick: onExportSelected }, '导出选中 ZIP'),
        h('button', { className: 'skill-panel-btn sm', onClick: onRefresh, disabled: loading }, loading ? '刷新中…' : '刷新'))
    }

    function SkillTable(props) {
      const { skills, selected, toggle, toggleAll, onView, onExportOne, onCopyPath } = props
      const allSelected = skills.length > 0 && skills.every((skill) => selected.has(skill.name))
      return h('div', { className: 'skill-panel-card' },
        h('table', null,
          h('thead', null,
            h('tr', null,
              h('th', { className: 'c' }, h('input', { type: 'checkbox', checked: allSelected, onChange: toggleAll })),
              h('th', null, '名称 / 描述'),
              h('th', null, '来源'),
              h('th', null, '文件 / 大小'),
              h('th', null, '可调用'),
              h('th', null, '操作'))),
          h('tbody', null,
            skills.map((skill) => h('tr', { key: skill.name },
              h('td', { className: 'c' }, h('input', { type: 'checkbox', checked: selected.has(skill.name), onChange: () => toggle(skill.name) })),
              h('td', null,
                h('div', { style: { fontWeight: 600 } }, skill.name),
                h('div', { className: 'desc muted', title: skill.description }, skill.description || '（无描述）')),
              h('td', null,
                skill.root ? h('span', { className: 'tag root' }, skill.root) : h('span', { className: 'tag' }, skill.provider || 'unknown'),
                skill.embedded ? h('span', { className: 'tag user' }, '内置') : skill.exists ? null : h('span', { className: 'tag missing' }, '文件缺失')),
              h('td', null,
                h('div', null, skill.fileCount + ' 个文件'),
                h('div', { className: 'muted' }, fmtBytes(skill.bytes))),
              h('td', null,
                !skill.invocation || skill.invocation.modelInvocable !== false ? h('span', { className: 'tag model' }, 'model') : null,
                !skill.invocation || skill.invocation.userInvocable !== false ? h('span', { className: 'tag user' }, 'user') : null),
              h('td', null,
                h('button', { className: 'skill-panel-btn sm', onClick: () => onView(skill) }, '查看'),
                h('button', { className: 'skill-panel-btn sm', onClick: () => onExportOne(skill), disabled: !skill.exists }, '导出'),
                h('button', { className: 'skill-panel-btn sm', onClick: () => onCopyPath(skill), disabled: !skill.dir }, '复制路径')))))))
    }

    function Detail(props) {
      const { detail, onClose, onExport, onCopyPath, busy } = props
      const skill = detail.skill
      return h('div', { className: 'skill-panel-detail' },
        h('div', { className: 'skill-panel-detail-head' },
          h('div', null,
            h('h4', { className: 'skill-panel-detail-title' }, skill.name),
            h('div', { className: 'muted', style: { fontSize: '12px', marginTop: '2px' } }, skill.description || '（无描述）')),
          h('div', { style: { display: 'flex', gap: '6px', flexShrink: 0 } },
            h('button', { className: 'skill-panel-btn sm primary', disabled: busy, onClick: () => onExport(skill) }, '导出 ZIP'),
            h('button', { className: 'skill-panel-btn sm', onClick: onCopyPath }, '复制路径'),
            h('button', { className: 'skill-panel-btn sm', onClick: onClose }, '关闭'))),
        h('div', { className: 'skill-panel-meta' },
          h('div', null, h('span', { className: 'mono' }, skill.path || '（无路径）')),
          h('div', null, '来源：' + (skill.root || skill.provider || '—') + ' · 文件 ' + detail.files.length + ' 个 · ' + fmtBytes(skill.bytes) + (detail.filesTruncated ? '（清单已截断）' : '')),
          skill.whenToUse ? h('div', null, 'whenToUse：' + skill.whenToUse) : null),
        h('div', { className: 'skill-panel-files' },
          detail.files.map((file) => h('span', { key: file.rel, className: 'skill-panel-file', title: fmtBytes(file.size) }, file.rel))),
        h('pre', { className: 'skill-panel-pre' }, detail.skill.content + (detail.skill.contentTruncated ? '\n\n…（正文过大，已截断预览）' : '')))
    }

    function Panel() {
      ensureStyle()
      const [data, setData] = useState(null)
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState('')
      const [message, setMessage] = useState('')
      const [query, setQuery] = useState('')
      const [source, setSource] = useState('')
      const [selected, setSelected] = useState(function () { return new Set() })
      const [detail, setDetail] = useState(null)
      const [busy, setBusy] = useState(false)

      const refresh = useCallback(async () => {
        setLoading(true)
        try {
          setData(await request(API.state))
          setError('')
        } catch (e) {
          setError(e.message)
        } finally {
          setLoading(false)
        }
      }, [])

      useEffect(() => { refresh() }, [refresh])

      const roots = data && Array.isArray(data.roots) ? data.roots : []
      const allSkills = data && Array.isArray(data.skills) ? data.skills : []
      const totals = data && data.totals ? data.totals : { skills: 0, modelInvocable: 0, userInvocable: 0, bytes: 0, missing: 0 }

      const skills = useMemo(() => {
        const q = query.trim().toLowerCase()
        return allSkills.filter((skill) => {
          if (source && skill.root !== source) return false
          if (!q) return true
          return (skill.name + '\n' + (skill.description || '') + '\n' + (skill.dir || '') + '\n' + (skill.path || '')).toLowerCase().includes(q)
        })
      }, [allSkills, query, source])

      useEffect(() => {
        setSelected((prev) => {
          const next = new Set()
          for (const name of prev) if (allSkills.some((skill) => skill.name === name)) next.add(name)
          return next
        })
      }, [allSkills])

      const flash = (text) => {
        setMessage(text)
        setTimeout(() => setMessage(''), 6000)
      }

      const toggle = (name) => setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        return next
      })
      const toggleAll = () => setSelected((prev) => {
        const every = skills.length > 0 && skills.every((skill) => prev.has(skill.name))
        if (every) return new Set()
        return new Set(skills.map((skill) => skill.name))
      })

      const copyPath = async (skill) => {
        try {
          await navigator.clipboard.writeText(skill.dir || skill.path || '')
          flash('已复制：' + (skill.dir || skill.path))
        } catch (e) {
          setError('复制失败：' + e.message)
        }
      }

      const exportNames = async (names, fallbackName) => {
        setBusy(true)
        setError('')
        try {
          const filename = await download(API.export + '?names=' + encodeURIComponent(names.join(',')), fallbackName)
          flash('已开始下载：' + filename)
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }

      const exportAll = async () => {
        setBusy(true)
        setError('')
        try {
          const filename = await download(API.export + '?all=1', 'all-skills.zip')
          flash('已开始下载：' + filename)
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }

      const view = async (skill) => {
        setBusy(true)
        setError('')
        try {
          const body = await request(API.body, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: skill.name }),
          })
          setDetail({ skill: body.skill, files: body.files || [], filesTruncated: !!body.filesTruncated })
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }

      return h('div', { className: 'skill-panel' },
        h('div', { className: 'skill-panel-head' },
          h('div', null,
            h('h3', { className: 'skill-panel-title' }, 'Skills'),
            h('p', { className: 'skill-panel-sub' }, '这里列出当前 DSH 技能目录中的全部本地 skill（与模型可见目录同源）。可以搜索、查看 SKILL.md 与文件清单，并导出单个、选中或全部 skill 为 ZIP（含 _manifest.json）。')),
          h('div', { className: 'skill-panel-actions' },
            h('button', { className: 'skill-panel-btn', onClick: refresh, disabled: loading }, loading ? '刷新中…' : '刷新'),
            h('button', { className: 'skill-panel-btn primary', onClick: exportAll, disabled: busy || allSkills.length === 0 }, '导出全部 ZIP'))),
        h('div', { className: 'skill-panel-chips' },
          h('div', { className: 'skill-panel-chip' }, h('b', null, totals.skills), h('span', null, '个 skill')),
          h('div', { className: 'skill-panel-chip' }, h('b', null, totals.modelInvocable), h('span', null, 'model 可调用')),
          h('div', { className: 'skill-panel-chip' }, h('b', null, totals.userInvocable), h('span', null, '用户可调用')),
          h('div', { className: 'skill-panel-chip' }, h('b', null, fmtBytes(totals.bytes)), h('span', null, '总体积')),
          totals.missing > 0 ? h('div', { className: 'skill-panel-chip' }, h('b', null, totals.missing), h('span', null, '个文件缺失')) : null),
        message ? h('div', { className: 'skill-panel-msg' }, message) : null,
        error ? h('div', { className: 'skill-panel-msg err' }, error) : null,
        h(Toolbar, {
          query,
          setQuery,
          roots,
          source,
          setSource,
          selectedCount: selected.size,
          busy,
          loading,
          onRefresh: refresh,
          onExportSelected: () => exportNames(Array.from(selected), 'selected-skills.zip'),
        }),
        h('div', { className: 'skill-panel-cols' },
          skills.length === 0
            ? h('div', { className: 'skill-panel-card' }, h('div', { className: 'skill-panel-empty' }, loading ? '加载中…' : allSkills.length === 0 ? '没有找到 skill。' : '没有匹配的 skill。'))
            : h(SkillTable, {
                skills,
                selected,
                toggle,
                toggleAll,
                onView: view,
                onExportOne: (skill) => exportNames([skill.name], skill.name + '.zip'),
                onCopyPath: copyPath,
              }),
          detail ? h(Detail, {
            detail,
            busy,
            onClose: () => setDetail(null),
            onExport: () => exportNames([detail.skill.name], detail.skill.name + '.zip'),
            onCopyPath: () => copyPath(detail.skill),
          }) : null))
    }

    function apply(ctx) {
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: NS,
        order: 62,
        label: () => 'Skills',
        inject: () => ({}),
      }, () => h(Panel)))
    }

    exports.name = NS
    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
