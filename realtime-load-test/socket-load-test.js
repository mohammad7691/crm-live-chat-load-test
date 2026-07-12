import { io } from 'socket.io-client';
import {
  config,
  agentSocketOrigin,
  visitorSocketOrigin,
} from './config.js';
import { Metrics } from './metrics.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, options = {}) {
  const started = Date.now();
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { res, body, ms: Date.now() - started };
}

function connectSocket(url, authToken, label, metrics) {
  const started = Date.now();
  const socket = io(url, {
    path: config.socketPath,
    auth: { token: authToken },
    transports: ['websocket', 'polling'],
    reconnection: false,
    timeout: config.connectTimeoutMs,
    forceNew: true,
  });

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      metrics.inc(`${label}.socket.connect.fail`);
      metrics.error(label, 'Socket connect timeout', url);
      socket.disconnect();
      resolve({ socket: null, ms: Date.now() - started, ok: false });
    }, config.connectTimeoutMs + 2000);

    socket.on('connect', () => {
      clearTimeout(timer);
      const ms = Date.now() - started;
      metrics.inc(`${label}.socket.connect.ok`);
      metrics.record(`${label}.socket.connect.ms`, ms);
      resolve({ socket, ms, ok: true });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      metrics.inc(`${label}.socket.connect.fail`);
      metrics.error(label, 'Socket connect_error', err?.message || String(err));
      socket.disconnect();
      resolve({ socket: null, ms: Date.now() - started, ok: false });
    });
  });
}

async function loginAgent(metrics, agentIndex) {
  const started = Date.now();
  try {
    const { res, body } = await fetchJson(`${config.apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: config.agentEmail,
        password: config.agentPassword,
      }),
    });

    const ms = Date.now() - started;
    metrics.record('agent.login.ms', ms);

    if (!res.ok || !body?.accessToken) {
      metrics.inc('agent.login.fail');
      metrics.error('agent.login', `HTTP ${res.status}`, body);
      return null;
    }

    metrics.inc('agent.login.ok');

    await fetchJson(`${config.apiBase}/api/chat/presence`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${body.accessToken}`,
      },
      body: JSON.stringify({ status: 'AVAILABLE' }),
    });

    return { token: body.accessToken, agentIndex };
  } catch (err) {
    metrics.inc('agent.login.fail');
    metrics.error('agent.login', err.message);
    return null;
  }
}

async function acceptAndReply(sessionId, token, metrics) {
  try {
    const accept = await fetchJson(
      `${config.apiBase}/api/chat/sessions/${sessionId}/accept`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      },
    );
    if (accept.res.ok || accept.res.status === 409) {
      metrics.inc('agent.accept.ok');
    } else {
      metrics.inc('agent.accept.fail');
      return;
    }

    const reply = await fetchJson(
      `${config.apiBase}/api/chat/sessions/${sessionId}/reply`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          body: `Socket load test agent reply at ${new Date().toISOString()}`,
          replyAsAssignedAgent: true,
        }),
      },
    );
    if (reply.res.ok) metrics.inc('agent.reply.ok');
    else metrics.inc('agent.reply.fail');
  } catch (err) {
    metrics.error('agent.accept-reply', err.message);
  }
}

async function runAgent(agentIndex, metrics, holdMs) {
  if (agentIndex > 0) {
    await sleep(config.loginStaggerMs * agentIndex);
  }

  const agent = await loginAgent(metrics, agentIndex);
  if (!agent) return;

  const socketUrl = agentSocketOrigin();
  const { socket, ok } = await connectSocket(socketUrl, agent.token, 'agent', metrics);
  if (!ok || !socket) return;

  const handledSessions = new Set();

  socket.on('crm.chat.visitorMessage', (payload) => {
    metrics.inc('agent.event.visitorMessage');
    if (payload?.sentAt || payload?.createdAt) {
      const sent = new Date(payload.sentAt || payload.createdAt).getTime();
      if (!Number.isNaN(sent)) {
        metrics.record('agent.push.visitorMessage.ms', Date.now() - sent);
      }
    }
  });
  socket.on('crm.chat.sessionCreated', (payload) => {
    metrics.inc('agent.event.sessionCreated');
    const sessionId = payload?.sessionId;
    if (!sessionId || handledSessions.has(sessionId)) return;
    handledSessions.add(sessionId);
    acceptAndReply(sessionId, agent.token, metrics);
  });
  socket.on('crm.chat.sessionUpdated', () => {
    metrics.inc('agent.event.sessionUpdated');
  });
  socket.on('disconnect', (reason) => {
    metrics.inc('agent.socket.disconnect');
    metrics.error('agent.socket', 'disconnect', reason);
  });

  await sleep(holdMs);
  socket.disconnect();
}

