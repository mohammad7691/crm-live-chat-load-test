/**
 * API helpers for seeding live chat sessions (NST widget) and auth.
 */
import fs from 'node:fs';
import path from 'node:path';

const fixturesDir = () => path.join(process.cwd(), 'fixtures');

const CRM = `https://${process.env.CRM_API_HOST || 'api.crm.swagprinthub.com'}`;
const CHAT = `https://${process.env.VISITOR_API_HOST || 'api.chat.crm.swagprinthub.com'}`;
const ORIGIN = process.env.VISITOR_ORIGIN || 'https://nst.staging.rev9solutions.com';

// Visitor session APIs are served from the chat host; CRM host redirects for some tenants.
const VISITOR_API = CHAT;

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${CRM}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok || !body.accessToken) throw new Error(`Login failed for ${email}: ${res.status}`);
  return body.accessToken as string;
}

export async function seedLiveChatSession(tag: string) {
  const publicKey = process.env.WIDGET_PUBLIC_KEY;
  if (!publicKey) throw new Error('WIDGET_PUBLIC_KEY not set');

  const visitorId = `${tag}-visitor`;
  const visitorName = `${tag} QA Visitor`;

  const sessRes = await fetch(`${VISITOR_API}/api/public/chat/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ publicKey, visitorId }),
  });
  const sess = await sessRes.json();
  if (!sessRes.ok) throw new Error(`Create session failed: ${sessRes.status}`);

  const { sessionId, sessionToken } = sess;
  const auth = { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json', Origin: ORIGIN };

  await fetch(`${VISITOR_API}/api/public/chat/sessions/${sessionId}/profile`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ visitorName }),
  });

  await fetch(`${VISITOR_API}/api/public/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ body: `${tag} visitor message for Playwright inbox test` }),
  });

  await fetch(`${VISITOR_API}/api/public/chat/sessions/${sessionId}/messages/bot`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ body: 'Connect to agent please', liveAgentHandoff: true }),
  });

  return { sessionId, visitorName, tag };
}

export function loadTestUsers() {
  const fixtures = path.join(fixturesDir(), 'test-users.json');
  const local = path.join(fixturesDir(), 'test-users.local.json');
  const users = JSON.parse(fs.readFileSync(fixtures, 'utf8'));
  if (fs.existsSync(local)) {
    const creds = JSON.parse(fs.readFileSync(local, 'utf8'));
    return { ...users, credentials: creds.users };
  }
  return users;
}

export async function getDistributionRules(token: string) {
  const res = await fetch(`${CRM}/api/distribution-rules`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getTickets(token: string, take = 5) {
  const res = await fetch(`${CRM}/api/tickets?take=${take}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getConversations(token: string, take = 5) {
  const res = await fetch(`${CRM}/api/conversations?take=${take}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
