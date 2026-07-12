# CRM Live Chat — Maximum Load Test (1000 Concurrent Users)

## Profile
| Parameter | Value |
|---|---|
| Agents | **500** |
| Visitors | **500** |
| **Total concurrent users** | **1000** |
| Ramp-up | 180s (3 min) |
| Hold per connection | 30s |
| Login stagger | 200ms between agent logins |
| Phase | Load only (socket.io + REST) |
| Duration | ~187s (~3m 7s) |
| Environment | Staging (`api.crm.swagprinthub.com`) |
| Date | 2026-07-08 |

---

## Results Summary

| Action | Success | Total | Rate |
|---|---:|---:|---:|
| Agent login | 30 | 500 | **6.0%** |
| Agent socket connect | 30 | 30 | 100% |
| Visitor session create | 239 | 500 | **47.8%** |
| Visitor socket connect | 177 | 239 | 74.1% |
| Visitor message (REST) | 119 | 177 | 67.2% |
| Agent accept (events) | 848 | 849 | 99.9% |
| Agent reply | 722 | 723 | 99.9% |
| Reply pushed to visitor (socket) | 6 | 177 | **3.4%** |

---

## Latencies (ms)

| Metric | Count | Min | Avg | P95 | Max |
|---|---:|---:|---:|---:|---:|
| Agent login | 500 | 134 | 1899 | 15138 | 16811 |
| Agent socket connect | 30 | 642 | 1867 | 3877 | 4024 |
| Visitor session create | 500 | 135 | 1159 | 7663 | 16741 |
| Visitor socket connect | 177 | 599 | 3121 | 13811 | 20420 |
| Reply push latency | 6 | 1 | 1791 | 7966 | 7966 |

---

## Comparison Across Load Levels

| Metric | 8+8 | 50+50 | **500+500** |
|---|---:|---:|---:|
| Agent login success | 50% | 26% | **6%** |
| Visitor session success | 100% | 100% | **47.8%** |
| Visitor socket success | 100% | 100% | **74%** (of sessions) |
| Reply push to visitor | 62.5% | 26% | **3.4%** |

---

## Root Causes at 1000 Users

### 1. Agent login rate limiting (critical)
- **470 of 500** agent logins failed (94%)
- Same admin account (`admins@local.dev`) used for all 500 agent threads
- Login endpoint returns **429 Too Many Requests** under burst load
- Only **30 agents** authenticated; those 30 worked at 100% socket connect

### 2. Visitor API saturation
- Session create dropped to **47.8%** (261 failures)
- Likely mix of timeouts, connection resets, and server overload
- P95 session create latency: **7.6s** (vs ~300ms at 50 users)

### 3. Socket connection pressure
- **62 visitor socket connects failed** (timeouts at 20s)
- P95 visitor socket connect: **13.8s**, max **20.4s**
- 1000 concurrent WebSocket connections from a single machine also stresses local OS limits

### 4. Real-time push collapse
- Only **6 of 177** visitors received agent reply via socket (3.4%)
- Downstream effect: few agents logged in + race conditions + connection drops

---

## What Still Worked
- The **30 agents that logged in** connected sockets at **100%** and accept/reply at **~100%**
- **239 visitor sessions** were created successfully under extreme load
- Core chat logic remains functional when the system is not overloaded

---

## Recommendations Before Re-testing at 1000 Users

1. **Use 50–100 separate agent accounts** (not one shared admin) to avoid login 429
2. **Run from multiple load generators** (not one laptop) to avoid local file-descriptor limits
3. **Stepped ramp**: 100 → 250 → 500 → 1000 to find the breaking point
4. **Monitor server**: CPU, memory, DB connections, socket.io adapter during test
5. **Increase staging resources** if this level is a production target

---

## Raw Data
- `results/complete-results-2026-07-08T06-48-55-382Z.json`
- `results/load-1000-users.log`
