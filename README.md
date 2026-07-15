# CRM Live Chat — Load & API Test Suite

Portfolio project: **performance and API testing** for a CRM live chat platform using **Apache JMeter**, **REST APIs**, and **Socket.IO / WebSocket** real-time messaging.

**GitHub (this repo):** [mohammad7691/crm-live-chat-load-test](https://github.com/mohammad7691/crm-live-chat-load-test)  
**Playwright E2E (separate repo):** [mohammad7691/crm-playwright-e2e](https://github.com/mohammad7691/crm-playwright-e2e)

## What this project does

Simulates real customer and agent behavior under load:

| Role | Flow |
|---|---|
| **Visitor** | Create chat session → set profile → WebSocket connect → send message → bot handoff to live agent |
| **Agent** | Login (JWT) → set presence → WebSocket connect → list pending chats → accept → reply |

Tested at **200, 500, and 1000 concurrent users** with ramp-up tuning, wave execution, and HTML/JTL result analysis.

## Key results (staging)

| Metric | Result |
|---|---|
| WebSocket connect (500 users) | **498 / 500** (99.6%) |
| Session create (500 burst) | **238 / 500** — limited by HTTP 429 rate limiting |
| Session create (1000 wave mode) | **998 / 1000** |
| Main finding | Backend stable; failures mostly **rate limits** and **timeouts**, not crashes |

Full reports: [`reports/`](reports/) — see `LOAD_TEST_500_USERS_NST_FINAL_SUMMARY.md`

## Tech stack

- Apache JMeter 5.6 + WebSocket Samplers plugin
- Engine.IO v4 / Socket.IO over WebSocket
- Node.js helper scripts (session verification, CRM visibility)
- Bash orchestration (wave mode, distributed JMeter support)

## Quick start

### 1. Prerequisites

- [Apache JMeter](https://jmeter.apache.org/) 5.6+
- Java 11+
- Node.js 18+ (for helper scripts)

### 2. Configure credentials

```bash
cp .env.example .env
# Edit .env with your staging agent emails, passwords, and widget public key
```

**Never commit `.env`** — it is in `.gitignore`.

### 3. Run JMeter load test (1000-user wave plan)

This repo keeps the **wave / 1000-user chat** JMeter plan plus a separate **cache refresh storm** plan.

```bash
cd jmeter-socketio-test
chmod +x run-1000-load.sh run-CACHE-REFRESH-STORM-500-WAVE.sh

# Live chat capacity (wave / 1000)
./run-1000-load.sh

# Website cache / concurrent page-refresh storm (500 users in waves)
./run-CACHE-REFRESH-STORM-500-WAVE.sh
```

Default chat waves: **5 × 200 users = 1000** (90s pause).

500 chat users in waves:

```bash
TOTAL_USERS=500 WAVES=5 USERS_PER_WAVE=100 ./run-1000-load.sh
```

Results:
- Chat: `dashboard-1000/index.html`
- Cache storm: `dashboard-CACHE_REFRESH_STORM_500/index.html`

Details:
- [`jmeter-socketio-test/README-1000-LOAD.md`](jmeter-socketio-test/README-1000-LOAD.md)
- [`jmeter-socketio-test/README-CACHE-REFRESH-STORM-500.md`](jmeter-socketio-test/README-CACHE-REFRESH-STORM-500.md)

## Project structure

```
crm-live-chat-load-test/
├── jmeter-socketio-test/
│   ├── crm_chat_full_jmeter_1000.jmx              # Chat wave / 1000-user load
│   ├── run-1000-load.sh
│   ├── CACHE_REFRESH_STORM_500_USERS_WAVE.jmx     # Concurrent page-refresh / cache test
│   ├── run-CACHE-REFRESH-STORM-500-WAVE.sh
│   ├── merge-jtl.py
│   └── load-env.sh
├── jmeter-plugins/                    # WebSocket Samplers JAR
├── reports/                           # Test summaries and team reports
├── crm-playwright-tests/              # CRM UI E2E (scoped modules)
├── realtime-load-test/                # Legacy Node socket helpers
└── .env.example                       # Credential template
```

## Test phases (JMeter)

1. **Setup** — API coverage sanity check (all endpoints once)
2. **Visitors** — concurrent customer chat flow with WebSocket
3. **Agents** — concurrent agent login, accept, and reply (runs in parallel with visitors)

## My contribution

- Executed JMeter load tests at 200, 500, and 1000 concurrent users
- Configured thread counts, ramp-up, and parallel visitor/agent flows
- Analyzed JTL/HTML reports; documented 429 rate limits and WebSocket behavior
- Verified test data visibility in CRM staging environment
- Collaborated on test plan design for authenticated multi-step WebSocket flows

## License

Portfolio / educational use. Staging credentials and API hosts are not included in this repository.
