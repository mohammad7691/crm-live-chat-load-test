import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const API = 'https://api.chat.crm.swagprinthub.com';
const ORIGIN = 'https://nst.staging.rev9solutions.com';
const PUBLIC_KEY = process.env.WIDGET_PUBLIC_KEY || '';
const EMAIL = process.env.AGENT_EMAIL || '';
const PASS = process.env.AGENT_PASSWORD || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function handshakePolling(namespaceHint) {
  // Engine.IO v4 polling handshake to get sid
  const url = `${API}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;
  const res = await fetch(url, { headers: { Origin: ORIGIN } });
  const text = await res.text();
  // format: 0{"sid":"...","upgrades":["websocket"],...}
  const json = JSON.parse(text.slice(1));
  return json.sid;
}

function wsUrl(sid) {
  return `${API.replace('https', 'wss')}/socket.io/?EIO=4&transport=websocket&sid=${sid}`;
}

async function captureNamespace(label, namespace, token, afterConnect) {
  console.log(`\n===== ${label} (namespace ${namespace}) =====`);
  const sid = await handshakePolling();
  console.log(`[${label}] polling sid: ${sid}`);
  const ws = new WebSocket(wsUrl(sid), { headers: { Origin: ORIGIN } });

  ws.on('open', () => console.log(`[${label}] ws open`));
  ws.on('message', async (data) => {
    const s = data.toString();
    console.log(`[${label}] <= ${s.slice(0, 160)}`);
    if (s === '3probe') {
      console.log(`[${label}] => 5 (upgrade)`);
      ws.send('5');
      const connectPacket = `40${namespace},${JSON.stringify({ token })}`;
      console.log(`[${label}] => ${connectPacket}`);
      ws.send(connectPacket);
    } else if (s.startsWith('40')) {
      console.log(`[${label}] namespace connected ack: ${s}`);
      if (afterConnect) await afterConnect();
    } else if (s === '2') {
      ws.send('3'); // pong
    }
  });
  ws.on('error', (e) => console.log(`[${label}] ERROR ${e.message}`));

  await new Promise((r) => ws.on('open', r));
  console.log(`[${label}] => 2probe`);
  ws.send('2probe');
  return ws;
}

async function main() {
  // AGENT
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then((r) => r.json());
  const agentToken = login.accessToken;
  console.log('agent token?', !!agentToken);

  // VISITOR session
  const sess = await fetch(`${API}/api/public/chat/sessions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ publicKey: PUBLIC_KEY, visitorId: `frames-${Date.now()}` }),
  }).then((r) => r.json());
  console.log('visitor session?', sess.sessionId);

  const agentWs = await captureNamespace('AGENT', '/realtime', agentToken);
  await sleep(1500);
  const visitorWs = await captureNamespace('VISITOR', '/widget', sess.sessionToken, async () => {
    // send a visitor message via REST to observe the event frame
    await sleep(500);
    await fetch(`${API}/api/public/chat/sessions/${sess.sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.sessionToken}`, Origin: ORIGIN },
      body: JSON.stringify({ body: 'frame capture message' }),
    });
    // agent accept + reply so visitor receives chat.message frame
    await fetch(`${API}/api/chat/sessions/${sess.sessionId}/accept`, {
      method: 'POST', headers: { Authorization: `Bearer ${agentToken}` },
    });
    await fetch(`${API}/api/chat/sessions/${sess.sessionId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify({ body: 'frame capture reply', replyAsAssignedAgent: true }),
    });
  });

  await sleep(7000);
  agentWs.close();
  visitorWs.close();
  console.log('\nframe capture done');
}

main().catch((e) => { console.error(e); process.exit(1); });
