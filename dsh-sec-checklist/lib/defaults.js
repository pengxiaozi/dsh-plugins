/**
 * dsh-sec-checklist — 内置清单、推荐技能、Yakit 工具对照与 playbook。
 * 数据与逻辑分离，方便用户/测试直接引用。
 */

export const CATEGORIES = [
  {
    "id": "auth",
    "name": "授权与范围",
    "desc": "开始前确认书面授权、目标范围、时间窗与禁止项"
  },
  {
    "id": "recon",
    "name": "信息收集",
    "desc": "域名/子域/端口/指纹/接口/证书等资产面"
  },
  {
    "id": "vuln",
    "name": "漏洞测试",
    "desc": "按业务面逐类验证，先只读后利用"
  },
  {
    "id": "yakit",
    "name": "Yakit 联动",
    "desc": "MITM / Web Fuzzer / DNSLog / 流量与风险库"
  },
  {
    "id": "evidence",
    "name": "证据与报告",
    "desc": "可复现的请求响应、影响、评级与修复建议"
  },
  {
    "id": "cleanup",
    "name": "清理与恢复",
    "desc": "停止监听、删除测试数据、交接与复盘"
  }
];

export const RECOMMENDED_SKILLS = [
  {
    "name": "hack",
    "why": "安全总入口与作战纪律（影响优先、范围控制）"
  },
  {
    "name": "recon-and-methodology",
    "why": "侦察与测试方法论"
  },
  {
    "name": "attack-surface-mapping",
    "why": "从单个入口画攻击面"
  },
  {
    "name": "recon-for-sec",
    "why": "资产/端点/指纹清点"
  },
  {
    "name": "api-sec",
    "why": "API 测试路由入口"
  },
  {
    "name": "injection-checking",
    "why": "注入类测试路由（SQLi/XSS/SSRF/SSTI/命令注入）"
  },
  {
    "name": "auth-sec",
    "why": "认证/授权/JWT/OAuth 测试路由"
  },
  {
    "name": "file-access-vuln",
    "why": "文件上传/下载/路径穿越"
  },
  {
    "name": "business-logic-vuln",
    "why": "业务逻辑与越权"
  },
  {
    "name": "xss-cross-site-scripting",
    "why": "XSS 各上下文 Payload"
  },
  {
    "name": "sqli-sql-injection",
    "why": "SQL 注入与盲注技术"
  },
  {
    "name": "ssrf-server-side-request-forgery",
    "why": "SSRF 与内网探测"
  },
  {
    "name": "idor-broken-object-authorization",
    "why": "IDOR / 对象级越权"
  },
  {
    "name": "api-auth-and-jwt-abuse",
    "why": "API 认证与 JWT 滥用"
  },
  {
    "name": "waf-bypass-techniques",
    "why": "WAF 拦截时的绕过思路"
  },
  {
    "name": "file-access-vuln",
    "why": "文件访问与上传工作流"
  },
  {
    "name": "ssti-server-side-template-injection",
    "why": "模板注入"
  },
  {
    "name": "cmdi-command-injection",
    "why": "命令注入"
  },
  {
    "name": "request-smuggling",
    "why": "请求走私/反代不一致"
  },
  {
    "name": "race-condition",
    "why": "并发与一次性操作"
  }
];

