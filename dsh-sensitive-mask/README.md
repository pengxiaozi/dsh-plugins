# dsh-sensitive-mask · 脱敏显示（全局）

给 DeepSeek Harness 加一层全局「脱敏网关」：**发往模型的用户输入与工具结果先按规则做脱敏显示**，
AI 全程看不到原文；只有「占位符」样式会在**本地工具执行前**还原真实值，保证命令、文件写入拿到的仍是正确内容。

> 适合：手机号 / 身份证号 / 银行卡号 / 邮箱等不该发给云端模型的字段；规则支持正则与字面量，命中可审计。

## 功能

- **入站脱敏（AI 读）**
  - 用户输入：在写入会话前脱敏（`agent/pre-step`）。
  - 工具结果：在进入模型历史前脱敏（`tools/post-execute`）。
- **出站还原（AI 写）**
  - 仅「占位符」样式会在工具执行前把参数里的占位符还原（`tools/pre-execute`）；
    会话历史仍只保存脱敏后的内容，真实值只在本地执行瞬间出现。
- **三种脱敏样式（全局默认 + 每条规则可覆盖）**
  - `placeholder` 占位符：`[[手机号#1]]`（**可还原**）
  - `partial` 部分隐藏：`138****8000`（保留头/尾位数可配，**不可还原**）
  - `fixed` 固定文本：用规则里的「固定文本」，如 `***`（**不可还原**）
- **规则**：正则（JS 正则语法）或字面量；可单独启停；内置预设：手机号、身份证号、银行卡号、邮箱。
- **日志**：按天写入本地 JSONL（`<profile>/sensitive-mask/logs/mask-YYYY-MM-DD.jsonl`），
  每条记录包含规则、脱敏结果、样式、命中长度、SHA-256 前 12 位、方向、工具名、文件路径、会话 ID。
  默认不记录原文；可在设置里打开 `logOriginals`。
- **设置页**：设置 → 脱敏显示：总开关、拦截范围、默认样式、规则表（样式/头/尾）、在线测试、日志查看、打开日志目录。

## 安装（本地目录链接）

```powershell
# 1) 把本目录放到任意位置，然后在 profile 里 link
cd <DSH_HOME>/profiles/desktop
pnpm add link:D:/path/to/dsh-sensitive-mask
```

2) 把包名加进该 profile `package.json` 的 `dsh.profile.bundles`：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["...", "dsh-sensitive-mask"]
    }
  }
}
```

3) 触发一次 profile 重载（改一下 `cordis.patch.yml` 再保存），刷新页面即可在设置里看到入口。

## 配置与数据位置

| 内容 | 路径 |
| --- | --- |
| 规则配置 | `<profile>/sensitive-mask.json` |
| 命中日志 | `<profile>/sensitive-mask/logs/mask-YYYY-MM-DD.jsonl` |
| 占位符映射 | 进程内存（重启即清空，不上盘） |

```json
{
  "enabled": true,
  "maskUserInput": true,
  "maskToolResults": true,
  "demaskModelOutput": true,
  "maskStyle": "placeholder",
  "logOriginals": false,
  "rules": [
    {
      "id": "preset-phone",
      "name": "手机号",
      "type": "regex",
      "pattern": "(?<!\\d)1[3-9]\\d{9}(?!\\d)",
      "replacement": "手机号",
      "flags": "g",
      "style": "inherit",
      "keepHead": 3,
      "keepTail": 4,
      "enabled": true
    }
  ]
}
```

- `maskStyle`：全局默认样式（`placeholder` / `partial` / `fixed`）。
- `style`：规则级覆盖，`inherit` 表示跟随全局。
- `keepHead` / `keepTail`：`partial` 样式保留的头/尾字符数（0–12）；值太短时整体打码。
- 占位符格式：`[[<replacement>#<序号>]]`，例如 `[[手机号#1]]`；同一规则下相同原文复用同一占位符。
- 旧配置没有 `maskStyle` / `style` / `keepHead` / `keepTail` 时自动补默认值（占位符、3/4）。

## 设计说明与坑

- **会话历史里只保存脱敏后的内容**，所以本地会话日志/回放看到的是 `[[手机号#1]]` 或 `138****8000`；
  原文只存在内存映射里（这是刻意的）。
- **不要改写 `ctx.llm.prepareCall()` 返回的对象**：DSH 的 `PreparedLlmCall` 是 `Object.freeze` 的，
  给 `.stream` 赋值会抛 `Cannot assign to read only property 'stream'`，导致所有模型请求失败。
  同理，工具执行参数由 registry 深冻结，不能直接改写；还原必须放在 `tools/pre-execute` 并判断 `Object.isFrozen`。
- 本 harness 的实际调用链里 `llm/stream` 钩子不命中模型输出流，不要依赖它做还原。
- 占位符映射在内存中，**重启 DSH 后旧的 `[[...]]` 无法还原**（历史消息里会保留占位符，原样发给模型）。
- `partial` / `fixed` 不可还原：AI 若把它们写回文件/命令，写进去的就是脱敏后的值。

## 开发自检

```bash
node test/smoke.mjs        # 掩码/还原/三种样式/边界
node test/host-routes.mjs  # 假 ctx 加载插件：钩子、路由、日志
```

## License

MIT
