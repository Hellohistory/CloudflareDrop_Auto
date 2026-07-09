# Cloudflare Drop 技术原理

## 1. 产品定位

Cloudflare Drop (`cloudflare.com/drop/`) 是一个**零配置静态站点部署工具**。
拖入文件夹或 zip，自动部署到 Cloudflare 全球边缘网络，几秒内获得可访问 URL。

### 用户视角的体验

```
拖入文件夹  →  接受条款  →  上传  →  分发到边缘节点  →  获得 URL
```

### 底层架构

Cloudflare Drop 使用 **Workers**（不是 Pages）作为运行时：

```
Drop UI (React SPA)
    │
    ├── PoW Worker (SHA-256 哈希链求解)
    │
    ├── Provisioning API (/client/v4/provisioning/previews/*)
    │      │
    │      ├── 创建临时账户
    │      ├── 分配 API Token
    │      └── 生成 Claim Token
    │
    └── Workers API (/accounts/{id}/workers/*)
           │
           ├── Upload Session → Assets Upload
           ├── PUT Worker Script (部署)
           └── Subdomain Assignment (分配域名)
```

**与 Pages 的关键区别**：
- Pages: 需要 Git 仓库、构建步骤、项目配置
- Drop: 直接上传文件，零配置，但部署是临时的（~1h）

---

## 2. 前端的 PoW 保护机制

### 2.1 为什么需要 PoW

Cloudflare Drop 允许任意用户创建临时 Workers 部署。如果没有保护机制，攻击者可以：
- 大规模创建部署消耗资源
- 用 Workers 做代理/挖矿等滥用
- 批量注册 Worker 子域

传统方案是 CAPTCHA（如 Turnstile），但 Drop 选择了**计算型 PoW**——让客户端投入 CPU 时间来证明"诚意"。

### 2.2 算法选择: 时间锁定谜题 (Time-Lock Puzzle)

**核心思想**：构造一个可以通过**串行哈希迭代**求解但**无法并行加速**的问题。

```javascript
// 伪代码
function solveChallenge(seed, k, g) {
    let state = SHA256(base64urlDecode(seed))
    const checkpoints = [state]

    for (let i = 0; i < k; i++) {
        for (let j = 0; j < g; j++) {
            state = SHA256(state)  // 必须串行：每次哈希依赖上一次结果
        }
        checkpoints.push(state)
    }

    return Buffer.concat(checkpoints).toString('base64')
}
```

**参数**:
- `seed`: 服务端随机生成，确保每次挑战不同
- `k = 1000`: 检查点数量
- `g = 2000`: 每个检查点的哈希迭代次数
- `s = 16`: 预留参数（当前未使用）

**总量**: `(k + 1) × g = 2,002,000` 次 SHA-256

### 2.3 为什么用检查点链而不是单次哈希

| 方案 | 客户端计算 | 服务端验证 | 问题 |
|------|-----------|-----------|------|
| 单次 Hash | 1 次 | 1 次 | 难度太低 |
| 重复 Hash N 次 | N 次 | N 次 | 服务端也要算 N 次，压力大 |
| 检查点链 | k×g 次 | 最多 k 次（分段验证） | ✅ 平衡 |

**检查点链的优势**：
1. **分段验证**: 服务端不必等客户端算完，每收到一段就能验证一段
2. **进度可追踪**: 客户端可以报告进度（每 16 个检查点）
3. **难以伪造**: 没有 seed 就无法生成正确的链，且链是确定性的

### 2.4 为什么不能并行加速

SHA-256 哈希链天然串行：
```
seed → H → H → ... → H → [CP0] → H → H → ... → H → [CP1] → ...
         ← g 次 →              ← g 次 →
```

每次哈希的输入是上一次的输出，无法预知中间值，因此：
- GPU 并行无效（每个哈希依赖前一个）
- 多线程无效（无法分片）
- 纯 CPU 单线程瓶颈

### 2.5 检查点数据量

