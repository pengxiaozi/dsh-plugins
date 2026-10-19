# DSH Plugins — DeepSeek Harness 社区插件

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的四个 Web 插件：**MCP 连接管理**、**Skills 管理**、**敏感信息脱敏** 和 **渗透测试安全清单**，全部搬进设置页，纯本地运行、无任何外部上传。

## 插件一览

| 插件 | 设置入口 | 能力 |
|---|---|---|
| [dsh-mcp-panel](./dsh-mcp-panel/) | **MCP 连接** | 查看所有 MCP 服务器（托管 + profile 配置行）、连接状态与工具数；新增/编辑/删除；托管配置写入 profile 的 `cordis.patch.yml` 并热重载 |
| [dsh-skill-panel](./dsh-skill-panel/) | **Skills** | 查看全部本地/内置 skill，搜索、来源过滤、SKILL.md 预览、文件清单、**打开文件夹**；导出单个/选中/全部为 ZIP（含 `_manifest.json`） |
| [dsh-sensitive-mask](./dsh-sensitive-mask/) | **脱敏显示** | 发往模型前按正则/字面量脱敏（占位符 / 部分隐藏 / 固定文本，全局默认 + 单规则覆盖，头尾位数可配）；仅占位符会在工具执行前还原；命中写本地 JSONL 日志（默认不存原文） |
| [dsh-sec-checklist](./dsh-sec-checklist/) | **安全清单** | 渗透测试检查清单：内置 6 分类 36 项 + 自定义；项目/授权/范围/测试账号本机保存；勾选要调用的渗透 skill；保存后注册运行时技能 `security-checklist` 供 AI 加载；内置 Playbook 与 Yakit MCP 工具对照 |

四个插件都是 **host 半 + web client 半** 的结构，遵循 DSH 官方插件形态：

- `package.json` 声明 `dsh.bundle.patch` 与 `dsh.client`；
- host 半通过 `ctx.inject(['webServer'])` 挂同源 HTTP 路由；
- client 半注册 `settings.section` 面板，通过 `window.__ModuleLoader__` 懒加载。

## Skills

| Skill | 作用 |
|---|---|
| [plan-gate](./skills/plan-gate/) | 首个需求先出「实施方案 + 涉及文件清单」再请求确认的闸门；确认后执行，**同一需求只做一次** |

安装（全局技能目录）：把 `skills/plan-gate` 复制到 `<AGENTS_HOME>/skills/plan-gate`（Windows 默认 `%USERPROFILE%\.agents\skills\plan-gate`），刷新页面后技能出现在目录中；也可在对话中直接用 `/plan-gate` 显式调用。

## 安装（本地 link，当前 DSH 版本）

DSH 目前没有发布这些包到 npm，用 profile 的 `link:` 安装：

```bash
# 1) 克隆本仓库
git clone https://github.com/pengxiaozi/dsh-plugins.git

# 2) 在 DSH profile 目录安装（Windows 默认 %DSH_HOME%\profiles\<profile>）
cd "$DSH_HOME/profiles/desktop"
pnpm add "link:<repo>/dsh-mcp-panel"
pnpm add "link:<repo>/dsh-skill-panel"
pnpm add "link:<repo>/dsh-sensitive-mask"
pnpm add "link:<repo>/dsh-sec-checklist"

# 3) 在 profile package.json 的 dsh.profile.bundles 末尾追加：
#    "dsh-mcp-panel",
#    "dsh-skill-panel",
#    "dsh-sensitive-mask",
#    "dsh-sec-checklist"
#    或在 profile 的 cordis.patch.yml 里用 loader insert 行加载（推荐，宿主回写 bundles 时不会丢）

# 4) 刷新 DSH 页面（Ctrl+F5）；未出现则重启 DSH
```

卸载：从 bundles 移除四个名字，`pnpm remove dsh-mcp-panel dsh-skill-panel dsh-sensitive-mask dsh-sec-checklist`，删除插件目录。

## 兼容性

- 已在 **DeepSeek Harness 0.2.1-rc.1**（Windows 桌面版，`desktop` profile / web 面）验证；
- 只使用公开插件面：`webServer`、`loader`、`configEditor`、`tools`、`skills`、`profileContext`；
- 不依赖任何第三方运行时依赖，插件代码只用 Node 内置模块。

## 安全与隐私

- **不收集、不上传任何数据**：无遥测、无外部请求；列表/读写/导出全部在本机完成。
- **MCP 面板**会把服务器配置（含 `headers` 中的 `Authorization` 等令牌）写入 **profile 的 `cordis.patch.yml` 明文**。请勿把 profile 目录提交到公共仓库；建议优先使用 `127.0.0.1` 本地地址。
- **Skills 面板只读**：不修改、不删除 skill 文件；ZIP 在内存中生成后直接返回浏览器。
- 导出路径与技能名来自 DSH 技能目录（`ctx.skills`），不接受任意文件系统路径。
- **脱敏显示**：规则与命中日志只保存在本机 profile；日志默认只记规则、脱敏结果、长度与 hash，**不记原文**（可在设置里显式打开）；占位符映射只在进程内存中，重启即清空；插件不发起任何外部请求。
- **安全清单**：项目/授权/范围/测试账号只保存在本机 profile（`sec-checklist.json`）；密码为本地明文，默认**不会**写进运行时技能或模型上下文（需在设置里显式打开「把密码写进清单」）；插件不内置任何真实凭据，不发起外部请求。

## 开发与测试

每个插件目录下都有自包含测试：

```bash
node dsh-mcp-panel/test/smoke.mjs
node dsh-skill-panel/test/smoke.mjs
node dsh-skill-panel/test/host-routes.mjs   # 用假 ctx 跑通 state/body/export 路由
node dsh-sensitive-mask/test/smoke.mjs
node dsh-sensitive-mask/test/host-routes.mjs
node dsh-sec-checklist/test/smoke.mjs
node dsh-sec-checklist/test/host-routes.mjs   # 假 ctx：运行时技能注册、state/config/preview/doc/reveal/reset
```

修改 host 代码后，在 profile 里触发一次配置重载（例如改一下 `cordis.patch.yml` 的时间戳内容），或重启 DSH，新代码才会生效。

## English

Four community plugins for DeepSeek Harness: **dsh-mcp-panel** (inspect and edit MCP connections from Settings), **dsh-skill-panel** (browse skills and export them as ZIP), **dsh-sensitive-mask** (mask user input and tool results before they reach the model, with configurable placeholder / partial / fixed styles and local audit logs) and **dsh-sec-checklist** (pentest checklist with project/scope/credentials config, selectable pentest skills and a generated `security-checklist` runtime skill the agent can load). All run fully locally with no telemetry or external requests. Install via `pnpm add link:<path>` in your DSH profile and append the package names to `dsh.profile.bundles`.

## License

[MIT](./LICENSE) © 2026 pengxiaozi