export const YAKIT_TOOLS = [
  {
    "tool": "mcp__yakit__subdomain_scan",
    "use": "子域名枚举（可递归、泛解析停止）",
    "args": "{ \"target\": \"example.com\", \"not-recursive\": \"no\" }"
  },
  {
    "tool": "mcp__yakit__scan_port",
    "use": "端口 + 服务指纹（TUN 环境自动降级 TCP 连接探测）",
    "args": "{ \"hosts\": \"example.com\", \"ports\": \"80,443,8000-8100\", \"mode\": \"auto\" }"
  },
  {
    "tool": "mcp__yakit__web_fingerprint",
    "use": "Web 指纹识别（含 Shiro 辅助识别）",
    "args": "{ \"url\": \"https://example.com\" }"
  },
  {
    "tool": "mcp__yakit__simple_crawler",
    "use": "静态爬虫，发现服务端可见 URL 与前端请求面",
    "args": "{ \"urls\": \"https://example.com\", \"max-depth\": 3 }"
  },
  {
    "tool": "mcp__yakit__do_http_request",
    "use": "单包/批量 HTTP 测试、重放、IDOR 批量验证",
    "args": "{ \"url\": \"https://example.com/api?id=1\" }"
  },
  {
    "tool": "mcp__yakit__http_fuzzer",
    "use": "按原始请求包 Fuzz（支持 fuzztag 与变量）",
    "args": "{ \"packet\": \"<原始请求包>\", \"isHttps\": true }"
  },
  {
    "tool": "mcp__yakit__start_mitm_v2",
    "use": "启动 MITM 代理抓包（配合证书）",
    "args": "{ \"host\": \"127.0.0.1\", \"port\": 8083 }"
  },
  {
    "tool": "mcp__yakit__download_mitm_cert",
    "use": "下载 MITM 根证书并安装到客户端",
    "args": "{}"
  },
  {
    "tool": "mcp__yakit__set_current_rules",
    "use": "MITM 替换/染色规则（先 get_current_rules 再改）",
    "args": "{ \"rules\": [ ... ] }"
  },
  {
    "tool": "mcp__yakit__query_http_flow",
    "use": "查历史流量（按 URL/关键词/状态码）",
    "args": "{ \"keyword\": \"token\", \"pagination\": { \"limit\": 20, \"order\": \"desc\" } }"
  },
  {
    "tool": "mcp__yakit__require_dnslog_domain",
    "use": "申请 DNSLog 域名做无回显验证",
    "args": "{}"
  },
  {
    "tool": "mcp__yakit__query_dnslog_by_token",
    "use": "查询 DNSLog 命中",
    "args": "{ \"token\": \"<token>\" }"
  },
  {
    "tool": "mcp__yakit__cybersecurity-risk",
    "use": "登记风险（含请求响应证据）",
    "args": "{ \"title\": \"...\", \"target\": \"https://example.com\", \"type\": \"sqli\", \"severity\": \"high\", \"summary\": \"...\" }"
  },
  {
    "tool": "mcp__yakit__query_risks",
    "use": "查询已登记风险",
    "args": "{ \"pagination\": { \"limit\": 20 } }"
  },
  {
    "tool": "mcp__yakit__list_yak_projects",
    "use": "列出 Yakit 项目库，切换项目前先确认",
    "args": "{}"
  },
  {
    "tool": "mcp__yakit__exec_codec",
    "use": "编解码/AES/JWT 等 Codec 流水线",
    "args": "{ \"text\": \"...\", \"workFlow\": [ { \"codecType\": \"Base64Decode\" } ] }"
  }
];