| 项目 | 值 |
|------|---|
| 检查点数 | k + 1 = 1001 |
| 每个检查点 | SHA-256 输出 = 32 字节 |
| 原始数据 | 32,032 字节 |
| Base64 编码 | ~42,712 字符 |
| HTTP 传输 | ~43 KB |

---

## 3. API 流程详解

### 3.1 Step 1: 获取挑战

```
POST https://api.cloudflare.com/client/v4/provisioning/previews/challenge
Content-Type: application/json
Body: {}
```

**响应**:
```json
{
  "success": true,
  "result": {
    "challengeToken": "eyJ2IjoxLCJjaWQiOi...",   // JWT
    "seed": "2buc-53JobaJi0Vt1f8fbaxQ-pjay-...",  // base64url
    "k": 1000,
    "g": 2000,
    "s": 16,
    "expiresAt": 1783570814
  }
}
```

`challengeToken` 的 JWT payload:
```json
{
  "v": 1,
  "cid": "Wm5qoIQ7wpcHDyHVe708xg",    // challenge ID
  "seed": "2buc-53JobaJi0Vt1f8fba...",   // 种子（与外部 seed 字段相同）
  "g": 2000,
  "s": 16,
  "k": 1000,
  "iat": 1783569800,                     // 签发时间
  "exp": 1783569920                      // 过期时间（120s）
}
```

挑战有 120 秒有效期，超时需重新获取。

### 3.2 Step 3: 提交解决方案

```
POST https://api.cloudflare.com/client/v4/provisioning/previews
Content-Type: application/json

{
  "client": "web",
  "source": "drop",
  "termsOfService": "https://www.cloudflare.com/terms/",
  "privacyPolicy": "https://www.cloudflare.com/privacypolicy/",
  "acceptTermsOfService": "yes",
  "challengeToken": "eyJ2IjoxLCJjaWQiOi...",
  "solution": {
    "checkpoints": "wrkf85I2T4AlizShQAK2y+5jW4..."
  }
}
```

**响应**:
```json
{
  "success": true,
  "result": {
    "account": {
      "id": "d3401dc61c46be1d26848c7bcaa96496",
      "name": "Reinvented Odometer",
      "type": "standard",
      "apiToken": "cfat_zkl4fG7PEg10mn4tJDbq...",    // Workers API Token
      "tokenId": "428d8cd009406b537bc84541a127eb80",
      "expiresAt": "2026-07-09T05:03:25Z"
    },
    "claim": {
      "token": "fi28vCro3afidmnQrq8ggH...",           // 永久认领 Token
      "url": "https://dash.cloudflare.com/claim-preview?claimToken=...",
      "expiresAt": "2026-07-09T05:03:25Z"
    }
  }
}
```

**安全设计**:
- 每次部署创建一个**全新的临时账户**，与其他部署隔离
- 账户名随机生成（如 "Reinvented Odometer"）
- `apiToken` (`cfat_*`) 仅能操作该账户下的资源
- `claimToken` 允许用户登录后认领到自己的 Cloudflare 账户永久保留

### 3.3 Step 4: 文件上传

有两种上传路径：

#### 路径 A: Workers Assets 系统（浏览器使用）

```
1. POST .../assets-upload-session → 获取 cfwau_ JWT (Ed25519)
2. POST .../assets/upload?base64=true → 上传单个文件
3. POST .../scripts/{name}/assets?base64=true → 创建资产清单
```

此路径依赖 Ed25519 签名的 JWT。纯 API 调用时，服务端返回 HS256 JWT（aud: "ewc"），导致上传端点返回 401。

**原因**：Drop 服务的 `assets-upload-session` 端点根据请求来源分配不同 JWT 类型：
- 浏览器请求 → Ed25519 JWT（完整权限）
- API 请求 → HS256 JWT（受限，aud: "ewc"）

#### 路径 B: Worker 内联（API 使用）

将文件内容直接嵌入 Worker 脚本：

