#!/usr/bin/env node
/**
 * Make existing load-test sessions visible in CRM by agent-accepting them.
 * CRM only shows chats in assignment=pending (needs handoff) or assignment=assigned.
 * Load sessions without handoff/accept are invisible in the inbox UI.
 */
const AUTH_API = 'https://api.crm.swagprinthub.com';
const CHAT_API = 'https://api.chat.crm.swagprinthub.com';
const SITE_ID = 'cmrd7thsz0000ncqggnafo1ri';
const EMAIL = process.env.AGENT_EMAIL;
const PASS = process.env.AGENT_PASSWORD;
if (!EMAIL || !PASS) {
  console.error('Set AGENT_EMAIL and AGENT_PASSWORD env vars (see .env.example)');
  process.exit(1);
}
const TAG = 'NST Load 2026-07-10';

async function login() {
  const res = await fetch(`${AUTH_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const body = await res.json();
  if (!body.accessToken) throw new Error(`Login failed: ${res.status}`);
  return body.accessToken;
}

async function fetchAll(token, qs) {
  const all = [];
  let skip = 0;
  while (true) {
    const res = await fetch(`${CHAT_API}/api/chat/sessions?${qs}&skip=${skip}&take=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    const list = body.sessions || body.data || (Array.isArray(body) ? body : []);
    all.push(...list);
    if (list.length < 100) break;
    skip += 100;
    if (skip > 5000) break;
  }
  return all;
}

async function main() {
  const token = await login();
  const headers = { Authorization: `Bearer ${token}` };

  const all = await fetchAll(token, `siteId=${SITE_ID}&status=OPEN`);
  const targets = all.filter(
    (s) => (s.visitorName || '').includes(TAG) && !s.assignedToId,
  );

  console.log(`Found ${targets.length} unassigned "${TAG}" sessions to accept...\n`);

  let ok = 0;
  let fail = 0;
  for (const s of targets) {
    const res = await fetch(`${CHAT_API}/api/chat/sessions/${s.id}/accept`, {
      method: 'POST',
      headers,
    });
    if (res.ok || res.status === 409) {
      ok++;
      if (ok <= 5) console.log(`  OK  ${s.visitorName}`);
    } else {
      fail++;
      if (fail <= 5) console.log(`  FAIL ${s.id} HTTP ${res.status}`);
    }
    if ((ok + fail) % 50 === 0) process.stdout.write(`  ... ${ok + fail}/${targets.length}\r`);
  }

  const pending = await fetch(`${CHAT_API}/api/chat/sessions?siteId=${SITE_ID}&status=OPEN&assignment=pending&take=1`, { headers });
  const assigned = await fetch(`${CHAT_API}/api/chat/sessions?siteId=${SITE_ID}&status=OPEN&assignment=assigned&take=1`, { headers });
  const pBody = await pending.json();
  const aBody = await assigned.json();

  console.log(`\nDone: accepted ${ok}, failed ${fail}`);
  console.log(`CRM queues now — pending: ${pBody.total}, assigned: ${aBody.total}`);
  console.log('\nRefresh CRM: https://app.crm.swagprinthub.com/live-chats/workspace?tab=open&from=2026-07-10&to=2026-07-10');
  console.log(`Search: "${TAG}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