export const BUILTIN_ITEMS = [
  {
    "id": "auth-1",
    "cat": "auth",
    "title": "确认书面授权与测试范围",
    "detail": "只测授权书/邮件中列明的域名、IP、App、账号；越界即停。",
    "skill": "hack",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "auth-2",
    "cat": "auth",
    "title": "确认时间窗与紧急联系人",
    "detail": "约定可测试时段、封禁风险、联系不上时的处理方式。",
    "skill": "",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "auth-3",
    "cat": "auth",
    "title": "确认禁止项",
    "detail": "禁止 DoS/压力测试、社工、物理访问、真实数据下载、越权写入生产库（除非明确允许）。",
    "skill": "hack",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "auth-4",
    "cat": "auth",
    "title": "记录测试账号与环境",
    "detail": "账号、角色、代理、VPN、测试数据准备情况写入安全配置。",
    "skill": "",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "auth-5",
    "cat": "auth",
    "title": "生产数据最小化",
    "detail": "验证用 ID 使用自己创建的测试数据；确需读真实数据时只取最小证明并脱敏。",
    "skill": "",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "recon-1",
    "cat": "recon",
    "title": "子域名与旁站枚举",
    "detail": "先被动（证书/搜索引擎/DNS）后主动爆破；记录来源。",
    "skill": "attack-surface-mapping",
    "yakitTool": "mcp__yakit__subdomain_scan",
    "yakitArgs": "{\"target\":\"example.com\"}",
    "enabled": true
  },
  {
    "id": "recon-2",
    "cat": "recon",
    "title": "端口与服务指纹",
    "detail": "只扫授权范围；关注非标端口、管理后台、数据库暴露。",
    "skill": "recon-and-methodology",
    "yakitTool": "mcp__yakit__scan_port",
    "yakitArgs": "{\"hosts\":\"example.com\",\"ports\":\"80,443,22,3306,6379,8080-8090\",\"mode\":\"auto\"}",
    "enabled": true
  },
  {
    "id": "recon-3",
    "cat": "recon",
    "title": "Web 指纹与中间件版本",
    "detail": "识别框架/CMS/WAF/中间件，关联已知 CVE。",
    "skill": "recon-and-methodology",
    "yakitTool": "mcp__yakit__web_fingerprint",
    "yakitArgs": "{\"url\":\"https://example.com\"}",
    "enabled": true
  },
  {
    "id": "recon-4",
    "cat": "recon",
    "title": "爬虫与接口发现",
    "detail": "抓页面链接与 JS 中的 API；区分前后端路由。",
    "skill": "api-recon-and-docs",
    "yakitTool": "mcp__yakit__simple_crawler",
    "yakitArgs": "{\"urls\":\"https://example.com\",\"max-depth\":3}",
    "enabled": true
  },
  {
    "id": "recon-5",
    "cat": "recon",
    "title": "JS 与源码泄露",
    "detail": "查 sourcemap、.git/.svn、备份文件、Swagger/Actuator。",
    "skill": "insecure-source-code-management",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "recon-6",
    "cat": "recon",
    "title": "证书与 DNS",
    "detail": "看证书 SAN 扩展域名、CNAME 接管风险、TXT 泄露。",
    "skill": "subdomain-takeover",
    "yakitTool": "mcp__yakit__dig",
    "yakitArgs": "{\"domain\":\"example.com\",\"type\":\"*\"}",
    "enabled": true
  },
  {
    "id": "vuln-1",
    "cat": "vuln",
    "title": "未授权访问与默认口令",
    "detail": "管理后台、中间件、调试端点、默认账号。",
    "skill": "authbypass-authentication-flaws",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "vuln-2",
    "cat": "vuln",
    "title": "对象级越权 IDOR",
    "detail": "横向/纵向改 ID、换租户、改资源归属。",
    "skill": "idor-broken-object-authorization",
    "yakitTool": "mcp__yakit__do_http_request",
    "yakitArgs": "{\"url\":\"https://example.com/api/user/1002\"}",
    "enabled": true
  },
  {
    "id": "vuln-3",
    "cat": "vuln",
    "title": "SQL 注入",
    "detail": "参数/排序/搜索/JSON 字段；盲注用时间或布尔。",
    "skill": "sqli-sql-injection",
    "yakitTool": "mcp__yakit__do_http_request",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "vuln-4",
    "cat": "vuln",
    "title": "XSS",
    "detail": "反射/存储/DOM；注意富文本与文件预览。",
    "skill": "xss-cross-site-scripting",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "vuln-5",
    "cat": "vuln",
    "title": "SSRF",
    "detail": "URL 参数、图片抓取、Webhook、导入导出；验证回连。",
    "skill": "ssrf-server-side-request-forgery",
    "yakitTool": "mcp__yakit__require_dnslog_domain",
    "yakitArgs": "{}",
    "enabled": true
  },
  {
    "id": "vuln-6",
    "cat": "vuln",
    "title": "文件上传与路径穿越",
    "detail": "后缀/内容/MIME 绕过，上传目录解析，下载接口穿越。",
    "skill": "file-access-vuln",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "vuln-7",
    "cat": "vuln",
    "title": "命令/模板注入",
    "detail": "系统命令拼接、模板渲染、表达式语言。",
    "skill": "cmdi-command-injection",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "vuln-8",
    "cat": "vuln",
    "title": "认证与会话",
    "detail": "JWT 算法/签名/过期、OAuth 回调、会话固定、密码重置。",
    "skill": "api-auth-and-jwt-abuse",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "vuln-9",
    "cat": "vuln",
    "title": "业务逻辑与并发",
    "detail": "价格/优惠券/库存/审批流；重复提交与条件竞争。",
    "skill": "business-logic-vulnerabilities",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "vuln-10",
    "cat": "vuln",
    "title": "反序列化与组件漏洞",
    "detail": "Java/PHP/Python 反序列化、Log4j、Fastjson 等已知组件。",
    "skill": "deserialization-insecure",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "vuln-11",
    "cat": "vuln",
    "title": "CORS/CSRF/点击劫持",
    "detail": "跨域读取、CSRF token 缺失、frame 限制。",
    "skill": "cors-cross-origin-misconfiguration",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "vuln-12",
    "cat": "vuln",
    "title": "敏感信息泄露",
    "detail": "报错栈、调试页、配置/密钥、内网地址、日志接口。",
    "skill": "insecure-source-code-management",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "yakit-1",
    "cat": "yakit",
    "title": "启动 MITM 并安装证书",
    "detail": "只代理测试环境；先设置 filter 只抓目标域。",
    "skill": "mitm-hotpatch",
    "yakitTool": "mcp__yakit__start_mitm_v2",
    "yakitArgs": "{\"host\":\"127.0.0.1\",\"port\":8083}",
    "enabled": true
  },
  {
    "id": "yakit-2",
    "cat": "yakit",
    "title": "配置 MITM 过滤与替换规则",
    "detail": "按域名/MIME 过滤，避免无关流量；替换规则用于签名/脱敏。",
    "skill": "",
    "yakitTool": "mcp__yakit__set_mitm_filter",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "yakit-3",
    "cat": "yakit",
    "title": "Web Fuzzer 重放与批量",
    "detail": "优先用历史流量构造包；批量测试注意限速。",
    "skill": "",
    "yakitTool": "mcp__yakit__http_fuzzer",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "yakit-4",
    "cat": "yakit",
    "title": "DNSLog/反连验证",
    "detail": "无回显 SSRF/命令注入用 DNSLog 或随机端口。",
    "skill": "",
    "yakitTool": "mcp__yakit__require_dnslog_domain",
    "yakitArgs": "{}",
    "enabled": true
  },
  {
    "id": "yakit-5",
    "cat": "yakit",
    "title": "风险登记到 Yakit 项目库",
    "detail": "每条风险带请求/响应、复现步骤、影响与修复建议。",
    "skill": "",
    "yakitTool": "mcp__yakit__cybersecurity-risk",
    "yakitArgs": "{ \"title\": \"...\", \"target\": \"...\", \"type\": \"sqli\", \"severity\": \"high\", \"summary\": \"...\" }",
    "enabled": true
  },
  {
    "id": "yakit-6",
    "cat": "yakit",
    "title": "项目切换前确认",
    "detail": "避免把不同项目流量写进同一库。",
    "skill": "",
    "yakitTool": "mcp__yakit__list_yak_projects",
    "yakitArgs": "{}",
    "enabled": true
  },
  {
    "id": "evidence-1",
    "cat": "evidence",
    "title": "保留原始请求响应",
    "detail": "完整报文、时间、账号、IP；截图仅作补充。",
    "skill": "",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "evidence-2",
    "cat": "evidence",
    "title": "写清复现步骤",
    "detail": "最少步骤 + 预期结果 + 实际结果，别人可照做。",
    "skill": "",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "evidence-3",
    "cat": "evidence",
    "title": "评级与修复建议",
    "detail": "按 CVSS/业务影响定级，给可落地的修复与验证方法。",
    "skill": "",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "evidence-4",
    "cat": "evidence",
    "title": "报告脱敏",
    "detail": "隐去真实用户数据、密钥、内网地址中的敏感部分。",
    "skill": "",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "cleanup-1",
    "cat": "cleanup",
    "title": "停止监听与扫描",
    "detail": "关闭 MITM/端口扫描/爬虫，撤销代理设置。",
    "skill": "",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "cleanup-2",
    "cat": "cleanup",
    "title": "清理测试数据",
    "detail": "删除上传文件、测试账号、创建的记录；恢复被改配置。",
    "skill": "",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  },
  {
    "id": "cleanup-3",
    "cat": "cleanup",
    "title": "交接与复盘",
    "detail": "与客户确认已关闭风险点，记录后续复测项。",
    "skill": "",
    "yakitTool": "",
    "yakitArgs": "",
    "enabled": true
  }
];

