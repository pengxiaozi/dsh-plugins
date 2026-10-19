# DSH Plugins — DeepSeek Harness 社区插件

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的两个 Web 插件：把 **MCP 连接管理** 和 **Skills 管理** 搬进设置页，纯本地运行、无任何外部上传。

## 插件一览

| 插件 | 设置入口 | 能力 |
|---|---|---|
| [dsh-mcp-panel](./dsh-mcp-panel/) | **MCP 连接** | 查看所有 MCP 服务器（托管 + profile 配置行）、连接状态与工具数；新增/编辑/删除；托管配置写入 profile 的 `cordis.patch.yml` 并热重载 |
| [dsh-skill-panel](./dsh-skill-panel/) | **Skills** | 查看全部本地/内置 skill，搜索、来源过滤、SKILL.md 预览、文件清单、**打开文件夹**；导出单个/选中/全部为 ZIP（含 `_manifest.json`） |

两个插件都是 **host 半 + web client 半** 的结构，遵循 DSH 官方插件形态：

- `package.json` 声明 `dsh.bundle.patch` 与 `dsh.client`；
- host 半通过 `ctx.inject(['webServer'])` 挂同源 HTTP 路由；
- client 半注册 `settings.section` 面板，通过 `window.__ModuleLoader__` 懒加载。

## Skills

| Skill | 作用 |
|---|---|
| [plan-gate](./skills/plan-gate/) | 首个需求先出「实施方案 + 涉及文件清单」再请求确认的闸门；确认后执行，**同一需求只做一次** |

安装（全局技能目录）：把 `skills/plan-gate` 复制到 `<AGENTS_HOME>/skills/plan-gate`（Windows 默认 `%USERPROFILE%\.agents\skills\plan-gate`），刷新页面后技能出现在目录中；也可在对话中直接用 `/plan-gate` 显式调用。

## 安装（本地 link，当前 DSH 版本）

DSH 目前没有发布这两个包到 npm，用 profile 的 `link:` 安装：

```bash
# 1) 克隆本仓库
git clone https://github.com/pengxiaozi/dsh-plugins.git

# 2) 在 DSH profile 目录安装（Windows 默认 %DSH_HOME%\profiles\<profile>）
cd "$DSH_HOME/profiles/desktop"
pnpm add "link:<repo>/dsh-mcp-panel"
pnpm add "link:<repo>/dsh-skill-panel"

# 3) 在 profile package.json 的 dsh.profile.bundles 末尾追加：
#    "dsh-mcp-panel",
#    "dsh-skill-panel"

# 4) 刷新 DSH 页面（Ctrl+F5）；未出现则重启 DSH
```

卸载：从 bundles 移除两个名字，`pnpm remove dsh-mcp-panel dsh-skill-panel`，删除插件目录。

## 兼容性

- 已在 **DeepSeek Harness 0.2.1-rc.1**（Windows 桌面版，`desktop` profile / web 面）验证；
- 只使用公开插件面：`webServer`、`loader`、`configEditor`、`tools`、`skills`、`profileContext`；
- 不依赖任何第三方运行时依赖，插件代码只用 Node 内置模块。

## 安全与隐私

- **不收集、不上传任何数据**：无遥测、无外部请求；列表/读写/导出全部在本机完成。
- **MCP 面板**会把服务器配置（含 `headers` 中的 `Authorization` 等令牌）写入 **profile 的 `cordis.patch.yml` 明文**。请勿把 profile 目录提交到公共仓库；建议优先使用 `127.0.0.1` 本地地址。
- **Skills 面板只读**：不修改、不删除 skill 文件；ZIP 在内存中生成后直接返回浏览器。
- 导出路径与技能名来自 DSH 技能目录（`ctx.skills`），不接受任意文件系统路径。

## 开发与测试

每个插件目录下都有自包含测试：

```bash
node dsh-mcp-panel/test/smoke.mjs
node dsh-skill-panel/test/smoke.mjs
node dsh-skill-panel/test/host-routes.mjs   # 用假 ctx 跑通 state/body/export 路由
```

修改 host 代码后，在 profile 里触发一次配置重载（例如改一下 `cordis.patch.yml` 的时间戳内容），或重启 DSH，新代码才会生效。

## English

Two community plugins for DeepSeek Harness: **dsh-mcp-panel** (inspect and edit MCP connections from Settings) and **dsh-skill-panel** (browse skills and export them as ZIP). Both run fully locally with no telemetry or external requests. Install via `pnpm add link:<path>` in your DSH profile and append the package names to `dsh.profile.bundles`.

## License

[MIT](./LICENSE) © 2026 pengxiaozi
