# Cloudflare Drop 全自动部署工具

纯 Node.js 实现 Cloudflare Drop 的一键部署，**零浏览器依赖**，包含自研的 PoW (Proof-of-Work) 求解器。

## 能力

- 上传本地文件夹 → 自动部署到 Cloudflare Workers
- 自研 SHA-256 哈希链 PoW 求解器（~2s 完成 200 万次哈希）
- 纯 API 调用，无需浏览器、无需 Playwright、无需 Chrome
- 返回可公开访问的 `*.workers.dev` URL

## 快速开始

```bash
# 1. 确保 Node.js >= 18
node --version

# 2. 部署一个文件夹
node deploy.js ./my-website

# 输出:
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

## 项目结构

```
CloudflareDrop/
├── README.md                 # 本文件
├── CLOUDFLARE_DROP_SKILL.md  # Agent Skill 文件（供 AI Agent 使用）
├── PRINCIPLE.md              # 技术原理详解
├── deploy.js                 # 纯 API 部署脚本（主脚本）
└── demos/                    # 演示与测试文件
    ├── auto-deploy.js        # Playwright 备用方案
    ├── cloudflare-drop-demo.html  # Drop UI 演示页面
    ├── deploy.js             # 早期版本
    └── *.js                  # 测试脚本
```

## 依赖

- Node.js >= 18（内置 `fetch`, `FormData`, `crypto`）

无需任何 npm 包。

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

## License

MIT
