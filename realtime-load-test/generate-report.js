import fs from 'node:fs/promises';
import path from 'node:path';

const resultsDir = path.resolve('../results');
const reportsDir = path.resolve('../reports');

function pct(ok, fail) {
  const total = ok + fail;
  if (!total) return '0%';
  return `${((ok / total) * 100).toFixed(1)}%`;
}

function latencyRow(label, stats) {
  if (!stats?.count) return `| ${label} | 0 | - | - | - | - |`;
  return `| ${label} | ${stats.count} | ${stats.min} | ${stats.avg} | ${stats.p95} | ${stats.max} |`;
}

async function latestJsonFile(dir) {
  const files = (await fs.readdir(dir))
    .filter((f) => f.startsWith('socket-results-') && f.endsWith('.json'))
    .sort();
  if (!files.length) return null;
  return path.join(dir, files.at(-1));
}

async function main() {
  const input = process.argv[2] || (await latestJsonFile(resultsDir));
  if (!input) {
    console.error('No socket results JSON found. Run npm test first.');
    process.exit(1);
  }

  const report = JSON.parse(await fs.readFile(input, 'utf8'));
  const s = report.summary;
  const l = report.latenciesMs;
  const c = report.config;

  const md = `# CRM Socket.io Real-Time Load Test Report

## Executive Summary
Socket.io load test for the CRM live chat **real-time layer** (not covered by the HTTP/JMeter test).

| Metric | Value |
|---|---|
| Test date | ${report.meta.generatedAt} |
| Duration | ${report.meta.durationHuman} |
| Agent socket URL | \`${c.agentSocketUrl}\` |
| Visitor socket URL | \`${c.visitorSocketUrl}\` |
| Concurrent agents | ${c.agentCount} |
| Concurrent visitors | ${c.visitorCount} |
| Socket connect error rate | ${s.socketConnectErrorRate}% |

---

## What Was Tested

### Agent real-time namespace (\`/realtime\`)
- Login via REST → connect socket.io with JWT auth
- Listen for: \`crm.chat.visitorMessage\`, \`crm.chat.sessionCreated\`, \`crm.chat.sessionUpdated\`
- Keep persistent WebSocket connections under load

### Visitor real-time namespace (\`/widget\`)
- Create session via REST → connect socket.io with session token
- Send message via REST
- Listen for: \`chat.message\` (agent reply push), \`chat.session_closed\`

---

## Results

### Authentication & Sessions
| Action | Success | Fail | Success Rate |
|---|---:|---:|---:|
| Agent login | ${s.agentLogin.ok} | ${s.agentLogin.fail} | ${pct(s.agentLogin.ok, s.agentLogin.fail)} |
| Visitor session create | ${s.visitorSessionCreate.ok} | ${s.visitorSessionCreate.fail} | ${pct(s.visitorSessionCreate.ok, s.visitorSessionCreate.fail)} |

### Socket Connections
| Action | Success | Fail | Success Rate |
|---|---:|---:|---:|
| Agent socket connect | ${s.agentSocketConnect.ok} | ${s.agentSocketConnect.fail} | ${pct(s.agentSocketConnect.ok, s.agentSocketConnect.fail)} |
| Visitor socket connect | ${s.visitorSocketConnect.ok} | ${s.visitorSocketConnect.fail} | ${pct(s.visitorSocketConnect.ok, s.visitorSocketConnect.fail)} |

### Agent Actions (triggered by socket events)
| Action | Count |
|---|---:|
| Accept chat (on sessionCreated) | ${s.agentActions?.acceptOk ?? 0} |
| Agent reply (REST after accept) | ${s.agentActions?.replyOk ?? 0} |

### REST + Real-Time Push
| Action | Count |
|---|---:|
| Visitor messages sent (REST) | ${s.visitorMessageRest.ok} ok / ${s.visitorMessageRest.fail} fail |
| Agent received \`crm.chat.visitorMessage\` | ${s.realtimePush.agentReceivedVisitorMessage} |
| Agent received \`crm.chat.sessionCreated\` | ${s.realtimePush.agentReceivedSessionCreated} |
| Visitor received \`chat.message\` push | ${s.realtimePush.visitorReceivedAgentReply} |

---

## Latencies (ms)
| Metric | Samples | Min | Avg | P95 | Max |
|---|---:|---:|---:|---:|---:|
${latencyRow('Agent login', l.agentLogin)}
${latencyRow('Agent socket connect', l.agentSocketConnect)}
${latencyRow('Visitor session create', l.visitorSessionCreate)}
${latencyRow('Visitor socket connect', l.visitorSocketConnect)}
${latencyRow('Visitor message REST', l.visitorMessageRest)}
${latencyRow('Agent push latency (visitorMessage)', l.agentPushLatency)}
${latencyRow('Visitor push latency (chat.message)', l.visitorPushLatency)}

---

## Interpretation

- **Socket connect success** measures whether WebSocket/polling connections survive under concurrent load.
- **Agent \`crm.chat.visitorMessage\`** confirms real-time push from visitor REST message to agent UI layer.
- **Visitor \`chat.message\`** confirms agent replies are pushed back over socket.io (requires agent to accept/reply during test).
- This test complements the JMeter HTTP report — together they cover REST APIs **and** the real-time socket layer.

---

## Source Data
- Raw JSON: \`${path.basename(input)}\`

## How to Re-run
\`\`\`bash
cd realtime-load-test
npm install
npm run probe          # single connectivity check
npm test               # default 10 agents + 10 visitors
npm run test:light     # 5 + 5
npm run test:medium      # 20 visitors + 10 agents
\`\`\`
`;

  await fs.mkdir(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, 'SOCKET_LOAD_TEST_REPORT.md');
  await fs.writeFile(outPath, md);
  console.log(`Report written: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
