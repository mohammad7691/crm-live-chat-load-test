#!/usr/bin/env node
/** Probe user/team/role CRUD endpoints (OPTIONS + sample POST). */
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
  return body.accessToken;
}

async function req(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = text;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { status: res.status, body: parsed };
}

async function main() {
  const token = await login();
  const roles = (await req(token, 'GET', `${CRM}/api/roles`)).body;
  const teams = (await req(token, 'GET', `${CRM}/api/teams`)).body;
  const agentRole = roles.find((r) => /agent/i.test(r.key || r.name)) || roles[0];
  const team = teams[0];

  const stamp = Date.now();
  const candidates = [
    {
      label: 'create-user-post',
      method: 'POST',
      url: `${CRM}/api/users`,
      body: {
        email: `qa-auto-agent-${stamp}@test.local`,
        fullName: `QA Auto Agent ${stamp}`,
        password: 'QaTest2026!A',
        roleKey: agentRole?.key,
        teamId: team?.id,
        isActive: true,
      },
    },
    {
      label: 'create-user-invite',
      method: 'POST',
      url: `${CRM}/api/users/invite`,
      body: {
        email: `qa-auto-invite-${stamp}@test.local`,
        fullName: `QA Auto Invite ${stamp}`,
        roleKey: agentRole?.key,
        teamId: team?.id,
      },
    },
  ];

  const out = { agentRole: agentRole?.key, teamId: team?.id, results: {} };
  for (const c of candidates) {
    const r = await req(token, c.method, c.url, c.body);
    out.results[c.label] = {
      status: r.status,
      keys: r.body && typeof r.body === 'object' ? Object.keys(r.body) : [],
      message: r.body?.message || null,
    };
    console.log(c.label, r.status, out.results[c.label].keys.join(','));
    if (r.status >= 200 && r.status < 300 && r.body?.id) {
      out.createdUserId = r.body.id;
      out.createdEmail = c.body.email;
    }
  }

  // role permissions endpoint patterns
  if (agentRole?.id || agentRole?.key) {
    const roleId = agentRole.id || agentRole.key;
    for (const ep of [
      `${CRM}/api/roles/${roleId}`,
      `${CRM}/api/roles/${roleId}/permissions`,
      `${CRM}/api/roles/key/${agentRole.key}`,
      `${CRM}/api/roles/key/${agentRole.key}/permissions`,
    ]) {
      const r = await req(token, 'GET', ep);
      out.results[`GET ${ep.replace(CRM, '')}`] = { status: r.status };
      console.log('GET', ep.replace(CRM, ''), r.status);
    }
  }

  const outDir = path.join(root, 'exploration');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'crud-probe.json'), JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
