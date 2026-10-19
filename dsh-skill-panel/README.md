# dsh-skill-panel

DeepSeek Harness 的 **Skills 管理** 插件：在 **设置 → Skills** 中直观查看全部 skill，查看 SKILL.md 与文件清单，并导出单个 / 选中 / 全部为 ZIP。

## 功能

- **技能列表**：名称、描述、来源根（`user-dsh` / `user-agents` / `custom` / `bundle`）、文件数、总大小、`model` / `user` 可调用标记；内置技能标注「内置」。
- **搜索与过滤**：按名称/描述/路径搜索，按来源根过滤。
- **详情**：SKILL.md 正文预览（超过 400KB 截断提示）、完整文件清单、复制目录路径。
- **ZIP 导出**：
  - 单个 / 多选 / 全部；
  - 目录结构 `<skillName>/...`，并附带 `_manifest.json`（技能元数据 + 文件清单）；
  - 跳过 `.git`、`node_modules`、`__pycache__`；
  - 上限：单 skill 600 文件 / 40MB，单次导出 300 skill / 200MB。
- **数据来源**：DSH 技能注册表 `ctx.skills.list()` 与本地 provider 配置根扫描合并，和模型看到的技能目录同源；frontmatter 解析支持折叠块（`>- `）、引号与布尔变体。

## 安装

见仓库根 [README](../README.md#安装本地-link当前-dsh-版本)。简版：

```bash
cd "$DSH_HOME/profiles/desktop"
pnpm add "link:<repo>/dsh-skill-panel"
# profile package.json → dsh.profile.bundles 追加 "dsh-skill-panel"
# 刷新页面
```

## 使用

设置 → **Skills**：

| 操作 | 说明 |
|---|---|
| 搜索 / 来源过滤 | 顶部工具栏，实时过滤 |
| 查看 | 右侧详情面板：正文 + 文件清单 |
| 复制路径 | 复制 skill 目录（或扁平 .md 文件所在路径） |
| 导出 / 导出选中 / 导出全部 | 浏览器直接下载 ZIP |

## 实现要点

- host 半注册同源路由：
  - `GET /dsh-skill-panel/state` — 技能列表 + 文件数/大小（实时扫描）；
  - `POST /dsh-skill-panel/body` — 单个技能正文与文件清单；
  - `GET /dsh-skill-panel/export?names=a,b` / `?all=1` — 生成 ZIP。
- ZIP 由内置 writer 生成（deflate/store + CRC32 + UTF-8 文件名 + central directory），不依赖任何压缩库；可被 Windows 资源管理器 / `Expand-Archive` / .NET `ZipFile` 正常解压。
- client 半通过 `settings.section` slot 注册，下载用 Blob + `<a download>`。

## 测试

```bash
node test/smoke.mjs        # ZIP writer、文件扫描、frontmatter、client bundle 契约
node test/host-routes.mjs  # 假 ctx 跑通 state/body/export 三个路由
```

## 安全

- 只读本地 skill 文件，不修改、不删除；
- 不收集、不上传数据；ZIP 在本机内存生成；
- 导出目标只能是技能注册表里的 skill 路径，不接受任意文件系统路径。

## 兼容性

- DeepSeek Harness 0.2.1-rc.1（web 面 / desktop profile）已验证；
- 使用公开插件面：`webServer`、`loader`、`skills`、`profileContext`。

## License

[MIT](../LICENSE) © 2026 pengxiaozi
