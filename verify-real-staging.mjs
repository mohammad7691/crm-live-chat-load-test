#!/usr/bin/env node
/**
 * VERIFY REAL STAGING DATA
 * ========================
 * Proves the test really hits staging by creating a PERSISTENT chat that
 * you can open in the CRM UI. It does NOT end or delete the session.
 *
 * Steps:
 *   1. Visitor creates a session (real)
 *   2. Visitor sends a uniquely-tagged message
 *   3. Agent logs in, finds THIS session in the live list, reads the message back
 *   4. Agent accepts + replies (visible to visitor)
 *   5. Leaves everything in place + prints how to find it in the UI
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, 'realtime-load-test/'));
const { io } = require('socket.io-client');

const API = process.env.CRM_API_BASE || 'https://api.crm.swagprinthub.com';
const VISITOR_API = process.env.VISITOR_API_BASE || 'https://api.chat.crm.swagprinthub.com';
const ORIGIN = process.env.VISITOR_ORIGIN || 'https://nst.staging.rev9solutions.com';
const EMAIL = process.env.AGENT_EMAIL || '';
const PASS = process.env.AGENT_PASSWORD || '';
const PUBLIC_KEY = process.env.WIDGET_PUBLIC_KEY || '';
const SITE_ID = process.env.WIDGET_SITE_ID || 'cmrd7thsz0000ncqggnafo1ri';

const stamp = new Date().toISOString();
const tag = `VERIFY-${Date.now()}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  console.log('VERIFY REAL STAGING DATA');
  console.log('========================');
  console.log(`API: ${API}`);
  console.log(`Unique tag for this run: ${tag}\n`);

  // 1. Visitor session
  const visitorId = `${tag}-visitor`;
  const visitorName = `${tag} (QA Load Test)`;
  const sess = await j(`${API}/api/public/chat/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ publicKey: PUBLIC_KEY, visitorId }),
  });
  if (!sess.ok || !sess.body?.sessionId) {
    console.log('FAILED to create session:', sess.status, sess.body);
    process.exit(1);
  }
  const sessionId = sess.body.sessionId;
  const sessionToken = sess.body.sessionToken;
  console.log(`1. Visitor session created  -> HTTP ${sess.status}`);
  console.log(`   sessionId: ${sessionId}`);

  // name the visitor so it is easy to spot in the UI
  await j(`${API}/api/public/chat/sessions/${sessionId}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}`, Origin: ORIGIN },
    body: JSON.stringify({ visitorName }),
  });

  // 2. Visitor message (uniquely tagged)
  const messageBody = `${tag} :: Hello from the automated load test at ${stamp}. If you can read this in the CRM, the test is REAL.`;
  const msg = await j(`${API}/api/public/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}`, Origin: ORIGIN },
    body: JSON.stringify({ body: messageBody }),
  });
  console.log(`2. Visitor message sent     -> HTTP ${msg.status}`);
  console.log(`   message: "${messageBody}"`);

  // 3. Agent logs in and finds THIS session in the live list
  const login = await j(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!login.ok || !login.body?.accessToken) {
    console.log('Agent login failed:', login.status, login.body);
    process.exit(1);
  }
  const token = login.body.accessToken;
  console.log(`3. Agent login              -> HTTP ${login.status}`);

  const list = await j(`${API}/api/chat/sessions?siteId=${SITE_ID}&status=OPEN&take=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const arr = Array.isArray(list.body) ? list.body : list.body?.data || list.body?.sessions || [];
  const found = arr.find((s) => s.id === sessionId || s.sessionId === sessionId);
  console.log(`   Agent list OPEN sessions -> HTTP ${list.status}, ${arr.length} sessions returned`);
  console.log(`   THIS session present in agent's live list? ${found ? 'YES ✅' : 'NO ❌'}`);

  // 4. Read the message back through the agent API (proves it persisted server-side)
  const back = await j(`${API}/api/chat/sessions/${sessionId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const messages = Array.isArray(back.body) ? back.body : back.body?.data || back.body?.messages || [];
  const echoed = messages.find((m) => (m.body || '').includes(tag));
  console.log(`4. Agent reads messages back -> HTTP ${back.status}, ${messages.length} message(s)`);
  console.log(`   Visitor message found on server? ${echoed ? 'YES ✅' : 'NO ❌'}`);

  // 5. Agent accepts + replies (leave it OPEN so you can see it)
  const accept = await j(`${API}/api/chat/sessions/${sessionId}/accept`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
  });
  const reply = await j(`${API}/api/chat/sessions/${sessionId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ body: `${tag} :: Agent reply — this conversation was left OPEN on purpose so you can verify it.`, replyAsAssignedAgent: true }),
  });
  console.log(`5. Agent accept/reply       -> accept HTTP ${accept.status}, reply HTTP ${reply.status}`);

  // Optional: confirm real-time push still works and print event
  const visitorSock = io(`${API}/widget`, { path: '/socket.io', auth: { token: sessionToken }, transports: ['websocket'], reconnection: false, timeout: 12000 });
  let gotPush = false;
  visitorSock.on('connect', () => {});
  visitorSock.on('chat.message', () => { gotPush = true; });
  await new Promise((res) => { visitorSock.on('connect', res); visitorSock.on('connect_error', res); setTimeout(res, 6000); });
  // trigger one more reply to catch the live push
  await j(`${API}/api/chat/sessions/${sessionId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ body: `${tag} :: live push check`, replyAsAssignedAgent: true }),
  });
  await sleep(4000);
  console.log(`   Real-time push received by visitor socket? ${gotPush ? 'YES ✅' : 'NO'}`);
  visitorSock.disconnect();

  console.log('\n=====================================================');
  console.log('HOW TO SEE IT IN STAGING (left OPEN, not deleted):');
  console.log(`  1. Open the CRM:  https://app.crm.swagprinthub.com/`);
  console.log(`  2. Go to Live Chat / Conversations for the Dev23 site.`);
  console.log(`  3. Look for the visitor named:  "${visitorName}"`);
  console.log(`  4. Or search messages for the tag:  ${tag}`);
  console.log(`  5. Session ID: ${sessionId}`);
  console.log('=====================================================');
  console.log('\nProof this run was REAL:');
  console.log(`  - Visitor message persisted & read back by agent API: ${echoed ? 'YES' : 'NO'}`);
  console.log(`  - Session visible in agent live list:                 ${found ? 'YES' : 'NO'}`);
  console.log(`  - Real-time socket push delivered:                    ${gotPush ? 'YES' : 'NO'}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
