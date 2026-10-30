# dsh-session-exporter — DSH 会话导出

一个双半插件（host 半 + web client 半），把工作区里的**全部会话记录**导出成可读、可分析、可交付的文件：

- **按工作区**列出所有会话（含冷会话、子会话），也可切换成跨工作区「全部会话」；
- **单个会话**直接下载 Markdown / JSON / 问答 JSON，或在列表里勾选；
- **整批导出**为 ZIP，或写进 `<workspace>/dsh-session-exports/<时间戳>/`（同时生成 `all.md`、`all.json`、`all.qa.json`、`manifest.json`）；
- **给 AI 的资料**：导出内容可直接由 `dsh_session_export` 工具读回，模型据此提炼成 Markdown 文档（或按问答 JSON 重排）。

侧栏入口为 **会话导出**（`session-exporter` 面板）。

## 导出格式

| 格式 | 内容 | 适合 |
|---|---|---|
| `md` | 人类可读转录：会话元信息、Turn、用户/助手消息、工具调用与结果（可折叠，可配置是否包含 system/推理/工具） | 归档、交付、让 AI 提炼 |
| `json` | 无损：`{format, session(header), stats, events[]}`，事件原样保留 | 二次分析、迁移、程序处理 |
| `jsonl` | 一行 header + 一行一个事件，NDJSON | 流式处理、grep |
| `qa` | 问答对：`{session, stats, pairs:[{turn, question, answer, at, tools, model}]}` | 语料、微调、FAQ 整理 |
| `events` | 每个事件的一行索引（seq/type/time/summary） | 快速浏览/对账 |

数据来自 `ctx.sessionPersistence`（DSH 的校验式会话日志），不是直接读 JSONL 目录，所以冷会话、格式校验、迁移标记与宿主一致。附件（图片/文件）只导出事件中的引用，不复制二进制。

## 路由与安全

所有路由位于 `/dsh-session-exporter/*`，先过 `ctx.connection.requestRejection`（DSH Host/Origin + 登录 cookie），未登录返回 401。插件只读会话日志；唯一的写操作是「导出到工作区」，目标必须是**已注册工作区目录**，文件写入 `<workspace>/dsh-session-exports/…`，不接受任意路径。

- `GET /health`、`GET /workspaces`、`GET /sessions?workspace=&all=1&titles=1`
- `GET /export?session=&format=md|json|jsonl|qa|events&download=1`
- `GET /export-all?workspace=&formats=md,json,qa`（ZIP）
- `POST /save` `{workspace, sessions: "all"|["id…"], formats: ["md","json"]}`

## Agent 工具

`dsh_session_export`：

- `action=workspaces` — 工作区目录（标题/路径/会话数）
- `action=list` — 会话列表（`workspace` 默认当前会话目录；`all=true` 跨工作区；默认读取标题）
- `action=export` — 读单个会话（`session` + `format`，可 `maxChars` 截断），返回内容供模型**提炼成 Markdown 文档**
- `action=save` — 把选中会话或整个工作区写入磁盘，返回目录与文件清单

典型用法：用户说「把这个工作区的会话导出，然后提炼成 md 文档」→ 模型先 `action=save`（保全套数据），再 `action=export` 或直接读 `all.md`，最后产出 `session-digest.md`。

## 安装

在当前 DSH profile 中 link 安装：

```bash
git clone https://github.com/pengxiaozi/dsh-plugins.git
cd "$DSH_HOME/profiles/desktop"
pnpm add "link:<repo>/dsh-session-exporter"
```

然后在 profile 的 `cordis.patch.yml` 追加（推荐）：

```yaml
- insert:
    - id: session-exporter
      name: 'dsh-session-exporter'
```

刷新页面（Ctrl+F5）；未出现则重启 DSH。

## 文件结构

- `lib/index.js` — host 入口：路由、鉴权、导出/保存接口、`dsh_session_export` 工具
- `lib/sessions.js` — sessionPersistence 读取、工作区解析、批量保存、最小 ZIP 写入器（仅 Node 内置模块）
- `lib/format.js` — 纯格式化：md / json / jsonl / qa / events、统计、文件名
- `client/client.js` — Web 面板：工作区选择、会话勾选、下载/导出按钮
- `test/format.mjs` — 纯格式化测试
- `test/host-routes.mjs` — 假 ctx：apply、鉴权、列表、单会话导出、ZIP、保存、工具

## 测试

```bash
node dsh-session-exporter/test/format.mjs
node dsh-session-exporter/test/host-routes.mjs
```

## English

`dsh-session-exporter` lists every session of a workspace (cold and subagent sessions included, via `ctx.sessionPersistence`) and exports one session or the whole workspace as Markdown, lossless JSON, NDJSON, Q&A JSON or an event index — as a download (ZIP for batches) or by writing `<workspace>/dsh-session-exports/<timestamp>/` with `all.md` / `all.json` / `all.qa.json` / `manifest.json`. The same data is available to the agent through `dsh_session_export`, which can then distill the export into a Markdown document. Read-only apart from writing into a registered workspace; every route sits behind DSH's same-origin login fence.

## License

[MIT](../../LICENSE) © 2026 pengxiaozi