```javascript
const html = files.map(f => f.data.toString('utf-8')).join('\n')

const script = `
addEventListener('fetch', e => e.respondWith(
  new Response(\`${escapedHtml}\`, {
    headers: { 'content-type': 'text/html' }
  })
))
`

// PUT to Workers API
fetch(`/accounts/${id}/workers/scripts/${name}`, {
  method: 'PUT',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/javascript'
  },
  body: script
})
```

**限制**: Workers 脚本有 1MB 大小限制，因此适合小型站点。

### 3.4 Step 5-6: 部署与域名

```
PUT  /accounts/{id}/workers/scripts/{name}  → 上传 Worker 代码
POST /accounts/{id}/workers/scripts/{name}/subdomain  → 启用子域路由
     Body: {"enabled": true}
GET  /accounts/{id}/workers/subdomain  → 获取子域名
```

**关键细节**: subdomain POST 的 body **必须是** `{"enabled": true}`，否则 Worker 不会被路由到。

---

## 4. 前端实现分析

### 4.1 技术栈

- **React 19** + Vite 打包
- **Tailwind CSS v4.3** (编译后的原子 CSS)
- **Framer Motion** (动画)
- Canvas 粒子动画 (Drop Zone 背景)
- Web Worker (PoW 计算)

### 4.2 组件状态机

```
IDLE → PROVISION → UPLOAD → DISTRIBUTE → LIVE
                                           ├── ERROR
                                           └── EXPIRED
```

### 4.3 关键 JS 文件

| 文件 | 用途 |
|------|------|
| `index-D79nefMC.js` | 主 React Bundle (~597KB) |
| `pow.worker-N4KzScng.js` | PoW Web Worker |
| `UploadStage-Chaz4kJE.js` | 上传阶段组件 (lazy) |
| `DistributeStage-D4DtirJU.js` | 分发阶段组件 (lazy) |
| `LiveStage-baq-jDZ6.js` | 上线阶段组件 (lazy) |

---

## 5. 安全机制总结

```
┌─────────────────────────────────────────────────────┐
│                    防护层次                          │
├─────────────────────────────────────────────────────┤
│ Layer 1: PoW 门槛                                   │
│   200 万次 SHA-256 (~2s) → 提高滥用成本             │
├─────────────────────────────────────────────────────┤
│ Layer 2: 临时账户隔离                                │
│   每次部署独立账户 → 账户间无法互相影响              │
├─────────────────────────────────────────────────────┤
│ Layer 3: 时间限制                                    │
│   Challenge: 120s | 账户: ~1h | 自动回收             │
├─────────────────────────────────────────────────────┤
│ Layer 4: 检查点链验证                                │
│   服务端验证检查点链完整性 → 防止伪造                │
└─────────────────────────────────────────────────────┘
```

---

## 6. 逆向工程要点

### 6.1 PoW 算法发现过程

1. **网络抓包**: 观察 Deployment 的 6 个 API 调用
2. **Console 插桩**: 在浏览器中 hook `fetch` 捕获 challenge/solution 数据
3. **动态脚本发现**: 通过 `performance.getEntriesByType('resource')` 发现 `pow.worker-N4KzScng.js`
4. **Worker 源码提取**: fetch Worker 文件获取完整算法
5. **验证**: 用 Node.js 重现，对比真实部署的 checkpoints 数据验证正确性

### 6.2 关键发现

- Drop **没有使用 Turnstile**（Cloudflare 自己的 CAPTCHA 产品）
- PoW 算法是**纯 JavaScript** 而非 WebAssembly
- 检查点链被设计为**可分段验证**
- `s=16` 参数在当前版本中**未参与计算**（可能是预留或废弃参数）
- `cfat_` Token 直接可用，但 `cfwau_` Assets JWT 需要 Ed25519 签名（浏览器专属）

### 6.3 bytes32 检查点验证

```javascript
// 验证: 已知 seed 和所有检查点，快速验证任意一段
function verifySegment(prevCheckpoint, nextCheckpoint, g) {
  let state = prevCheckpoint
  for (let i = 0; i < g; i++) {
    state = SHA256(state)
  }
  return state.equals(nextCheckpoint)  // 应为 true
}
```

服务端可以在收到客户端发来的所有检查点后，分段验证，而不必重算整条链。
