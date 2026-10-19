# dsh-mcp-panel

DeepSeek Harness 的 **MCP 连接管理** 插件：在 **设置 → MCP 连接** 中集中查看、添加、编辑、删除 MCP 服务器，并显示连接状态与已注册工具数。

## 功能

- **一览所有 MCP 连接**
  - *托管* 连接：由本插件维护，保存在 `<profile>/mcp-panel.json`，并在 profile 的 `cordis.patch.yml` 中生成带标记的托管区块，保存后由 HMR 自动重载；
  - *配置* 连接：profile 里其它 `@deepseek-ai/dsh-mcp-client` 行（手写或其它插件写入），通过 DSH 的 `configEditor` 就地编辑，保留注释与其余配置。
- **状态可视化**：每个连接显示传输方式、URL/命令、已注册工具数、前几个工具名、已连接/未连接。
- **增删改**：托管连接支持新增/编辑/删除；配置连接支持编辑（只读展示不可删除）。
- **校验**：`serverName` 正则、transport 枚举（`streamable-http` / `stdio`）、URL 协议、`command` 非空、`args` / `headers` / `env` 类型校验，坏配置不会写入 profile。
- **零第三方依赖**：host 只用 Node 内置模块；client 只 `require('react')`。

## 安装

见仓库根 [README](../README.md#安装本地-link当前-dsh-版本)。简版：

```bash
cd "$DSH_HOME/profiles/desktop"
pnpm add "link:<repo>/dsh-mcp-panel"
# profile package.json → dsh.profile.bundles 追加 "dsh-mcp-panel"
# 刷新页面
```

## 使用

设置 → **MCP 连接**：

| 操作 | 说明 |
|---|---|
| 添加 MCP Server | 填 `serverName`、传输方式、URL 或 command/args，可选 headers/env |
| 编辑 | 托管连接改列表；配置连接走 `configEditor` 改写对应 profile 行 |
| 删除 | 仅托管连接；删除后托管区块与侧车文件同步更新 |
| 刷新 | 重新拉取列表与工具状态 |

保存后会有约 3 秒的配置重载窗口，页面随后自动刷新。

## 实现要点

- host 半注册同源路由：
  - `GET /dsh-mcp-panel/state` — 连接列表 + `ctx.tools.schemas()` 统计的 `mcp__<server>__*` 工具；
  - `POST /dsh-mcp-panel/save-managed` — 写侧车 + 托管区块；
  - `POST /dsh-mcp-panel/save-external` — `configEditor.edit()` 就地编辑 profile 行。
- client 半通过 `ctx.slots.register({ name: 'settings.section' })` 注册设置页。
- 托管区块用注释标记包裹（`# >>> dsh-mcp-panel managed ...`），可安全地整段删除。

## 测试

```bash
node test/smoke.mjs
```

覆盖：托管区块渲染/替换/删除、校验规则、client bundle 契约与 slot 注册。

## 安全

- 不收集、不上传数据；无外部请求。
- 服务器配置（含 `headers` 中的令牌）写入**本机 profile** 的 `cordis.patch.yml` 明文，请勿把 profile 提交到公共仓库。
- 建议只连接 `127.0.0.1` 提供的本地 MCP 服务。

## 兼容性

- DeepSeek Harness 0.2.1-rc.1（web 面 / desktop profile）已验证；
- 使用公开插件面：`webServer`、`loader`、`tools`、`configEditor`、`profileContext`。

## License

[MIT](../LICENSE) © 2026 pengxiaozi
