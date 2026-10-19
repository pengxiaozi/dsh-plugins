# dsh-sec-checklist · 安全清单（渗透测试）

给 DeepSeek Harness 的渗透测试工作台：把 **常用渗透检查清单**、**项目/授权/范围/测试账号** 和 **Yakit 工具对照** 集中到设置页，并注册成运行时技能 `security-checklist`。AI 做渗透测试时加载该技能，就能按固定配置和清单逐项执行，不会每次重新问一遍范围与账号。

## 功能

- **内置清单**：授权与范围 / 信息收集 / 漏洞测试 / Yakit 联动 / 证据与报告 / 清理与恢复，共 30+ 检查项，每项可关联 Yakit MCP 工具与渗透技能。
- **自定义清单**：按分类增删改检查项，编辑说明、关联技能、Yakit 工具名与示例参数。
- **安全配置（本机）**：项目名称、客户、授权人/授权书、时间窗、目标范围、排除项、环境、代理、规则约束，以及测试账号（名称/服务/用户名/密码/备注）。
- **渗透技能选择**：从已安装 skill 中勾选本次要用的渗透技能（hack、attack-surface-mapping、api-sec、sqli…），写进清单供 AI 按需加载；支持搜索与「只看推荐」。
- **运行时技能**：保存后自动注册 `security-checklist`，内容 = 项目配置 + 测试账号（密码默认不下发）+ 分类检查清单 + 推荐技能 + Yakit 工具速查表。
- **文档**：内置《安全渗透测试 Playbook》，可在设置页查看、复制、把生成的清单下载为 `.md`。
- **Yakit 对照**：子域、端口、指纹、爬虫、HTTP 重放、MITM、DNSLog、风险登记等常用 `mcp__yakit__*` 工具与示例参数。

## 使用

1. 设置 → **安全清单**：填项目/授权/范围；添加测试账号；勾选本阶段技能。
2. 点保存 → 插件重新生成并注册运行时技能 `security-checklist`。
3. 对 AI 说：「加载 security-checklist，按清单开始渗透测试」；AI 会用 `skill` 工具加载，并按清单调用 Yakit MCP 工具、登记风险。
4. 测试中随时回设置页调整清单/账号，保存后技能内容同步更新。


## 界面

- 顶部：启用开关、预览清单、恢复内置、刷新、保存配置。
- 摘要 chips：检查项 / 启用项 / 选中技能 / 测试账号 / 可用技能。
- Tab 分区：概览（项目摘要 + 就绪度 + 使用步骤）、项目授权、范围环境、测试账号、检查清单（分类筛选/搜索/卡片式编辑）、渗透技能（搜索/只看推荐/卡片勾选）、文档（预览清单 / Playbook / 复制 / 下载）。
- 清单项支持启用开关、分类切换、关联技能与 Yakit 工具；底部「Yakit 工具对照」可折叠。
- 深/浅色自动适配，窄屏自动单列。
## 安装（本地 link）

    cd $DSH_HOME/profiles/desktop
    pnpm add "link:<repo>/dsh-sec-checklist"

然后在 profile 的 `cordis.patch.yml` 末尾加（推荐，宿主回写 `bundles` 时不会丢）：

    - insert:
        - id: sec-checklist
          name: dsh-sec-checklist

保存后刷新 DSH 页面（Ctrl+F5）。前提：Yakit MCP 已连接（设置 → MCP 连接里能看到 `yakit`），否则清单里的 Yakit 工具调用会失败。

## 数据位置

| 内容 | 路径 |
| --- | --- |
| 配置（项目/账号/清单/技能选择） | `<profile>/sec-checklist.json` |
| 插件日志 | `<profile>/sec-checklist.log` |
| 运行时技能 | 名字 `security-checklist`（不落盘，由插件注册） |

## 安全说明

- 全部数据只保存在本机 profile，插件不发起任何外部请求。
- **测试账号密码默认不写进发给模型的内容**：清单里显示为「在设置页查看/复制」。只有打开「把密码写进清单」后，密码才会进入运行时技能内容与会话上下文（用于需要 AI 登录的场景，请自行评估）。
- 密码在 `sec-checklist.json` 中为明文本地存储；请勿把 profile 目录或该文件提交到公共仓库。
- 插件本身不内置任何真实凭据；内置工具对照只含工具名与示例参数。

## 开发自检

    node test/smoke.mjs        # 配置归一化/密码隐藏/markdown 生成
    node test/host-routes.mjs  # 假 ctx 加载插件：技能注册、state/config/preview/doc/reveal/reset

## License

MIT
