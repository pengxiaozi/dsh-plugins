# Security Policy

## 数据与隐私

这两个插件完全在本机运行：

- 不包含遥测、不发起外部网络请求、不上传任何文件或配置；
- MCP 面板会把 MCP 服务器配置写入 DSH profile 的 `cordis.patch.yml`。若在 `headers` 中填写了 `Authorization` 等令牌，该令牌会以明文保存在**本机 profile** 中；
- Skills 面板只读本地 skill 文件，ZIP 在内存中生成并直接下载；
- 插件不接受任意用户路径作为文件读取/导出目标。

## 报告问题

如果你发现安全问题，请通过 GitHub Issue（避免粘贴真实令牌）或仓库主页联系方式告知。
