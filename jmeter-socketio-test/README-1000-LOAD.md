# 1000-User Load Test

Uses **copies only** — original `crm_chat_full_jmeter.jmx` and `run-full-jmeter.sh` are unchanged.

| File | Purpose |
|---|---|
| `crm_chat_full_jmeter_1000.jmx` | 1000-user plan (higher timeouts, throttling, wave IDs) |
| `run-1000-load.sh` | Orchestrator (wave or distributed mode) |
| `merge-jtl.py` | Merge wave JTL files |

## Why 1000 users timeout / 429 on one shot

- All traffic comes from **one public IP** → API `ThrottlerException` (429) after ~120–240 session creates
- 1000 parallel WebSockets + REST burst → **connection timeouts** on one machine
- Fix: **waves** + **throttle** + optional **distributed JMeter slaves**

## Quick start (wave mode — recommended)

```bash
cd jmeter-socketio-test
chmod +x run-1000-load.sh
./run-1000-load.sh
```

Default: **5 waves × 200 users** = 1000 total, **90s pause** between waves.

Customize:

```bash
TOTAL_USERS=1000 WAVES=10 USERS_PER_WAVE=100 WAVE_PAUSE=60 VISITOR_RAMP=90 ./run-1000-load.sh
```

Results: `results-1000/results-1000-merged.jtl` · `dashboard-1000/index.html`

## Distributed mode (load on multiple generator nodes / IPs)

On each slave machine:

```bash
jmeter-server
```

On controller (this machine):

```bash
export JMETER_REMOTE_HOSTS="10.0.0.2,10.0.0.3,10.0.0.4"
TOTAL_USERS=1000 VISITOR_RAMP=300 AGENT_THREADS=10 ./run-1000-load.sh
```

JMeter splits threads across slaves → **different source IPs** → higher session create success, load hits **all backend nodes** via load balancer.

## Agents

Uses both agent accounts (alternating threads). Set credentials in `.env` (see `.env.example`).

Set `AGENT_THREADS=10` (default) or higher with more agent accounts.
