---
name: cloudflare-drop-deploy
description: Cloudflare Drop 全自动部署工具。纯 Node.js 协议实现，零浏览器依赖，含自研 PoW 求解器。当用户要求"部署到 Cloudflare Drop"、"自动部署静态站"、"零配置部署网页"、"临时预览部署"、"快速上线 HTML"、"Drop 部署"、"cloudflare drop deploy"、或需要将本地文件夹通过 API 自动发布到 workers.dev 获取公网 URL 时使用。Keywords: cloudflare, drop, deploy, static site, PoW, workers.dev, 部署, 静态站, API 部署, 自动上线.
metadata:
  repo: https://github.com/Hellohistory/CloudflareDrop_Auto
  version: "1.0"
---

# Cloudflare Drop — 全自动部署

## Mission

将本地静态文件夹通过 Cloudflare Drop API 全自动部署到 `*.workers.dev` 公网 URL，纯 Node.js 实现，含自研 SHA-256 哈希链 PoW 求解器，无需浏览器。

## When to Use

- 用户要求部署一个文件夹/静态网站到公网
- 用户提到"Cloudflare Drop 部署"、"快速上线 HTML"、"临时预览"
- 需要零配置、几秒内获得可访问的 URL
- CI/CD 中需要自动部署预览环境

## When NOT to Use

- 用户要求部署到**自定义域名**（Drop 只支持 `*.workers.dev` 子域）
- 用户需要**永久部署**（Drop 部署约 1 小时后过期，需手动 Claim）
- 项目需要后端逻辑、数据库、API 路由（Workers 脚本模式可写但非本 Skill 覆盖范围）
- 站点文件总大小超过 1MB（Workers 脚本大小限制）
- 用户明确要求使用 Cloudflare Pages 而非 Drop

## Prerequisites

- Node.js >= 18（使用内置 `fetch`, `crypto`, `FormData`）
- 无需 `npm install`，零外部依赖

## Intake Contract

Agent 在触发本 Skill 前需确认以下信息：

```
目标文件夹路径: <绝对路径>
部署入口文件: index.html（默认，如果有其他入口请说明）
用户期望: 获取公网 URL / 仅部署 / 部署并验证
```

如果用户未提供文件夹路径，**必须先询问**，不要假设或推断。

## Workflow

### Phase 0: 前置检查

**Do:**
1. 确认 Node.js 版本 >= 18：`node --version`
2. 确认目标文件夹存在：`Test-Path <folder>`
3. 确认文件夹非空且包含 HTML 文件

**Exit when**: 所有检查通过

### Phase 1: 执行部署

**Do:**
```bash
node <skill-dir>/deploy.js <目标文件夹绝对路径>
```

**输出示例:**
```
[1/5] Reading files...      3 file(s)
[2/5] Solving proof-of-work...  2.1s (2.0M hashes)
[3/5] Provisioning...
[4/5] Deploying...
[5/5] Done!
  Live URL: https://drop-xxx.random-name.workers.dev
```

**Exit when**: 脚本执行完毕，输出 URL

### Phase 2: 验证部署

**Do:**
1. 等待 3-5 秒确保 DNS/Worker 传播
2. 用 `webfetch` 或 `curl` 验证 URL 可访问且返回预期内容
3. 如果返回 404，等待更长时间（最多 30 秒）后重试

**Exit when**: URL 返回 200 且内容匹配

### Phase 3: 交付结果

**Do:**
1. 向用户报告部署成功的 URL
2. 提醒用户部署是临时的（约 1 小时），可通过 Claim URL 认领
3. 如果脚本输出中包含 Claim URL，一并提供给用户

## Guardrails

- **禁止**: 在未确认 Node.js >= 18 的情况下直接运行脚本
- **禁止**: 部署前不检查文件夹是否存在
- **禁止**: 对部署失败不做重试就放弃（网络波动常见）
- **禁止**: 绕过 PoW 求解直接调用 API（PoW 是服务端强制要求的）
- **禁止**: 用 Playwright/浏览器方案替代纯 API 方案——`deploy.js` 是首选

## Anti-Patterns

| 错误做法 | 正确做法 |
|----------|---------|
| 用户没给文件夹路径就开始部署 | 先询问：要部署哪个文件夹？ |
| 部署后不验证就宣称成功 | 等待 3-5 秒后用 webfetch 验证 URL |
| 部署失败后直接放弃 | 检查错误信息：Token 过期→重试，网络错误→等待后重试，脚本错误→检查 Node.js 版本 |
| 告诉用户这是永久部署 | 明确告知：约 1 小时后过期，需 Claim 认领 |

## Output Contract

部署成功后，Agent 必须向用户输出以下信息：

```text
✅ 部署成功

  文件夹:    <source-path> (<n> 个文件)
  访问 URL:  https://drop-xxx.subdomain.workers.dev
  认领 URL:  https://dash.cloudflare.com/claim-preview?claimToken=...
  过期时间:  <ISO 时间戳>

  💡 部署是临时的，约 1 小时后过期。
  点击认领 URL 登录 Cloudflare 账户即可永久保存。
```

## Reference Files

与本 Skill 同目录下的相关文件，按需读取：

| 文件 | 何时读取 |
|------|---------|
| `PRINCIPLE.md` | 用户询问"原理"、"怎么实现"的、"为什么" |
| `deploy.js` | 执行部署时直接运行，无需读取内容 |
| `README.md` | 用户需要了解项目背景和限制 |

## Error Handling

| 错误 | 原因 | 处理 |
|------|------|------|
| `apiToken` 401/403 | PoW 挑战过期（120s 超时） | 脚本自动重新获取挑战并重试 |
| URL 返回 404 | Worker 尚未激活或 DNS 未传播 | 等待 5-10s 后重试 |
| `SyntaxError` in worker | 文件内容含特殊字符 | 检查 HTML 中是否有反引号或 `${}` |
| 文件过大错误 | 超过 1MB 限制 | 提示用户压缩或精简内容 |

## Completion Conditions

部署流程认定为**完成**的条件：

- ✅ `deploy.js` 执行返回 exit code 0
- ✅ 输出了以 `https://` 开头、`.workers.dev` 结尾的 URL
- ✅ webfetch 验证 URL 返回 HTTP 200
- ✅ （可选）返回内容与源文件一致
