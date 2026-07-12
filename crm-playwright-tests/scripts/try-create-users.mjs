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

async function main() {
  const token = await login();
  const roles = await (await fetch(`${CRM}/api/roles`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const teams = await (await fetch(`${CRM}/api/teams`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const agent = roles.find((r) => r.key === 'AGENT') || roles.find((r) => /agent/i.test(r.name));
  const team = teams[0];
  const stamp = Date.now();

  const bodies = [
    { email: `qa-auto-a-${stamp}@test.local`, fullName: 'QA Auto A', password: 'QaTest2026!A', roleKey: agent.key, teamId: team.id },
    { email: `qa-auto-b-${stamp}@test.local`, fullName: 'QA Auto B', password: 'QaTest2026!B', roleId: agent.id, teamId: team.id },
    { email: `qa-auto-c-${stamp}@test.local`, name: 'QA Auto C', password: 'QaTest2026!C', roleKey: agent.key },
    { email: `qa-auto-d-${stamp}@test.local`, fullName: 'QA Auto D', password: 'QaTest2026!D', roleKey: agent.key, teamId: team.id, sendInvite: false },
  ];

  const results = [];
  for (const body of bodies) {
    const res = await fetch(`${CRM}/api/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    results.push({ status: res.status, body, response: parsed });
    console.log(body.email, res.status, typeof parsed === 'object' ? JSON.stringify(parsed.message || parsed) : parsed);
  }

  fs.writeFileSync(path.join(root, 'exploration', 'user-create-attempts.json'), JSON.stringify({ agent, teamId: team?.id, results }, null, 2));
}

main();
