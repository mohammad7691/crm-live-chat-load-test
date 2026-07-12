# CRM Live Chat Load Test Report — 50 Users

## Executive Summary
A scaled load test was executed with **50 concurrent visitors** and **50 concurrent agents** on staging (10× the previous 5+5 test).

**Result:** The system showed **stress under this load** with a **32.47% overall error rate**. Core chat actions still worked for successfully authenticated agents, but **login rate limiting (429)** and **API timeouts** became the main bottlenecks.

---

## Environment Tested
| Item | Value |
|---|---|
| Customer website | `https://dev23.wrist-band.com/` |
| CRM app | `https://app.crm.swagprinthub.com/` |
| CRM API | `https://api.crm.swagprinthub.com/` |
| Widget site | Dev23 (`ws_160f1b88ea46fb7118aea8a805f5c15c`) |
| Test tool | Apache JMeter 5.6.3 |

---

## Load Profile
| Parameter | Previous test | This test |
|---|---:|---:|
| Concurrent visitors | 5 | **50** |
| Concurrent agents | 5 | **50** |
| Ramp-up | 30s | **60s** |
| Loops per user | 10 | 10 |
| Peak concurrent users | 10 | **100** |
| Total HTTP requests | 510 | **4050** |
| Duration | ~2m 44s | **~5m 22s** |
| Throughput | ~3.1 req/s | **~12.6 req/s** |

---

## Overall Results
| Metric | 5+5 test | 50+50 test |
|---|---:|---:|
| Total samples | 510 | 4050 |
| Error rate | 4.31% | **32.47%** |
| Average response time | 865 ms | **2446 ms** |
| P95 | 3325 ms | **9836 ms** |
| P99 | 8525 ms | **35608 ms** |
| Max | 14662 ms | **78802 ms** |

---

## Per-Action Results (50+50 test)
| Action | Attempts | Failures | Success rate | Avg (ms) | P95 (ms) |
|---|---:|---:|---:|---:|---:|
| Visitor Home Page | 500 | 24 | 95.2% | 2633 | 6088 |
| CRM Widget Config | 500 | 68 | 86.4% | 1174 | 3359 |
| CRM Widget JS | 500 | 1 | 99.8% | 12384 | 39523 |
| Create Visitor Chat Session | 500 | 218 | 56.4% | 317 | 1261 |
| Send Visitor Message | 500 | 218 | 56.4% | 1162 | 3387 |
| CRM Login | 50 | 35 | **30.0%** | 1492 | 2853 |
| Set Agent Presence | 50 | 35 | **30.0%** | 396 | 1053 |
| Fetch Pending Sessions | 500 | 350 | **30.0%** | 520 | 1388 |
| Fetch Open Sessions | 500 | 350 | **30.0%** | 892 | 2817 |
| Accept Pending Chat | 150 | 15 | 90.0% | 478 | 1104 |
| Fetch Selected Messages | 150 | 0 | **100%** | 770 | 2494 |
| Send Agent Reply | 150 | 1 | **99.3%** | 567 | 1283 |

---

## Failure Analysis

### Failure breakdown by HTTP status
| Error | Count | Meaning |
|---|---:|---|
| 401 Unauthorized | 735 | Agent API calls without valid token after login failed |
| NoHttpResponseException | 302 | API server did not respond in time |
| 403 Forbidden | 218 | Visitor message sent without valid session token |
| 429 Too Many Requests | 35 | **Login rate limit hit** when 50 agents logged in |
| 500 Internal Server Error | 24 | Server errors on visitor homepage |

### Root causes

**1. Agent login rate limiting (critical)**
- 35 of 50 agent logins failed with `429 Too Many Requests`
- Only **15 agents** authenticated successfully
- The other 35 agents failed all subsequent API calls (350 × 401 errors)

**2. Visitor API pressure**
- 218 visitor session creates failed (timeouts + load)
- 218 visitor message sends failed as downstream 403 errors

**3. Performance degradation**
- Average response time increased from 865 ms → 2446 ms
- Widget JS P95 reached ~39.5 seconds under load

### What still worked
For the **15 agents that logged in successfully** (150 accept/reply cycles):
- Accept chat: **90%** success
- Fetch messages: **100%** success
- Agent reply: **99.3%** success

This shows the **chat logic itself still works** under load, but **authentication and API capacity** are the limiting factors at 50 users.

---

## Comparison: 5 users vs 50 users

| Area | 5 users | 50 users |
|---|---|---|
| Overall stability | Good (4.31% errors) | Stressed (32.47% errors) |
| Agent login | 100% success | 30% success (rate limited) |
| Visitor session create | 82% success | 56.4% success |
| Agent reply (when logged in) | 100% success | 99.3% success |
| Recommendation | Suitable for staging | Needs login scaling + higher API capacity before production |

---

## Deliverables
| File | Description |
|---|---|
| `loadtest/crm_chat_load_test.jmx` | Updated to 50+50 users |
| `loadtest/results/results.jtl` | Raw results |
| `loadtest/report/html/index.html` | JMeter HTML dashboard |
| `loadtest/report/LOAD_TEST_REPORT_50_USERS.md` | This report |

---

## Conclusion
At **50 concurrent visitors + 50 concurrent agents**, staging shows capacity limits:
1. **Login endpoint rate limiting** must be addressed for multi-agent load
2. **Public chat API** needs better handling under concurrent session creation
3. **Core accept/reply workflow remains functional** for authenticated agents

Recommended next steps:
- Stagger agent logins or increase rate limits for load testing
- Run a 20-user stepped test to find the breaking point
- Monitor API server CPU/memory/DB connections during load
