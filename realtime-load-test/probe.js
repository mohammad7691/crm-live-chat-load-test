import { io } from 'socket.io-client';
import {
  config,
  agentSocketOrigin,
  visitorSocketOrigin,
} from './config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('CRM Socket.io Connectivity Probe');
  console.log('==================================');

  const loginRes = await fetch(`${config.apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: config.agentEmail,
      password: config.agentPassword,
    }),
  });
  const login = await loginRes.json();
  console.log('Agent login:', loginRes.status, login.accessToken ? 'OK' : 'FAIL');
  if (!login.accessToken) {
    console.log(login);
    process.exit(1);
  }

  const agentUrl = agentSocketOrigin();
  const agentSocket = io(agentUrl, {
    path: config.socketPath,
    auth: { token: login.accessToken },
    transports: ['websocket'],
    reconnection: false,
    timeout: 15000,
  });

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('agent socket timeout')), 15000);
    agentSocket.on('connect', () => {
      clearTimeout(t);
      console.log('Agent socket connected:', agentSocket.id, 'url=', agentUrl);
      resolve();
    });
    agentSocket.on('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });

  let visitorMessageOnAgent = false;
  agentSocket.on('crm.chat.visitorMessage', (p) => {
    visitorMessageOnAgent = true;
    console.log('Agent received crm.chat.visitorMessage:', JSON.stringify(p).slice(0, 180));
  });
  agentSocket.on('crm.chat.sessionCreated', (p) => {
    console.log('Agent received crm.chat.sessionCreated:', JSON.stringify(p).slice(0, 180));
  });

  const visitorId = `probe-${Date.now()}`;
  const sessRes = await fetch(`${config.apiBase}/api/public/chat/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: config.visitorOrigin,
    },
    body: JSON.stringify({
      publicKey: config.widgetPublicKey,
      visitorId,
    }),
  });
  const sess = await sessRes.json();
  console.log('Visitor session:', sessRes.status, sess.sessionId || 'FAIL');
  if (!sess.sessionToken) {
    console.log(sess);
    agentSocket.disconnect();
    process.exit(1);
  }

  const visitorUrl = visitorSocketOrigin();
  const visitorSocket = io(visitorUrl, {
    path: config.socketPath,
    auth: { token: sess.sessionToken },
    transports: ['websocket'],
    reconnection: false,
    timeout: 15000,
  });

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('visitor socket timeout')), 15000);
    visitorSocket.on('connect', () => {
      clearTimeout(t);
      console.log('Visitor socket connected:', visitorSocket.id, 'url=', visitorUrl);
      resolve();
    });
    visitorSocket.on('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });

  let agentReplyOnVisitor = false;
  visitorSocket.on('chat.message', (p) => {
    agentReplyOnVisitor = true;
    console.log('Visitor received chat.message:', JSON.stringify(p).slice(0, 180));
  });

  const msgRes = await fetch(
    `${config.apiBase}/api/public/chat/sessions/${sess.sessionId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sess.sessionToken}`,
        Origin: config.visitorOrigin,
      },
      body: JSON.stringify({ body: `Probe message ${Date.now()}` }),
    },
  );
  console.log('Visitor REST message:', msgRes.status);
  await sleep(5000);
  console.log('Agent push received for visitor message?', visitorMessageOnAgent);

  const replyRes = await fetch(
    `${config.apiBase}/api/chat/sessions/${sess.sessionId}/reply`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${login.accessToken}`,
      },
      body: JSON.stringify({
        body: 'Probe agent reply via REST',
        replyAsAssignedAgent: true,
      }),
    },
  );
  console.log('Agent REST reply:', replyRes.status);
  await sleep(5000);
  console.log('Visitor push received for agent reply?', agentReplyOnVisitor);

  agentSocket.disconnect();
  visitorSocket.disconnect();
  console.log('\nProbe complete.');
}

main().catch((err) => {
  console.error('Probe failed:', err.message || err);
  process.exit(1);
});
