#!/usr/bin/env node
/**
 * Discover CRM API routes for in-scope modules (status codes only in stdout).
 * Full response shapes saved locally to exploration/api-discovery.json (gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '..', '.env');

function loadEnv() {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const API = process.env.CRM_API_HOST
  ? `https://${process.env.CRM_API_HOST}`
  : 'https://api.crm.swagprinthub.com';

const endpoints = [
  '/api/users',
  '/api/users/me',
  '/api/teams',
  '/api/roles',
  '/api/permissions',
  '/api/tickets',
  '/api/conversations',
  '/api/chat/sessions',
  '/api/ticket-distribution',
  '/api/distribution-rules',
  '/api/distribution',
  '/api/settings/ticket-distribution',
  '/api/settings/distribution',
  '/api/admin/users',
  '/api/admin/teams',
  '/api/admin/roles',
  '/api/v1/users',
  '/api/v1/teams',
  '/api/v1/roles',
  '/api/v1/tickets',
  '/api/v1/conversations',
];

async function main() {
  const email = process.env.ADMIN_EMAIL || process.env.AGENT_EMAIL;
  const password = process.env.ADMIN_PASSWORD || process.env.AGENT_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL/ADMIN_PASSWORD or AGENT_EMAIL/AGENT_PASSWORD in .env');
    process.exit(1);
  }

  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok || !loginBody.accessToken) {
    console.error('Login failed:', loginRes.status);
    process.exit(1);
  }
  const token = loginBody.accessToken;

  const out = { api: API, loginStatus: loginRes.status, me: null, endpoints: {} };
  const meRes = await fetch(`${API}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  out.me = { status: meRes.status, keys: Object.keys((await meRes.json().catch(() => ({}))) || {}) };

  for (const ep of endpoints) {
    const res = await fetch(`${API}${ep}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    const shape =
      body && typeof body === 'object'
        ? Array.isArray(body)
          ? { type: 'array', length: body.length, itemKeys: body[0] ? Object.keys(body[0]) : [] }
          : { type: 'object', keys: Object.keys(body) }
        : { type: typeof body };
    out.endpoints[ep] = { status: res.status, shape };
    console.log(`${ep} -> ${res.status} (${shape.type}${shape.length != null ? ` len=${shape.length}` : ''})`);
  }

  const outDir = path.join(root, 'exploration');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'api-discovery.json'), JSON.stringify(out, null, 2));
  console.log('\nSaved:', path.join(outDir, 'api-discovery.json'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
