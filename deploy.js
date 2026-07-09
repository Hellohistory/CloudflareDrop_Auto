/**
 * Cloudflare Drop — 纯协议全自动部署 (Node.js, 零浏览器依赖)
 *
 * 用法: node deploy.js <文件夹路径>
 * 示例: node deploy.js ./my-site
 *
 * PoW 算法: SHA-256 哈希链，k+1 个检查点，每个间隔 g 次 SHA-256
 *   checkpoint[0] = SHA256(base64url_decode(seed))
 *   checkpoint[i+1] = SHA256^g(checkpoint[i])
 *   总计: k*g ≈ 200万次 SHA-256, Node.js 单线程约 2.5s
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const sha256 = (d) => crypto.createHash('sha256').update(d).digest();

async function deploy(sourceDir) {
  // ── 1. Package files ──
  console.log('[1/5] Reading files...');
  const files = [];
  function walk(dir, prefix) {
    for (const e of fs.readdirSync(dir)) {
      const fp = path.join(dir, e), rp = prefix ? `${prefix}/${e}` : e;
      fs.statSync(fp).isDirectory() ? walk(fp, rp) : files.push({ name: rp, data: fs.readFileSync(fp) });
    }
  }
  walk(sourceDir, '');
  console.log(`       ${files.length} file(s)`);

  // ── 2. PoW Challenge ──
  console.log('[2/5] Solving proof-of-work...');
  const ch = await fetch('https://api.cloudflare.com/client/v4/provisioning/previews/challenge', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  }).then(r => r.json());
  const { challengeToken, seed, k, g } = ch.result;

  const t0 = Date.now();
  let state = sha256(Buffer.from(seed.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
  const cps = new Array(k + 1); cps[0] = state;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < g; j++) state = sha256(state);
    cps[i + 1] = state;
  }
  const checkpoints = Buffer.concat(cps).toString('base64');
  console.log(`       ${((Date.now()-t0)/1000).toFixed(1)}s (${((k+1)*g/1e6).toFixed(1)}M hashes)`);

  // ── 3. Provision ──
  console.log('[3/5] Provisioning...');
  const prov = await (await fetch('https://api.cloudflare.com/client/v4/provisioning/previews', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client: 'web', source: 'drop',
      termsOfService: 'https://www.cloudflare.com/terms/',
      privacyPolicy: 'https://www.cloudflare.com/privacypolicy/',
      acceptTermsOfService: 'yes',
      challengeToken, solution: { checkpoints },
    }),
  })).json();
  const { account, claim } = prov.result;
  const scriptName = `drop-${crypto.randomUUID()}`;
  const token = account.apiToken;

  // ── 4. Deploy Worker ──
  console.log('[4/5] Deploying...');
  const html = files.map(f => f.data.toString('utf-8')).join('\n');
  const escaped = html.replace(/`/g, '\\`').replace(/\$/g, '\\$');
  const script = `addEventListener('fetch', e => e.respondWith(new Response(\`${escaped}\`,{headers:{'content-type':'text/html'}})))`;

  await fetch(`https://www.cloudflare.com/accounts/${account.id}/workers/scripts/${scriptName}`, {
    method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/javascript' }, body: script,
  });
  await fetch(`https://www.cloudflare.com/accounts/${account.id}/workers/scripts/${scriptName}/subdomain`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{"enabled":true}',
  });
  const sub = await (await fetch(`https://www.cloudflare.com/accounts/${account.id}/workers/subdomain`, {
    headers: { authorization: `Bearer ${token}` },
  })).json();

  const url = `https://${scriptName}.${sub.result.subdomain}.workers.dev`;

  // ── 5. Done ──
  console.log('[5/5] Done!');
  console.log(`\n  Live URL:    ${url}`);
  console.log(`  Claim URL:   ${claim.url}`);
  console.log(`  Expires at:  ${claim.expiresAt}`);
  console.log(`  \n  Tip: Visit the Claim URL within 1 hour to permanently save\n        this deployment to your Cloudflare account.\n`);
  return { url, claimUrl: claim.url, expiresAt: claim.expiresAt };
}

const src = process.argv[2];
if (!src) { console.error('Usage: node deploy.js <folder>'); process.exit(1); }
deploy(path.resolve(src)).catch(e => { console.error('Failed:', e.message); process.exit(1); });