async function runVisitor(visitorIndex, metrics, rampDelayMs) {
  await sleep(rampDelayMs);

  const visitorId = `load-v${visitorIndex}-${Date.now()}`;
  let sessionId = null;
  let sessionToken = null;

  try {
    const sessionStarted = Date.now();
    const { res, body } = await fetchJson(`${config.apiBase}/api/public/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: config.visitorOrigin,
        Referer: `${config.visitorOrigin}/`,
      },
      body: JSON.stringify({
        publicKey: config.widgetPublicKey,
        visitorId,
      }),
    });

    metrics.record('visitor.session.ms', Date.now() - sessionStarted);

    if (!res.ok || !body?.sessionToken || !body?.sessionId) {
      metrics.inc('visitor.session.fail');
      metrics.error('visitor.session', `HTTP ${res.status}`, body);
      return;
    }

    metrics.inc('visitor.session.ok');
    sessionId = body.sessionId;
    sessionToken = body.sessionToken;
  } catch (err) {
    metrics.inc('visitor.session.fail');
    metrics.error('visitor.session', err.message);
    return;
  }

  const socketUrl = visitorSocketOrigin();
  const { socket, ok } = await connectSocket(socketUrl, sessionToken, 'visitor', metrics);
  if (!ok || !socket) return;

  let pushReceived = false;
  let messageSentAt = null;
  socket.on('chat.message', () => {
    if (pushReceived) return;
    pushReceived = true;
    metrics.inc('visitor.event.chat.message');
    if (messageSentAt) {
      metrics.record('visitor.push.chat.message.ms', Date.now() - messageSentAt);
    }
  });
  socket.on('chat.session_closed', () => {
    metrics.inc('visitor.event.session_closed');
  });
  socket.on('disconnect', (reason) => {
    metrics.inc('visitor.socket.disconnect');
    metrics.error('visitor.socket', 'disconnect', reason);
  });

  messageSentAt = Date.now();
  try {
    const msgStarted = Date.now();
    const { res, body } = await fetchJson(
      `${config.apiBase}/api/public/chat/sessions/${sessionId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${sessionToken}`,
          Origin: config.visitorOrigin,
          Referer: `${config.visitorOrigin}/`,
        },
        body: JSON.stringify({
          body: `Socket load test message from visitor ${visitorIndex} at ${new Date().toISOString()}`,
        }),
      },
    );

    metrics.record('visitor.message.rest.ms', Date.now() - msgStarted);

    if (!res.ok) {
      metrics.inc('visitor.message.rest.fail');
      metrics.error('visitor.message.rest', `HTTP ${res.status}`, body);
    } else {
      metrics.inc('visitor.message.rest.ok');
    }
  } catch (err) {
    metrics.inc('visitor.message.rest.fail');
    metrics.error('visitor.message.rest', err.message);
  }

  const pushWaitStart = Date.now();
  while (!pushReceived && Date.now() - pushWaitStart < config.eventWaitMs) {
    await sleep(250);
  }

  if (!pushReceived) {
    metrics.inc('visitor.event.chat.message.missed');
  }

  await sleep(Math.max(0, config.holdMs - (Date.now() - messageSentAt)));
  socket.disconnect();
}

async function main() {
  const metrics = new Metrics();
  const agentSocketUrl = agentSocketOrigin();
  const visitorSocketUrl = visitorSocketOrigin();

  console.log('CRM Socket.io Load Test');
  console.log('=======================');
  console.log(`API:             ${config.apiBase}`);
  console.log(`Agent socket:    ${agentSocketUrl}`);
  console.log(`Visitor socket:  ${visitorSocketUrl}`);
  console.log(`Agents:          ${config.agentCount}`);
  console.log(`Visitors:        ${config.visitorCount}`);
  console.log(`Ramp-up:         ${config.rampUpMs}ms`);
  console.log(`Hold per user:   ${config.holdMs}ms`);
  console.log('');

  const agentPromises = Array.from({ length: config.agentCount }, (_, i) =>
    runAgent(i, metrics, config.holdMs),
  );

  const visitorPromises = Array.from({ length: config.visitorCount }, (_, i) => {
    const rampDelay = Math.floor((config.rampUpMs / Math.max(config.visitorCount, 1)) * i);
    return runVisitor(i + 1, metrics, rampDelay);
  });

  await Promise.all([...agentPromises, ...visitorPromises]);

  const report = metrics.toReport({
    ...config,
    agentSocketUrl,
    visitorSocketUrl,
  });

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const outDir = path.resolve('../results');
  await fs.mkdir(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `socket-results-${stamp}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

  console.log('\nResults');
  console.log('-------');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('\nLatencies (ms):');
  console.log(JSON.stringify(report.latenciesMs, null, 2));
  console.log(`\nSaved: ${jsonPath}`);

  if (report.errors.length) {
    console.log(`\nFirst errors (${Math.min(5, report.errors.length)}):`);
    for (const e of report.errors.slice(0, 5)) {
      console.log(`- [${e.scope}] ${e.message}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
