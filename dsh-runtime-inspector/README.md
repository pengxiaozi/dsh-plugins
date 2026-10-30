# dsh-runtime-inspector — DSH 运行时透视

一个双半插件（host 半 + web client 半），把当前 DSH 进程里"看不见的运行逻辑"变成可浏览、可供模型查询的数据：

- **宿主到底拦截了什么**：每个事件上挂了哪些监听器（含注册顺序、`prepend`、所属 Loader 包），以及这些拦截链对真实流量做出的决策；
- **审批 / 拦截 / workspace 三类规则**：部署审批策略、权限预设、每会话覆盖、工具护栏与限制、工作区注册表与归档规则；
- **system prompt 链**：真实装配出的 section 链、runtime contexts、变量、渲染后的完整 prompt，以及渲染算法源码；
- **宿主包常量与默认值**：`node_modules/@deepseek-ai/*` 里的字符串常量、schema 默认值、Loader 生效配置。

侧栏入口为 **运行时透视**（`runtime-inspector` 面板），页签：提示词链 / 拦截 / 规则 / 字符串常量 / 默认值与配置 / 运行状态。

## 看什么

| 页签 | 数据来源 | 内容 |
|---|---|---|
| 提示词链 | `system-prompt/assemble`、`llm/stream` 事件；`ctx.systemPrompt` 注册表 | 有序 section 链（顺序 / 插值 / `complete` 标志 / 字数 / 原文）、runtime contexts、变量表、工具 schema 数量、渲染后的完整 system prompt、`SECTION_ORDERS` / `CONTEXT_ORDERS` 顺序表、`renderPrompt` / `interpolate` 源码 |
| 拦截 | Cordis 活事件表 `ctx.events._hooks` + 14 条 seam 的 pass-through 观察器 | 监听器归属到 Loader 包；运行时记录（pass / intercept / error / decision，含输入、输出、耗时、会话）；执行服务内部字段快照 |
| 规则 | `ctx.approval`、`ctx.permissionPresets`、`ctx.tools.layers`、`ctx.workspaceRegistry`、`ctx.sessions`、`configEditor` | 审批：部署策略、预设表、每会话 approval 覆盖、审批链监听器、近期 ask/deny；拦截：呈现模式、guard/restriction 注册表、作用域工具分布、相关 Loader 配置、tools/* 与 fs/* 监听器；workspace：注册表（标题/路径/会话数）、会话目录与审批覆盖、沙箱根、归档前活动来源、注册表内部集合 |
| 字符串常量 | 安装目录 `node_modules/@deepseek-ai/*/lib/index.js` | 大写常量的名称、类型（string / number / object / array）、值或结构摘要、行号 |
| 默认值 | 包源码 `.default(...)` 静态提取（常量引用会解析成实际值）；`ctx.configEditor` | schema 默认值，以及每个 Loader 条目的 inherited / override |
| 运行状态 | Host 进程探针 | 安装目录探测、可选服务可用性、捕获计数、路由清单 |

被观察的拦截 seam：`tools/pre-execute`、`tools/post-execute`、`tools/execute`、`agent/pre-step`、`agent/request`、`llm/stream`、`system-prompt/assemble`、`approval/request`、`user-questions/request`、`fs/write-intent`、`fs/edit-intent`、`session-telemetry/record`、`compaction/summary-error`、`workspace/session-activity`。

观察器以 `prepend` 包在整条链最外层，因此记录的是**最终决策**而不是内置默认值；它只调用一次 `next()` 并原样返回，不改变任何行为。拦截记录保存在进程内存的环形缓冲（200 条），插件重载即清空。

## Agent 工具

`dsh_runtime_inspect`（与页面同一份数据）：

- `action=intercepts`：钩子表 + 拦截记录（可按 `event` / `verdict` 过滤）
- `action=rules`：审批 / 拦截 / workspace 规则
- `action=prompt`：system prompt 链（`full=true` 返回完整文本）
- `action=constants`：常量目录（`kind=string|number|object|array|default`）
- `action=configs`：Loader 生效配置
- `action=source`：读宿主包文件（限定 `node_modules/@deepseek-ai/<pkg>/…`，支持 `query` 行搜索）
- `action=packages` / `action=hooks` / `action=health`

## 路由与安全

所有路由位于 `/dsh-runtime-inspector/*`，由 host 半通过 `ctx.webServer.register` 注册；每个请求先调用 `ctx.connection.requestRejection(req)`，沿用 DSH 的 Host/Origin 校验与登录 token cookie 鉴权，未通过返回 401/403。插件严格只读：不写配置、不改 system prompt、不注入任何内容、无外部请求；源码读取被限制在安装目录的 `@deepseek-ai` 包内并拒绝路径逃逸。

## 安装

在当前 DSH profile 中 link 安装：

```bash
git clone https://github.com/pengxiaozi/dsh-plugins.git
cd "$DSH_HOME/profiles/desktop"
pnpm add "link:<repo>/dsh-runtime-inspector"
```

然后在 profile 的 `cordis.patch.yml` 里追加（推荐，宿主回写 bundles 时不会丢）：

```yaml
- insert:
    - id: runtime-inspector
      name: 'dsh-runtime-inspector'
```

刷新 DSH 页面（Ctrl+F5）；未出现则重启 DSH。

## 文件结构

- `lib/index.js` — host 入口：事件采集、HTTP 路由、`dsh_runtime_inspect` 工具
- `lib/prompt.js` — 装配快照、注册表视图、渲染实现、顺序表与渲染源码提取
- `lib/inventory.js` — 安装目录探测、包扫描、常量/默认值静态提取、包源码读取
- `lib/intercept.js` — 活事件钩子表、拦截 seam 观察器与记录、策略快照
- `lib/rules.js` — 审批 / 拦截 / workspace 规则快照
- `client/client.js` — Web 面板：侧栏图标 + 主面板六个页签

## 测试

自包含测试，不需要运行中的 DSH：

```bash
node dsh-runtime-inspector/test/smoke.mjs        # 纯函数：常量/默认值解析、prompt 渲染、钩子归属、规则快照
node dsh-runtime-inspector/test/host-routes.mjs  # 假 ctx 跑通 apply()、HTTP 路由、鉴权拒绝与工具注册
```

## English

`dsh-runtime-inspector` is a host + web-client plugin for DeepSeek Harness that shows what the host actually intercepts at runtime: every event's mounted listeners attributed to their Loader package, the decisions those chains produced for live traffic, approval / interception / workspace rules, the real system-prompt assembly chain and rendered prompt, host-package string constants, schema defaults and the effective Loader configuration. Read-only, no external requests; all HTTP routes sit behind DSH's same-origin login fence.

## License

[MIT](../../LICENSE) © 2026 pengxiaozi
