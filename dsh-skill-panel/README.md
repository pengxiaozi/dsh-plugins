# dsh-skill-panel

DeepSeek Harness 插件：在 **设置 → Skills** 中集中查看所有本地 skill，并支持导出 ZIP。

- 数据源：`ctx.skills.list()`（与模型看到的技能目录一致，含 frontmatter 校验与同名优先级）。
- 每条显示：名称、provider/source、skill 目录、文件数、总大小、描述、模型/用户可调用标记。
- 详情：SKILL.md 正文预览、文件清单（相对路径 + 大小）、复制路径。
- 导出：单个 / 多选 / 全部 → `<name>/...` 结构的 ZIP，附 `_manifest.json`；`.git`、`node_modules` 自动排除。
