/**
 * dsh-mcp-panel — client half.
 */
window.__ModuleLoader__.load({
  id: 'dsh-mcp-panel',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback } = React

    const NS = 'dsh-mcp-panel'
    const API = {
      state: '/dsh-mcp-panel/state',
      saveManaged: '/dsh-mcp-panel/save-managed',
      saveExternal: '/dsh-mcp-panel/save-external',
    }

    const CSS = `
.mcp-panel { display: flex; flex-direction: column; gap: 16px; padding: 4px 2px 24px; font-size: 13px; color: var(--dsh-text, #1f2329); }
.mcp-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.mcp-panel-title { font-size: 17px; font-weight: 600; margin: 0 0 4px; }
.mcp-panel-sub { margin: 0; opacity: .62; line-height: 1.6; max-width: 720px; }
.mcp-panel-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.mcp-panel-btn { border: 1px solid rgba(127,127,127,.32); background: transparent; color: inherit; border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; line-height: 1.4; white-space: nowrap; }
.mcp-panel-btn:hover { border-color: rgba(127,127,127,.6); background: rgba(127,127,127,.08); }
.mcp-panel-btn.primary { background: #2f6fed; border-color: #2f6fed; color: #fff; }
.mcp-panel-btn.primary:hover { background: #2559c4; border-color: #2559c4; }
.mcp-panel-btn.danger { color: #d93026; border-color: rgba(217,48,38,.4); }
.mcp-panel-btn.danger:hover { background: rgba(217,48,38,.08); border-color: rgba(217,48,38,.7); }
.mcp-panel-btn.sm { padding: 3px 8px; font-size: 12px; border-radius: 6px; }
.mcp-panel-btn:disabled { opacity: .45; cursor: not-allowed; }
.mcp-panel-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.mcp-panel-chip { display: inline-flex; align-items: baseline; gap: 6px; border: 1px solid rgba(127,127,127,.22); border-radius: 10px; padding: 8px 14px; background: rgba(127,127,127,.04); }
.mcp-panel-chip b { font-size: 18px; font-weight: 650; }
.mcp-panel-chip span { opacity: .6; }
.mcp-panel-card { border: 1px solid rgba(127,127,127,.24); border-radius: 12px; overflow: hidden; }
.mcp-panel-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid rgba(127,127,127,.18); font-weight: 600; }
.mcp-panel table { width: 100%; border-collapse: collapse; }
.mcp-panel th, .mcp-panel td { text-align: left; padding: 10px 14px; border-bottom: 1px solid rgba(127,127,127,.14); vertical-align: top; }
.mcp-panel th { font-weight: 600; font-size: 12px; opacity: .62; white-space: nowrap; }
.mcp-panel tr:last-child td { border-bottom: none; }
.mcp-panel .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; word-break: break-all; }
.mcp-panel .muted { opacity: .55; }
.mcp-panel .tag { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; line-height: 18px; border: 1px solid transparent; white-space: nowrap; }
.mcp-panel .tag.managed { background: rgba(47,111,237,.12); color: #2f6fed; border-color: rgba(47,111,237,.3); }
.mcp-panel .tag.profile { background: rgba(127,127,127,.12); color: inherit; border-color: rgba(127,127,127,.3); }
.mcp-panel .tag.ok { background: rgba(31,157,85,.12); color: #1f9d55; border-color: rgba(31,157,85,.3); }
.mcp-panel .tag.off { background: rgba(217,48,38,.1); color: #d93026; border-color: rgba(217,48,38,.28); }
.mcp-panel .tag.tool { background: rgba(127,127,127,.1); border-color: rgba(127,127,127,.22); font-family: ui-monospace, monospace; font-size: 11px; margin: 2px 4px 0 0; }
.mcp-panel-msg { border-radius: 10px; padding: 9px 14px; border: 1px solid rgba(47,111,237,.3); background: rgba(47,111,237,.08); }
.mcp-panel-msg.err { border-color: rgba(217,48,38,.4); background: rgba(217,48,38,.08); color: #b0241c; }
.mcp-panel-form { border: 1px solid rgba(127,127,127,.28); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: rgba(127,127,127,.03); }
.mcp-panel-form h4 { margin: 0; font-size: 14px; }
.mcp-panel-field { display: flex; flex-direction: column; gap: 5px; }
.mcp-panel-field label { font-size: 12px; opacity: .68; }
.mcp-panel-field input, .mcp-panel-field select, .mcp-panel-field textarea { border: 1px solid rgba(127,127,127,.32); border-radius: 8px; background: transparent; color: inherit; padding: 7px 10px; font-size: 13px; font-family: inherit; }
.mcp-panel-field textarea { font-family: ui-monospace, monospace; min-height: 60px; resize: vertical; }
.mcp-panel-row { display: flex; gap: 12px; flex-wrap: wrap; }
.mcp-panel-row > .mcp-panel-field { flex: 1 1 240px; }
.mcp-panel-hint { font-size: 12px; opacity: .55; line-height: 1.6; }
.mcp-panel-form-actions { display: flex; gap: 8px; justify-content: flex-end; }
.mcp-panel-empty { padding: 26px 14px; text-align: center; opacity: .6; }
.mcp-panel-warn { font-size: 12px; color: #b26a00; }
.mcp-panel td.col-actions { white-space: nowrap; }
.mcp-panel td.col-actions .mcp-panel-btn + .mcp-panel-btn { margin-left: 6px; }
`

    let styleEl = null
    function ensureStyle() {
      if (styleEl || typeof document === 'undefined') return
      styleEl = document.createElement('style')
      styleEl.setAttribute('data-dsh-mcp-panel', '')
      styleEl.textContent = CSS
      document.head.appendChild(styleEl)
    }

    async function request(url, options) {
      const response = await fetch(url, Object.assign({ credentials: 'same-origin', headers: { accept: 'application/json' } }, options || {}))
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (!response.ok || !body || body.ok === false) {
        const message = body && body.error ? body.error : 'HTTP ' + response.status
        throw new Error(message)
      }
      return body
    }

    function describe(server) {
      if (server.transport === 'stdio') {
        const args = Array.isArray(server.args) && server.args.length > 0 ? ' ' + server.args.join(' ') : ''
        return server.command ? server.command + args : '—'
      }
      return server.url || '—'
    }

    function emptyForm() {
      return { mode: 'add', target: null, serverName: '', transport: 'streamable-http', url: '', command: '', argsText: '', headersText: '', envText: '' }
    }

    function formFromServer(server) {
      return {
        mode: server.source === 'managed' ? 'edit-managed' : 'edit-external',
        target: server,
        serverName: server.serverName || '',
        transport: server.transport || 'streamable-http',
        url: server.url || '',
        command: server.command || '',
        argsText: Array.isArray(server.args) ? JSON.stringify(server.args) : '',
        headersText: server.headers && Object.keys(server.headers).length > 0 ? JSON.stringify(server.headers, null, 2) : '',
        envText: server.env && Object.keys(server.env).length > 0 ? JSON.stringify(server.env, null, 2) : '',
      }
    }

    function parseJsonObject(text, label) {
      const trimmed = String(text || '').trim()
      if (!trimmed) return undefined
      let value
      try {
        value = JSON.parse(trimmed)
      } catch {
        throw new Error(label + ' 不是合法 JSON')
      }
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' 必须是 JSON 对象')
      for (const v of Object.values(value)) {
        if (typeof v !== 'string') throw new Error(label + ' 的值必须是字符串')
      }
      return value
    }

    function buildConfig(form) {
      const config = { serverName: form.serverName.trim(), transport: form.transport }
      if (form.transport === 'stdio') {
        config.command = form.command.trim()
        const argsText = String(form.argsText || '').trim()
        if (argsText) {
          let args
          try {
            args = JSON.parse(argsText)
          } catch {
            throw new Error('args 必须是 JSON 字符串数组，例如 ["mcp","--transport","stdio"]')
          }
          if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) throw new Error('args 必须是 JSON 字符串数组')
          config.args = args
        }
        const env = parseJsonObject(form.envText, 'env')
        if (env) config.env = env
      } else {
        const url = form.url.trim()
        if (!/^https?:\/\//i.test(url)) throw new Error('URL 必须以 http:// 或 https:// 开头')
        config.url = url
        const headers = parseJsonObject(form.headersText, 'headers')
        if (headers) config.headers = headers
      }
      return config
    }

    let flashTimer = null

    function ServerForm(props) {
      const { form, setForm, onSubmit, onCancel, busy } = props
      const update = (patch) => setForm(Object.assign({}, form, patch))
      const isStdio = form.transport === 'stdio'
      const title = form.mode === 'add' ? '添加 MCP Server' : '编辑 ' + (form.serverName || '')
      return h('div', { className: 'mcp-panel-form' },
        h('h4', null, title),
        form.mode === 'edit-external'
          ? h('div', { className: 'mcp-panel-hint' }, '这条连接来自 profile 的其它配置行，保存时会通过 configEditor 就地改写该行。')
          : null,
        h('div', { className: 'mcp-panel-row' },
          h('div', { className: 'mcp-panel-field' },
            h('label', null, 'serverName（工具前缀 mcp__<serverName>__）'),
            h('input', {
              type: 'text',
              value: form.serverName,
              placeholder: 'yakit',
              onChange: (e) => update({ serverName: e.target.value }),
            })),
          h('div', { className: 'mcp-panel-field' },
            h('label', null, '传输方式'),
            h('select', { value: form.transport, onChange: (e) => update({ transport: e.target.value }) },
              h('option', { value: 'streamable-http' }, 'streamable-http'),
              h('option', { value: 'stdio' }, 'stdio')))),
        isStdio
          ? h('div', { className: 'mcp-panel-row' },
              h('div', { className: 'mcp-panel-field' },
                h('label', null, 'command'),
                h('input', {
                  type: 'text',
                  value: form.command,
                  placeholder: 'path/to/yak.exe',
                  onChange: (e) => update({ command: e.target.value }),
                })),
              h('div', { className: 'mcp-panel-field' },
                h('label', null, 'args（JSON 字符串数组，可空）'),
                h('input', {
                  type: 'text',
                  value: form.argsText,
                  placeholder: '["mcp","--transport","stdio"]',
                  onChange: (e) => update({ argsText: e.target.value }),
                })))
          : h('div', { className: 'mcp-panel-row' },
              h('div', { className: 'mcp-panel-field' },
                h('label', null, 'url'),
                h('input', {
                  type: 'url',
                  value: form.url,
                  placeholder: 'http://127.0.0.1:11432/mcp',
                  onChange: (e) => update({ url: e.target.value }),
                }))),
        isStdio
          ? h('div', { className: 'mcp-panel-field' },
              h('label', null, 'env（可选，JSON 对象，值必须是字符串）'),
              h('textarea', { value: form.envText, placeholder: '{}', onChange: (e) => update({ envText: e.target.value }) }))
          : h('div', { className: 'mcp-panel-field' },
              h('label', null, 'headers（可选，JSON 对象，值必须是字符串）'),
              h('textarea', { value: form.headersText, placeholder: '{"Authorization":"Bearer ..."}', onChange: (e) => update({ headersText: e.target.value }) })),
        h('div', { className: 'mcp-panel-form-actions' },
          h('button', { className: 'mcp-panel-btn', onClick: onCancel, disabled: busy }, '取消'),
          h('button', { className: 'mcp-panel-btn primary', onClick: onSubmit, disabled: busy }, busy ? '保存中…' : '保存')))
    }

    function Panel() {
      ensureStyle()
      const [data, setData] = useState(null)
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState('')
      const [message, setMessage] = useState('')
      const [form, setForm] = useState(null)
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

      const servers = data && Array.isArray(data.servers) ? data.servers : []
      const totals = data && data.totals ? data.totals : { servers: 0, managed: 0, external: 0, tools: 0 }

      const flash = (text) => {
        setMessage(text)
        if (flashTimer) clearTimeout(flashTimer)
        flashTimer = setTimeout(() => setMessage(''), 6000)
      }

      const afterSave = () => {
        setForm(null)
        flash('已保存，配置重载中…（约 3 秒后自动刷新）')
        setTimeout(refresh, 3200)
      }

      const submit = async () => {
        if (!form) return
        let config
        try {
          config = buildConfig(form)
        } catch (e) {
          setError(e.message)
          return
        }
        setBusy(true)
        setError('')
        try {
          if (form.mode === 'edit-external') {
            await request(API.saveExternal, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: form.target.id, config }) })
          } else {
            const list = servers.filter((s) => s.source === 'managed').map((s) => ({
              serverName: s.serverName, transport: s.transport, url: s.url, command: s.command, args: s.args, headers: s.headers, env: s.env,
            }))
            const index = list.findIndex((s) => s.serverName === (form.mode === 'edit-managed' ? form.target.serverName : ''))
            if (index >= 0) list[index] = config
            else list.push(config)
            await request(API.saveManaged, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ servers: list }) })
          }
          afterSave()
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }

      const removeManaged = async (server) => {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm('删除托管连接 ' + server.serverName + '？')) return
        setBusy(true)
        setError('')
        try {
          const list = servers.filter((s) => s.source === 'managed' && s.serverName !== server.serverName).map((s) => ({
            serverName: s.serverName, transport: s.transport, url: s.url, command: s.command, args: s.args, headers: s.headers, env: s.env,
          }))
          await request(API.saveManaged, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ servers: list }) })
          afterSave()
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }

      return h('div', { className: 'mcp-panel' },
        h('div', { className: 'mcp-panel-head' },
          h('div', null,
            h('h3', { className: 'mcp-panel-title' }, 'MCP 连接'),
            h('p', { className: 'mcp-panel-sub' }, '这里列出当前 profile 的所有 MCP 服务器：托管连接由本面板维护，保存后写入 profile 的 cordis.patch.yml 并由热重载生效；配置连接来自其它 profile 配置行，通过 configEditor 就地编辑。')),
          h('div', { className: 'mcp-panel-actions' },
            h('button', { className: 'mcp-panel-btn', onClick: refresh, disabled: loading }, loading ? '刷新中…' : '刷新'),
            h('button', { className: 'mcp-panel-btn primary', onClick: () => { setError(''); setForm(emptyForm()) } }, '添加 MCP Server'))),
        h('div', { className: 'mcp-panel-chips' },
          h('div', { className: 'mcp-panel-chip' }, h('b', null, totals.servers), h('span', null, '个连接')),
          h('div', { className: 'mcp-panel-chip' }, h('b', null, totals.managed), h('span', null, '个托管')),
          h('div', { className: 'mcp-panel-chip' }, h('b', null, totals.external), h('span', null, '个配置行')),
          h('div', { className: 'mcp-panel-chip' }, h('b', null, totals.tools), h('span', null, '个已注册工具'))),
        message ? h('div', { className: 'mcp-panel-msg' }, message) : null,
        error ? h('div', { className: 'mcp-panel-msg err' }, error) : null,
        form ? h(ServerForm, {
          form,
          setForm,
          busy,
          onSubmit: submit,
          onCancel: () => { setForm(null); setError('') },
        }) : null,
        h('div', { className: 'mcp-panel-card' },
          h('div', { className: 'mcp-panel-card-head' },
            h('span', null, '连接列表'),
            data && data.profile ? h('span', { className: 'mcp-panel-hint' }, data.profile.name + ' · ' + data.profile.patchPath) : null),
          servers.length === 0
            ? h('div', { className: 'mcp-panel-empty' }, loading ? '加载中…' : '还没有 MCP 连接，点击右上角「添加 MCP Server」。')
            : h('table', null,
                h('thead', null,
                  h('tr', null,
                    h('th', null, '名称'),
                    h('th', null, '来源'),
                    h('th', null, '传输'),
                    h('th', null, '地址 / 命令'),
                    h('th', null, '工具'),
                    h('th', null, '状态'),
                    h('th', null, '操作'))),
                h('tbody', null,
                  servers.map((server) => h('tr', { key: server.source + ':' + server.id },
                    h('td', null, h('div', { style: { fontWeight: 600 } }, server.serverName)),
                    h('td', null, h('span', { className: 'tag ' + (server.source === 'managed' ? 'managed' : 'profile') }, server.source === 'managed' ? '托管' : '配置')),
                    h('td', null, h('span', { className: 'mono' }, server.transport)),
                    h('td', null, h('span', { className: 'mono' }, describe(server))),
                    h('td', null,
                      h('div', null, h('b', null, server.status ? server.status.toolCount : 0)),
                      server.status && server.status.tools && server.status.tools.length > 0
                        ? h('div', null, server.status.tools.slice(0, 4).map((t) => h('span', { key: t, className: 'tag tool' }, t.replace('mcp__' + server.serverName + '__', ''))))
                        : null),
                    h('td', null, h('span', { className: 'tag ' + (server.status && server.status.connected ? 'ok' : 'off') }, server.status && server.status.connected ? '已连接' : '未连接')),
                    h('td', { className: 'col-actions' },
                      server.editable
                        ? h('button', { className: 'mcp-panel-btn sm', onClick: () => { setError(''); setForm(formFromServer(server)) } }, '编辑')
                        : h('span', { className: 'muted' }, '只读'),
                      server.source === 'managed'
                        ? h('button', { className: 'mcp-panel-btn sm danger', onClick: () => removeManaged(server), disabled: busy }, '删除')
                        : null)))))),
        data && data.hasConfigEditor === false
          ? h('div', { className: 'mcp-panel-warn' }, '当前 profile 没有可用的 configEditor：配置行只能查看，不能编辑。')
          : null)
    }

    function apply(ctx) {
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: NS,
        order: 61,
        label: () => 'MCP 连接',
        inject: () => ({}),
      }, () => h(Panel)))
    }

    exports.name = NS
    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
