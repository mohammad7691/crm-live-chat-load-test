# CRM Socket.io Real-Time Load Test Report

## Executive Summary
Socket.io load test for the CRM live chat **real-time layer** (not covered by the HTTP/JMeter test).

| Metric | Value |
|---|---|
| Test date | 2026-07-08T04:27:55.278Z |
| Duration | 88s |
| Agent socket URL | `https://api.crm.swagprinthub.com/realtime` |
| Visitor socket URL | `https://api.crm.swagprinthub.com/widget` |
| Concurrent agents | 10 |
| Concurrent visitors | 10 |
| Socket connect error rate | 0% |

---

## What Was Tested

### Agent real-time namespace (`/realtime`)
- Login via REST → connect socket.io with JWT auth
- Listen for: `crm.chat.visitorMessage`, `crm.chat.sessionCreated`, `crm.chat.sessionUpdated`
- Keep persistent WebSocket connections under load

### Visitor real-time namespace (`/widget`)
- Create session via REST → connect socket.io with session token
- Send message via REST
- Listen for: `chat.message` (agent reply push), `chat.session_closed`

---

## Results

### Authentication & Sessions
| Action | Success | Fail | Success Rate |
|---|---:|---:|---:|
| Agent login | 10 | 0 | 100.0% |
| Visitor session create | 10 | 0 | 100.0% |

### Socket Connections
| Action | Success | Fail | Success Rate |
|---|---:|---:|---:|
| Agent socket connect | 10 | 0 | 100.0% |
| Visitor socket connect | 10 | 0 | 100.0% |

### Agent Actions (triggered by socket events)
| Action | Count |
|---|---:|
| Accept chat (on sessionCreated) | 85 |
| Agent reply (REST after accept) | 85 |

### REST + Real-Time Push
| Action | Count |
|---|---:|
| Visitor messages sent (REST) | 10 ok / 0 fail |
| Agent received `crm.chat.visitorMessage` | 0 |
| Agent received `crm.chat.sessionCreated` | 85 |
| Visitor received `chat.message` push | 6 |

---

## Latencies (ms)
| Metric | Samples | Min | Avg | P95 | Max |
|---|---:|---:|---:|---:|---:|
| Agent login | 10 | 164 | 366 | 1153 | 1153 |
| Agent socket connect | 10 | 392 | 634 | 1416 | 1416 |
| Visitor session create | 10 | 126 | 226 | 711 | 711 |
| Visitor socket connect | 10 | 440 | 654 | 1540 | 1540 |
| Visitor message REST | 10 | 94 | 151 | 214 | 214 |
| Agent push latency (visitorMessage) | 0 | - | - | - | - |
| Visitor push latency (chat.message) | 6 | -461 | -433 | -381 | -381 |

---

## Interpretation

- **Socket connect success** measures whether WebSocket/polling connections survive under concurrent load.
- **Agent `crm.chat.visitorMessage`** confirms real-time push from visitor REST message to agent UI layer.
- **Visitor `chat.message`** confirms agent replies are pushed back over socket.io (requires agent to accept/reply during test).
- This test complements the JMeter HTTP report — together they cover REST APIs **and** the real-time socket layer.

---

## Source Data
- Raw JSON: `socket-results-2026-07-08T04-27-55-280Z.json`

## How to Re-run
```bash
cd realtime-load-test
npm install
npm run probe          # single connectivity check
npm test               # default 10 agents + 10 visitors
npm run test:light     # 5 + 5
npm run test:medium      # 20 visitors + 10 agents
```
