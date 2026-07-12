#!/usr/bin/env node
/**
 * Create QA automation users. Writes fixtures/test-users.json (emails only + ids).
 * Passwords stored in fixtures/test-users.local.json (gitignored).
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

const CRM = `https://${process.env.CRM_API_HOST || 'api.crm.swagprinthub.com'}`;

const USERS_TO_CREATE = [
  { key: 'qaAgentA', email: 'qa-auto-agent-a@test.local', fullName: 'QA Auto Agent A', password: 'QaTest2026!A', roleKey: 'AGENT' },
  { key: 'qaAgentB', email: 'qa-auto-agent-b@test.local', fullName: 'QA Auto Agent B', password: 'QaTest2026!B', roleKey: 'AGENT' },
  { key: 'qaSupervisor', email: 'qa-auto-supervisor@test.local', fullName: 'QA Auto Supervisor', password: 'QaTest2026!S', roleKey: 'SUPERVISOR' },
  { key: 'qaAdminLite', email: 'qa-auto-admin-lite@test.local', fullName: 'QA Auto Admin Lite', password: 'QaTest2026!L', roleKey: 'ADMIN' },
];

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
  if (!body.accessToken) throw new Error('Admin login failed');
  return body.accessToken;
}

async function findUser(token, email) {
  const users = await (await fetch(`${CRM}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  return users.find((u) => u.email === email);
}

async function createUser(token, spec, teamId) {
  const existing = await findUser(token, spec.email);
  if (existing) return { created: false, user: existing };

  const res = await fetch(`${CRM}/api/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: spec.email,
      fullName: spec.fullName,
      password: spec.password,
      roleKey: spec.roleKey,
      teamId,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Create ${spec.email} failed: ${res.status} ${JSON.stringify(body.message || body)}`);
  return { created: true, user: body };
}

async function main() {
  const token = await login();
  const teams = await (await fetch(`${CRM}/api/teams`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  const team = teams.find((t) => t.isActive) || teams[0];
  if (!team) throw new Error('No team found');

  const roles = await (await fetch(`${CRM}/api/roles`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  const roleKeys = new Set(roles.map((r) => r.key));

  const publicFixtures = { teamId: team.id, teamName: team.name, users: {} };
  const localFixtures = { users: {} };

  for (const spec of USERS_TO_CREATE) {
    if (!roleKeys.has(spec.roleKey)) {
      console.warn(`Skip ${spec.email}: role ${spec.roleKey} not found`);
      continue;
    }
    const { created, user } = await createUser(token, spec, team.id);
    publicFixtures.users[spec.key] = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleKey: user.roleKey,
      teamId: user.teamId,
    };
    localFixtures.users[spec.key] = { email: user.email, password: spec.password };
    console.log(created ? 'CREATED' : 'EXISTS', user.email, user.roleKey);
  }

  const fixturesDir = path.join(root, 'fixtures');
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.writeFileSync(path.join(fixturesDir, 'test-users.json'), JSON.stringify(publicFixtures, null, 2));
  fs.writeFileSync(path.join(fixturesDir, 'test-users.local.json'), JSON.stringify(localFixtures, null, 2));
  console.log('\nWrote fixtures/test-users.json and fixtures/test-users.local.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
