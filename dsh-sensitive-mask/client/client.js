/**
 * dsh-sensitive-mask — client half.
 * Registers the "脱敏显示" settings section: rules, masking styles, toggles, test box and log viewer.
 */
window.__ModuleLoader__.load({
  id: 'dsh-sensitive-mask',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback } = React

    const NS = 'dsh-sensitive-mask'
    const API = {
      state: '/dsh-sensitive-mask/state',
      config: '/dsh-sensitive-mask/config',
      test: '/dsh-sensitive-mask/test',
      log: '/dsh-sensitive-mask/log',
      openLogDir: '/dsh-sensitive-mask/open-log-dir',
    }

    const CSS = `
.smask { display: flex; flex-direction: column; gap: 14px; padding: 4px 2px 24px; font-size: 13px; color: var(--dsh-text, #1f2329); }
.smask-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.smask-title { font-size: 17px; font-weight: 600; margin: 0 0 4px; }
.smask-sub { margin: 0; opacity: .62; line-height: 1.6; max-width: 800px; }
.smask-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
.smask-btn { border: 1px solid rgba(127,127,127,.32); background: transparent; color: inherit; border-radius: 8px; padding: 5px 11px; font-size: 13px; cursor: pointer; line-height: 1.4; white-space: nowrap; }
.smask-btn:hover { border-color: rgba(127,127,127,.6); background: rgba(127,127,127,.08); }
.smask-btn.primary { background: #2f6fed; border-color: #2f6fed; color: #fff; }
.smask-btn.primary:hover { background: #2559c4; border-color: #2559c4; }
.smask-btn.sm { padding: 2px 7px; font-size: 12px; border-radius: 6px; }
.smask-btn:disabled { opacity: .45; cursor: not-allowed; }
.smask-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.smask-chip { display: inline-flex; align-items: baseline; gap: 6px; border: 1px solid rgba(127,127,127,.22); border-radius: 10px; padding: 7px 13px; background: rgba(127,127,127,.04); }
.smask-chip b { font-size: 17px; font-weight: 650; }
.smask-chip span { opacity: .6; }
.smask-card { border: 1px solid rgba(127,127,127,.24); border-radius: 12px; overflow: hidden; }
.smask-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 13px; border-bottom: 1px solid rgba(127,127,127,.18); font-weight: 600; }
.smask-body { padding: 12px 13px; display: flex; flex-direction: column; gap: 10px; }
.smask-toggles { display: flex; flex-wrap: wrap; gap: 14px; }
.smask-toggle { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.smask-toggle input { width: 14px; height: 14px; }
.smask-toggle span { opacity: .8; }
.smask-toggle small { opacity: .45; }
.smask-style-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.smask-style-row > span { opacity: .75; }
.smask-style-row select { width: auto; min-width: 300px; }
.smask-style-row small { opacity: .5; }
.smask table { width: 100%; border-collapse: collapse; }
.smask th, .smask td { text-align: left; padding: 8px 10px; border-bottom: 1px solid rgba(127,127,127,.13); vertical-align: top; }
.smask th { font-weight: 600; font-size: 12px; opacity: .62; white-space: nowrap; }
.smask tr:last-child td { border-bottom: none; }
.smask input[type=text], .smask input[type=number], .smask select, .smask textarea { border: 1px solid rgba(127,127,127,.3); border-radius: 7px; background: transparent; color: inherit; padding: 5px 8px; font-size: 12px; font-family: inherit; width: 100%; box-sizing: border-box; }
.smask textarea { font-family: ui-monospace, monospace; min-height: 56px; resize: vertical; }
.smask .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.smask .muted { opacity: .55; }
.smask .tag { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; line-height: 17px; border: 1px solid transparent; white-space: nowrap; }
.smask .tag.rule { background: rgba(47,111,237,.12); color: #2f6fed; border-color: rgba(47,111,237,.3); }
.smask .tag.lit { background: rgba(31,157,85,.1); color: #1f9d55; border-color: rgba(31,157,85,.26); }
.smask-msg { border-radius: 10px; padding: 8px 13px; border: 1px solid rgba(47,111,237,.3); background: rgba(47,111,237,.08); }
.smask-msg.err { border-color: rgba(217,48,38,.4); background: rgba(217,48,38,.08); color: #b0241c; }
.smask-pre { margin: 0; padding: 10px 12px; border: 1px solid rgba(127,127,127,.22); border-radius: 8px; background: rgba(127,127,127,.05); max-height: 220px; overflow: auto; font-family: ui-monospace, monospace; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
.smask-cols { display: flex; gap: 14px; align-items: flex-start; }
.smask-cols > .smask-card { flex: 1 1 auto; min-width: 0; }
.smask-cols > .smask-card.side { flex: 0 0 380px; max-width: 42%; }
@media (max-width: 1150px) { .smask-cols { flex-direction: column; } .smask-cols > .smask-card.side { flex: 1 1 auto; max-width: none; width: 100%; } }
`

    let styleEl = null
    function ensureStyle() {
      if (styleEl || typeof document === 'undefined') return
      styleEl = document.createElement('style')
      styleEl.setAttribute('data-dsh-sensitive-mask', '')
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
      if (!response.ok || !body || body.ok === false) throw new Error(body && body.error ? body.error : 'HTTP ' + response.status)
      return body
    }

    function fmtBytes(n) {
      const v = Number(n) || 0
      if (v < 1024) return v + ' B'
      if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB'
      return (v / 1024 / 1024).toFixed(2) + ' MB'
    }

    function Toggle(props) {
      const { checked, onChange, label, hint } = props
      return h('label', { className: 'smask-toggle' },
        h('input', { type: 'checkbox', checked, onChange: (e) => onChange(e.target.checked) }),
        h('span', null, label),
        hint ? h('small', null, hint) : null)
    }

    function RulesCard(props) {
      const { config, updateRule, removeRule, addRule, addPreset, presets } = props
      return h('div', { className: 'smask-card' },
        h('div', { className: 'smask-card-head' },
          h('span', null, '脱敏规则（' + config.rules.length + '）'),
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
            h('button', { className: 'smask-btn sm', onClick: () => addRule() }, '添加规则'),
            presets.map((preset) => h('button', {
              key: preset.id,
              className: 'smask-btn sm',
              onClick: () => addPreset(preset),
              title: '添加内置规则：' + preset.name,
            }, preset.name)))),
        h('div', { style: { overflowX: 'auto' } },
          h('table', null,
            h('thead', null,
              h('tr', null,
                h('th', { style: { width: '40px' } }, '启用'),
                h('th', { style: { width: '110px' } }, '名称'),
                h('th', { style: { width: '90px' } }, '类型'),
                h('th', { style: { width: '112px' } }, '脱敏样式'),
                h('th', { style: { width: '52px' } }, '头'),
                h('th', { style: { width: '52px' } }, '尾'),
                h('th', null, '匹配（原始/正则）'),
                h('th', { style: { width: '120px' } }, '固定文本'),
                h('th', { style: { width: '60px' } }, '操作'))),
            h('tbody', null,
              config.rules.map((rule, index) => h('tr', { key: rule.id + '-' + index },
                h('td', null, h('input', { type: 'checkbox', checked: rule.enabled !== false, onChange: (e) => updateRule(index, { enabled: e.target.checked }) })),
                h('td', null, h('input', { type: 'text', value: rule.name, onChange: (e) => updateRule(index, { name: e.target.value }) })),
                h('td', null, h('select', { value: rule.type, onChange: (e) => updateRule(index, { type: e.target.value }) },
                  h('option', { value: 'regex' }, '正则'),
                  h('option', { value: 'literal' }, '字面量'))),
                h('td', null, h('select', { value: rule.style || 'inherit', onChange: (e) => updateRule(index, { style: e.target.value }) },
                  h('option', { value: 'inherit' }, '跟随全局'),
                  h('option', { value: 'placeholder' }, '占位符'),
                  h('option', { value: 'partial' }, '部分隐藏'),
                  h('option', { value: 'fixed' }, '固定文本'))),
                h('td', null, h('input', { type: 'number', min: 0, max: 12, value: rule.keepHead === undefined ? 3 : rule.keepHead, onChange: (e) => updateRule(index, { keepHead: Number(e.target.value) }) })),
                h('td', null, h('input', { type: 'number', min: 0, max: 12, value: rule.keepTail === undefined ? 4 : rule.keepTail, onChange: (e) => updateRule(index, { keepTail: Number(e.target.value) }) })),
                h('td', null, h('input', {
                  type: 'text',
                  className: 'mono',
                  value: rule.pattern,
                  onChange: (e) => updateRule(index, { pattern: e.target.value }),
                })),
                h('td', null, h('input', {
                  type: 'text',
                  value: rule.replacement,
                  onChange: (e) => updateRule(index, { replacement: e.target.value }),
                })),
                h('td', null, h('button', { className: 'smask-btn sm', onClick: () => removeRule(index) }, '删除'))))))))
    }

    function TestCard(props) {
      const { testText, setTestText, runTest, testResult, busy } = props
      return h('div', { className: 'smask-card' },
        h('div', { className: 'smask-card-head' }, h('span', null, '测试')),
        h('div', { className: 'smask-body' },
          h('textarea', {
            value: testText,
            placeholder: '粘贴一段包含手机号/证件号等敏感内容的文本，测试脱敏结果…',
            onChange: (e) => setTestText(e.target.value),
          }),
          h('div', { style: { display: 'flex', gap: '8px' } },
            h('button', { className: 'smask-btn primary sm', disabled: busy, onClick: runTest }, busy ? '测试中…' : '测试脱敏')),
          testResult
            ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                h('div', { className: 'muted' }, '脱敏结果：'),
                h('pre', { className: 'smask-pre' }, testResult.output),
                h('div', { className: 'muted' }, '命中 ' + testResult.hits.length + ' 处：'),
                h('div', { style: { maxHeight: '140px', overflow: 'auto' } },
                  testResult.hits.map((hit, i) => h('div', { key: i, className: 'mono' },
                    '[' + hit.rule + '] ' + hit.placeholder + '  →  ' + (hit.original || '（原文未记录）')))))
            : null))
    }

    function LogsCard(props) {
      const { files, selectedFile, entries, onSelect, onRefresh, onOpenDir, loading } = props
      const fileButtons = files.map((file) => h('button', {
        key: file.name,
        className: 'smask-btn sm' + (file.name === selectedFile ? ' primary' : ''),
        onClick: () => onSelect(file.name),
        title: fmtBytes(file.size) + ' · ' + file.mtime,
      }, file.name.replace('mask-', '').replace('.jsonl', '')))
      const rows = entries.map((entry, i) => h('tr', { key: i },
        h('td', { className: 'mono' }, (entry.ts || '').slice(11, 19)),
        h('td', null, entry.dir === 'tool-result'
          ? '工具' + (entry.tool ? '：' + entry.tool : '') + (entry.file ? ' · ' + entry.file : '')
          : '用户输入'),
        h('td', null, entry.rule),
        h('td', { className: 'mono' }, entry.placeholder)))
      const entryTable = h('div', { style: { maxHeight: '330px', overflow: 'auto' } },
        h('table', null,
          h('thead', null,
            h('tr', null,
              h('th', null, '时间'),
              h('th', null, '来源'),
              h('th', null, '规则'),
              h('th', null, '脱敏结果'))),
          h('tbody', null, rows)))
      const body = h('div', { className: 'smask-body' },
        files.length === 0
          ? h('div', { className: 'muted' }, '还没有日志。')
          : h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }, fileButtons),
        entries.length > 0
          ? entryTable
          : h('div', { className: 'muted' }, selectedFile ? '该文件暂无记录。' : '点击上方日期查看日志。'))
      return h('div', { className: 'smask-card side' },
        h('div', { className: 'smask-card-head' },
          h('span', null, '命中日志'),
          h('div', { style: { display: 'flex', gap: '6px' } },
            h('button', { className: 'smask-btn sm', onClick: onRefresh }, loading ? '刷新中…' : '刷新'),
            h('button', { className: 'smask-btn sm', onClick: onOpenDir }, '打开目录'))),
        body)
    }

    function Panel() {
      ensureStyle()
      const [state, setState] = useState(null)
      const [config, setConfig] = useState(null)
      const [loading, setLoading] = useState(false)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [message, setMessage] = useState('')
      const [testText, setTestText] = useState('')
      const [testResult, setTestResult] = useState(null)
      const [selectedFile, setSelectedFile] = useState('')
      const [entries, setEntries] = useState([])
      const [presets, setPresets] = useState([])

      const refresh = useCallback(async () => {
        setLoading(true)
        try {
          const body = await request(API.state)
          setState(body)
          setConfig(body.config)
          setPresets((body.config.rules || []).filter((rule) => rule.id && rule.id.startsWith('preset-')))
          if (!selectedFile && body.logFiles && body.logFiles.length > 0) {
            setSelectedFile(body.logFiles[0].name)
          }
          setError('')
        } catch (e) {
          setError(e.message)
        } finally {
          setLoading(false)
        }
      }, [selectedFile])

      useEffect(() => { refresh() }, [])

      const loadFile = async (file) => {
        setSelectedFile(file)
        setEntries([])
        setError('')
        try {
          const body = await request(API.log + '?file=' + encodeURIComponent(file) + '&limit=200')
          setEntries(body.entries || [])
        } catch (e) {
          setError(e.message)
        }
      }

      useEffect(() => {
        if (selectedFile) loadFile(selectedFile)
      }, [selectedFile])

      const flash = (text) => {
        setMessage(text)
        setTimeout(() => setMessage(''), 6000)
      }

      const updateRule = (index, patch) => {
        setConfig((prev) => {
          const next = Object.assign({}, prev, { rules: prev.rules.map((rule, i) => (i === index ? Object.assign({}, rule, patch) : rule)) })
          return next
        })
      }
      const removeRule = (index) => setConfig((prev) => Object.assign({}, prev, { rules: prev.rules.filter((_, i) => i !== index) }))
      const addRule = () => setConfig((prev) => Object.assign({}, prev, {
        rules: [...prev.rules, { id: 'custom-' + Date.now(), name: '新规则', type: 'literal', pattern: '', replacement: '掩码', flags: 'g', style: 'inherit', keepHead: 3, keepTail: 4, enabled: true }],
      }))
      const addPreset = (preset) => setConfig((prev) => {
        if (prev.rules.some((rule) => rule.id === preset.id)) { flash('已存在该内置规则'); return prev }
        return Object.assign({}, prev, { rules: [...prev.rules, Object.assign({}, preset)] })
      })

      const save = async () => {
        setBusy(true)
        setError('')
        try {
          const body = await request(API.config, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ config }),
          })
          setState((prev) => Object.assign({}, prev, { config: body.config }))
          flash('已保存，规则立即生效（新请求开始拦截）。')
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }

      const runTest = async () => {
        setBusy(true)
        setError('')
        try {
          setTestResult(await request(API.test, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: testText }),
          }))
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }

      const openLogDir = async () => {
        try {
          await request(API.openLogDir, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
        } catch (e) {
          setError(e.message)
        }
      }

      if (!config) {
        return h('div', { className: 'smask' },
          h('div', { className: 'smask-head' }, h('div', null, h('h3', { className: 'smask-title' }, '脱敏显示'))),
          error ? h('div', { className: 'smask-msg err' }, error) : h('div', { className: 'muted' }, loading ? '加载中…' : '加载失败'))
      }

      return h('div', { className: 'smask' },
        h('div', { className: 'smask-head' },
          h('div', null,
            h('h3', { className: 'smask-title' }, '敏感词替换'),
            h('p', { className: 'smask-sub' }, '按规则在内容发给 AI 前做脱敏显示：用户输入与工具结果先替换成「占位符 / 部分隐藏 / 固定文本」；只有占位符样式会在工具执行前还原成真实值（会话历史里仍只保存脱敏后的内容）。样式与保留位数都可配置，规则只保存在本机 profile，命中记录写入本地日志文件。')),
          h('div', { className: 'smask-actions' },
            h(Toggle, {
              checked: config.enabled,
              onChange: (value) => setConfig(Object.assign({}, config, { enabled: value })),
              label: '总开关',
            }),
            h('button', { className: 'smask-btn', onClick: refresh, disabled: loading }, loading ? '刷新中…' : '刷新'),
            h('button', { className: 'smask-btn primary', onClick: save, disabled: busy }, busy ? '保存中…' : '保存配置'))),
        h('div', { className: 'smask-chips' },
          h('div', { className: 'smask-chip' }, h('b', null, state ? state.todayCount : 0), h('span', null, '今日命中')),
          h('div', { className: 'smask-chip' }, h('b', null, state ? state.placeholders : 0), h('span', null, '活动占位符')),
          h('div', { className: 'smask-chip' }, h('b', null, config.rules.filter((rule) => rule.enabled !== false).length), h('span', null, '启用规则')),
          h('div', { className: 'smask-chip' }, h('b', null, state && state.logFiles ? state.logFiles.length : 0), h('span', null, '日志文件'))),
        h('div', { className: 'smask-card' },
          h('div', { className: 'smask-card-head' }, h('span', null, '拦截范围')),
          h('div', { className: 'smask-body' },
            h('div', { className: 'smask-toggles' },
              h(Toggle, {
                checked: config.maskUserInput,
                onChange: (value) => setConfig(Object.assign({}, config, { maskUserInput: value })),
                label: '拦截用户输入',
                hint: '（写入会话前打码）',
              }),
              h(Toggle, {
                checked: config.maskToolResults,
                onChange: (value) => setConfig(Object.assign({}, config, { maskToolResults: value })),
                label: '拦截工具结果',
                hint: '（读取文件/命令输出前打码）',
              }),
              h(Toggle, {
                checked: config.demaskModelOutput,
                onChange: (value) => setConfig(Object.assign({}, config, { demaskModelOutput: value })),
                label: '还原工具参数',
                hint: '（执行前把占位符还原成原文；会话历史里仍保留占位符）',
              }),
              h(Toggle, {
                checked: config.logOriginals,
                onChange: (value) => setConfig(Object.assign({}, config, { logOriginals: value })),
                label: '日志记录原文',
                hint: '（默认关闭，开启后原文会明文写入本机日志）',
              })))),
        h('div', { className: 'smask-card' },
          h('div', { className: 'smask-card-head' }, h('span', null, '脱敏样式')),
          h('div', { className: 'smask-body' },
            h('div', { className: 'smask-style-row' },
              h('span', null, '全局默认样式'),
              h('select', {
                value: config.maskStyle || 'placeholder',
                onChange: (e) => setConfig(Object.assign({}, config, { maskStyle: e.target.value })),
              },
                h('option', { value: 'placeholder' }, '占位符（[[手机号#1]]，可还原）'),
                h('option', { value: 'partial' }, '部分隐藏（138****8000，不可还原）'),
                h('option', { value: 'fixed' }, '固定文本（用规则里的「固定文本」，不可还原）')),
              h('small', null, '单条规则可在「脱敏规则」表里覆盖样式与保留头/尾位数')))),
        error ? h('div', { className: 'smask-msg err' }, error) : null,
        message ? h('div', { className: 'smask-msg' }, message) : null,
        h(RulesCard, { config, updateRule, removeRule, addRule, addPreset, presets }),
        h('div', { className: 'smask-cols' },
          h(TestCard, { testText, setTestText, runTest, testResult, busy }),
          h(LogsCard, {
            files: (state && state.logFiles) || [],
            selectedFile,
            entries,
            loading,
            onSelect: loadFile,
            onRefresh: refresh,
            onOpenDir: openLogDir,
          })))
    }

    function apply(ctx) {
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: NS,
        order: 63,
        label: () => '脱敏显示',
        inject: () => ({}),
      }, () => h(Panel)))
    }

    exports.name = NS
    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
