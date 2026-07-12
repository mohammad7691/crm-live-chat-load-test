#!/usr/bin/env node
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
const CRM = `https://${process.env.CRM_API_HOST || 'api.crm.swagprinthub.com'}`;
const CHAT = `https://${process.env.VISITOR_API_HOST || 'api.chat.crm.swagprinthub.com'}`;
const SITE = process.env.WIDGET_SITE_ID || '';

async function login() {
  const res = await fetch(`${CRM}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL || process.env.AGENT_EMAIL,
      password: process.env.ADMIN_PASSWORD || process.env.AGENT_PASSWORD,
    }),
  });
  return (await res.json()).accessToken;
}

async function get(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  const token = await login();
  const qs = [
    '',
    '?pageSize=5',
    '?pageSize=5&pageNumber=1',
    '?limit=5',
    '?take=5',
    '?skip=0&take=5',
  ];
  for (const q of qs) {
    const t = await get(token, `${CRM}/api/tickets${q}`);
    console.log('tickets', q || '(none)', t.status, t.body?.message || Object.keys(t.body || {}));
  }
  for (const q of qs) {
    const c = await get(token, `${CRM}/api/conversations${q}`);
    console.log('conversations', q || '(none)', c.status, c.body?.message || Object.keys(c.body || {}));
  }
  const agentRole = (await get(token, `${CRM}/api/roles`)).body.find((r) => r.key === 'AGENT');
  const roleDetail = await get(token, `${CRM}/api/roles/${agentRole.id}`);
  console.log('role detail keys', Object.keys(roleDetail.body || {}));
}

main();
