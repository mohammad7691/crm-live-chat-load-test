#!/usr/bin/env node
/** Deep API shape discovery — writes to exploration/ (gitignored). */
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
  const body = await res.json();
  if (!body.accessToken) throw new Error(`Login failed ${res.status}`);
  return body.accessToken;
}

async function get(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text.slice(0, 300); }
  return { status: res.status, body };
}

function sample(obj, depth = 0) {
  if (depth > 2) return '...';
  if (Array.isArray(obj)) return obj.slice(0, 1).map((x) => sample(x, depth + 1));
  if (obj && typeof obj === 'object') {
    const o = {};
    for (const k of Object.keys(obj).slice(0, 20)) o[k] = sample(obj[k], depth + 1);
    return o;
  }
  return obj;
}

async function main() {
  const token = await login();
  const out = {};

  const users = await get(token, `${CRM}/api/users`);
  out.users = { status: users.status, sample: sample(users.body) };

  const teams = await get(token, `${CRM}/api/teams`);
  out.teams = { status: teams.status, sample: sample(teams.body) };

  const roles = await get(token, `${CRM}/api/roles`);
  out.roles = { status: roles.status, sample: sample(roles.body) };

  const perms = await get(token, `${CRM}/api/permissions`);
  out.permissions = { status: perms.status, sample: sample(perms.body) };

  const tickets = await get(token, `${CRM}/api/tickets?page=1&limit=5`);
  out.tickets = { status: tickets.status, sample: sample(tickets.body) };

  const convs = await get(token, `${CRM}/api/conversations?page=1&limit=5`);
  out.conversations = { status: convs.status, sample: sample(convs.body) };

  const dist = await get(token, `${CRM}/api/distribution-rules`);
  out.distributionRules = { status: dist.status, sample: sample(dist.body) };

  const chatSessions = await get(
    token,
    `${CHAT}/api/chat/sessions?siteId=${SITE}&status=OPEN&assignment=pending&limit=3`
  );
  out.liveChatSessions = { status: chatSessions.status, sample: sample(chatSessions.body) };

  const authMe = await get(token, `${CRM}/api/auth/me`);
  out.authMe = { status: authMe.status, sample: sample(authMe.body) };

  const profile = await get(token, `${CRM}/api/profile`);
  out.profile = { status: profile.status, sample: sample(profile.body) };

  const outDir = path.join(root, 'exploration');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'api-shapes.json'), JSON.stringify(out, null, 2));
  console.log('Wrote exploration/api-shapes.json');
  for (const [k, v] of Object.entries(out)) console.log(k, v.status);
}

main().catch((e) => { console.error(e); process.exit(1); });
