# Cloudflare Drop 全自动部署工具

纯 Node.js 实现 Cloudflare Drop 的一键部署，**零浏览器依赖**，包含 PoW (Proof-of-Work) 求解器。

## 🔧 AI Agent 安装

将下面这段话发送给你的 AI Agent，它就会自动完成安装：

```markdown
请从 https://github.com/Hellohistory/CloudflareDrop_Auto/releases 下载最新的 Skill 包，将其注册为本地 Skill，确认 `deploy.js` 可以在 Node.js >= 18 环境下正常运行后，向我讲解这个 Skill 的完整能力。
```

## ⚡ 快速开始

```bash
# 1. 确保 Node.js >= 18
node --version

# 2. 部署一个文件夹
node deploy.js ./my-website
```

## 输出:
```
# [1/5] Reading files...
# [2/5] Solving proof-of-work...  2.1s (2.0M hashes)
# [3/5] Provisioning...
# [4/5] Deploying...
# [5/5] Done!
#
#   Live URL:    https://drop-xxx.random-name.workers.dev
#   Claim URL:   https://dash.cloudflare.com/claim-preview?claimToken=...
#   Expires at:  2026-07-09T06:00:00Z
#
#   Tip: Visit the Claim URL within 1 hour to permanently save
#        this deployment to your Cloudflare account.
```

部署成功后，点击输出的 **Claim URL** 登录 Cloudflare 账户即可永久保存该部署。

## 项目结构

```
CloudflareDrop/
├── deploy.js                   # 纯 API 部署脚本（主脚本）
├── SKILL.md                    # Agent Skill 文件（供 AI Agent 使用）
├── PRINCIPLE.md                # 技术原理详解
├── README.md                   # 本文件
└── .github/workflows/release.yml  # GitHub Release 自动发布
```

## 依赖

- Node.js >= 18（内置 `fetch`, `FormData`, `crypto`）

无需任何 npm 包。

## 官方链接

- [Cloudflare Drop 官方公告](https://developers.cloudflare.com/changelog/post/2026-07-08-cloudflare-drag-and-drop/) — Cloudflare 2026 年 7 月 8 日发布
- [Cloudflare Drop 页面](https://www.cloudflare.com/drop/) — 拖入文件夹或 zip 即可部署

## 限制

- 部署为**临时站点**，约 1 小时后过期
- 通过 Claim URL 可永久认领到 Cloudflare 账户
- 小型站点（所有文件拼接后 < 1MB Workers 脚本限制）
- 仅支持 `*.workers.dev` 子域，无自定义域名

## 适用场景

- 快速分享静态页面预览
- 前端 Demo 临时部署
- CI/CD 中自动部署预览环境
- 逆向分析 Cloudflare Drop 的 PoW 机制

> 技术原理详见 [PRINCIPLE.md](./PRINCIPLE.md)

## 免责声明

本项目为**第三方独立开发**，与 Cloudflare, Inc. 无任何关联、赞助或认可关系。

- 本工具通过逆向工程方式调用 Cloudflare Drop 的公开 API，**不保证接口的持续可用性**。Cloudflare 可能随时修改或关闭相关 API。
- 使用者**自行承担**因使用本工具而导致的任何后果，包括但不限于：API 调用被限流或封禁、部署内容丢失、Cloudflare 账户受到限制。
- 本工具提供的 PoW 求解器仅用于**合法的自动化部署场景**。
- 开发者不承担因使用本工具产生的任何直接或间接责任。

## 防滥用协议

使用本工具即表示你同意以下条款：

**禁止以下行为：**

- ❌ 大规模批量创建部署以对 Cloudflare API 造成压力（DoS/DDoS）
- ❌ 托管恶意内容，包括但不限于：钓鱼页面、恶意软件分发、挖矿脚本
- ❌ 传播垃圾信息、欺诈内容或侵犯他人知识产权的内容
- ❌ 将部署用作垃圾邮件跳转页、SEO 垃圾场或自动化滥用基础设施
- ❌ 任何违反 [Cloudflare 服务条款](https://www.cloudflare.com/terms/) 的行为
- ❌ 绕过 Cloudflare 的速率限制或安全机制进行未授权访问

如发现滥用行为，请在 GitHub Issues 中举报。开发者保留配合 Cloudflare 安全团队调查的权利。

## License

MIT
