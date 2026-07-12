#!/usr/bin/env node
/**
 * List OPEN chat sessions on staging and show load-test visitors (vload-*).
 */
const API = 'https://api.crm.swagprinthub.com';
const VISITOR_API = 'https://api.chat.crm.swagprinthub.com';
const SITE_ID = 'cmrd7thsz0000ncqggnafo1ri';
const EMAIL = process.env.AGENT_EMAIL;
const PASS = process.env.AGENT_PASSWORD;
const PUBLIC_KEY = process.env.WIDGET_PUBLIC_KEY;
if (!EMAIL || !PASS || !PUBLIC_KEY) {
  console.error('Set AGENT_EMAIL, AGENT_PASSWORD, and WIDGET_PUBLIC_KEY (see .env.example)');
  process.exit(1);
}

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text?.slice(0, 200) }; }
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  console.log('STAGING SESSION CHECK');
  console.log('=====================\n');

  const login = await j(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const token = login.body?.accessToken;
  if (!token) {
    console.log('Agent login failed:', login.status, login.body);
    process.exit(1);
  }
  console.log('Agent login: OK\n');

  const queries = [
    ['All OPEN (site)', `siteId=${SITE_ID}&status=OPEN&take=100`],
    ['Unassigned OPEN', `siteId=${SITE_ID}&status=OPEN&assignment=pending&take=100`],
    ['Assigned OPEN', `siteId=${SITE_ID}&status=OPEN&assignment=assigned&take=100`],
  ];

  const seen = new Set();
  const loadTest = [];
  const verify = [];

  for (const [label, qs] of queries) {
    const r = await j(`${VISITOR_API}/api/chat/sessions?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = Array.isArray(r.body) ? r.body : r.body?.data || r.body?.sessions || [];
    console.log(`${label}: HTTP ${r.status} → ${list.length} sessions`);

    for (const s of list) {
      const id = s.id || s.sessionId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name = s.visitorName || s.visitor?.name || s.visitorId || '(no name)';
      const assigned = s.assignedToId || s.assignedAgentId || s.assignedTo?.id || 'unassigned';
      const row = { id, name, assigned, status: s.status || '?' };
      if (/vload-/i.test(String(name)) || /vload-/i.test(String(s.visitorId))) loadTest.push(row);
      if (/VERIFY-/i.test(String(name))) verify.push(row);
    }
  }

  console.log(`\nTotal unique OPEN sessions found: ${seen.size}`);
  console.log(`Load-test sessions (vload-*): ${loadTest.length}`);
  console.log(`Verify sessions (VERIFY-*): ${verify.length}\n`);

  if (loadTest.length) {
    console.log('--- Load-test sessions still on staging ---');
    for (const s of loadTest.slice(0, 20)) {
      console.log(`  ${s.id} | ${s.name} | assigned: ${s.assigned}`);
    }
    if (loadTest.length > 20) console.log(`  ... and ${loadTest.length - 20} more`);
  } else {
    console.log('No vload-* sessions found in current OPEN lists.');
    console.log('(They may have been closed, assigned elsewhere, or aged out of the queue.)');
  }

  if (verify.length) {
    console.log('\n--- VERIFY sessions ---');
    for (const s of verify) console.log(`  ${s.id} | ${s.name}`);
  }

  // Create one fresh persistent session for UI search
  const tag = `VERIFY-${Date.now()}`;
  const visitorName = `${tag} (search me in CRM)`;
  const sess = await j(`${VISITOR_API}/api/public/chat/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://nst.staging.rev9solutions.com' },
    body: JSON.stringify({ publicKey: PUBLIC_KEY, visitorId: `${tag}-visitor` }),
  });
  if (!sess.ok || !sess.body?.sessionId) {
    console.log('\nFailed to create new verify session:', sess.status, sess.body);
    return;
  }
  const sid = sess.body.sessionId;
  const stoken = sess.body.sessionToken;

  await j(`${VISITOR_API}/api/public/chat/sessions/${sid}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${stoken}`, Origin: 'https://nst.staging.rev9solutions.com' },
    body: JSON.stringify({ visitorName }),
  });

  await j(`${VISITOR_API}/api/public/chat/sessions/${sid}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${stoken}`, Origin: 'https://nst.staging.rev9solutions.com' },
    body: JSON.stringify({ body: `${tag} :: Please check this in Live Chat — left OPEN on purpose.` }),
  });

  await j(`${VISITOR_API}/api/chat/sessions/${sid}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  await j(`${VISITOR_API}/api/chat/sessions/${sid}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ body: `${tag} :: Agent reply — this chat is OPEN for you to verify.`, replyAsAssignedAgent: true }),
  });

  // Confirm it's in agent list
  const check = await j(`${VISITOR_API}/api/chat/sessions?siteId=${SITE_ID}&status=OPEN&take=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const checkList = Array.isArray(check.body) ? check.body : check.body?.data || check.body?.sessions || [];
  const found = checkList.find((s) => (s.id || s.sessionId) === sid);

  console.log('\n=====================================================');
  console.log('NEW PERSISTENT SESSION (left OPEN — find in CRM):');
  console.log(`  Visitor name:  "${visitorName}"`);
  console.log(`  Search tag:    ${tag}`);
  console.log(`  Session ID:    ${sid}`);
  console.log(`  Visible in agent OPEN list? ${found ? 'YES' : 'NO'}`);
  console.log('=====================================================');
  console.log('\nHow to see it:');
  console.log('  1. Open CRM app for NST / api.chat tenant');
  console.log('  2. Live Chat → site **NST** (not Dev23 / not old site)');
  console.log('     site id: cmrd7thsz0000ncqggnafo1ri');
  console.log('     API: api.chat.crm.swagprinthub.com (NOT api.crm)');
  console.log('  3. Filter: OPEN + All / Unassigned');
  console.log(`  4. Search visitor: "${tag}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