export const PLAYBOOK = "# 安全渗透测试 Playbook\n\n> 只用于获得书面授权的测试。开始前把「安全配置」里的项目、授权、范围、账号填好；AI 会按本清单和固定配置执行。\n\n## 0. 使用方式\n\n1. 设置 → 安全清单：填项目/授权/范围/测试账号，勾选本阶段要用的渗透技能（hack、api-sec、sqli 等）。\n2. 保存后，插件会把清单注册为运行时技能 `security-checklist`；让 AI「加载 security-checklist 并按清单测试」。\n3. AI 按分类逐项执行，命中后把证据与风险登记到 Yakit，最终产出报告。\n\n## 1. 授权与边界（先做）\n\n- 书面授权、目标清单、时间窗、禁止项、紧急联系人必须齐全。\n- 只测清单内资产；测试账号与生产数据分离；不下载真实数据。\n- 破坏性验证（写入/删除/DoS）一律先取得明确同意。\n\n## 2. 信息收集\n\n- 被动优先：证书透明、搜索引擎、DNS、公开代码仓库。\n- 主动枚举限速：子域、端口、指纹、目录、API、JS。\n- 产出资产清单：域名/IP/端口/框架/接口/账号角色。\n\n## 3. 漏洞测试\n\n- 先验证「能不能进」：未授权、越权、默认口令。\n- 再验证「能不能打」：注入、上传、SSRF、反序列化、模板。\n- 最后验证「业务能不能骗」：逻辑、并发、支付、审批。\n- 每个结论要有可复现的请求响应；不确定的标记为待确认。\n\n## 4. Yakit 操作要点\n\n- MITM：先 filter 后抓包；证书装到被测客户端；测试完立刻停。\n- Web Fuzzer：优先从 History 选包重放；批量测试注意并发与限速。\n- DNSLog：无回显漏洞先申请域名，再构造外带请求。\n- 风险库：每条风险带完整请求响应与修复建议，便于导出报告。\n\n## 5. 证据与报告\n\n- 请求/响应原文 + 复现步骤 + 影响说明 + 评级 + 修复建议。\n- 报告里对真实数据脱敏；附上测试范围与时间。\n\n## 6. 清理与恢复\n\n- 停止所有监听与扫描任务；删除测试数据与账号；恢复配置。\n- 与客户确认风险点已关闭，记录复测项。\n\n## 7. 常见坑\n\n- 只测了登录页就下结论：先画清业务面与接口。\n- 越权只看响应码：要看数据是否真的越权返回。\n- WAF 拦截就放弃：换编码/换位置/换协议继续验证。\n- 忘记录证据：事后无法复现等于没发现。\n";
