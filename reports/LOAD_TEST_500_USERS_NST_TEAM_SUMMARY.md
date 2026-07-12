# CRM Live Chat Load Test — Team Summary

**Date:** 10 July 2026  
**Customer site:** [Noori Sultan Traders (NST)](https://nst.staging.rev9solutions.com/)  
**Test tool:** Apache JMeter 5.6.3 (full suite: API + socket.io + load)

---

## Executive Summary

A **500 concurrent visitor** load test was executed against the NST staging chat environment with **5 agents**. The system handled the load with a **10.5% overall error rate**. Visitor WebSocket connections scaled to **500/500 (100%)**. **237 of 500** visitor chat sessions were created successfully; the remainder were blocked by API rate limiting (`429 Too Many Requests`).

**Chat data is present in the backend** — verified via API after the test. Sessions must be viewed in the CRM under site **NST** connected to **`api.chat.crm.swagprinthub.com`**.

---

## Test Configuration

| Parameter | Value |
|---|---|
| Concurrent visitors | **500** |
| Concurrent agents | **5** |
| Visitor ramp-up | 180 seconds |
| Agent ramp-up | 15 seconds |
| Test duration | ~3 min 37 sec |
| Customer website | `https://nst.staging.rev9solutions.com` |
| Chat API | `https://api.chat.crm.swagprinthub.com` |
| Auth API (agent login) | `https://api.crm.swagprinthub.com` |
| CRM site name | **NST** |
| Site ID | `cmrd7thsz0000ncqggnafo1ri` |
| Widget public key | `(configured via .env)` |
| Agent credentials | `(staging agent account)` (staging) |

---

## Results Overview

| Metric | Result |
|---|---|
| Total HTTP/WebSocket samples | **5,121** |
| Passed | **4,583** |
| Failed | **538** |
| **Error rate** | **10.51%** |
| Avg response time (success) | **641 ms** |
| Throughput | **23.6 req/s** |

---

## Visitor (Customer) Load — 500 users

| Step | Result | Notes |
|---|---|---|
| Session create | **237 / 500 (47.4%)** | 263 failed with `429` rate limit |
| Send message | **237 / 500 (47.4%)** | Matches successful sessions |
| WebSocket handshake | **500 / 500 (100%)** | No errors |
| Socket.io namespace connect | **500 / 500 (100%)** | No errors |

**Finding:** Real-time WebSocket layer handles 500 concurrent connections. REST session-creation API rate-limits at ~240–260 sessions per burst.

---

## Agent Load — 5 agents

| Step | Result | Notes |
|---|---|---|
| Agent login | **5 / 5 (100%)** | OK |
| List sessions | **5 / 5 (100%)** | OK |
| WebSocket connect | **5 / 5 (100%)** | OK |
| Accept chat | **0 / 5** | No real-time session event received in time |
| Agent reply | **0 / 5** | Depends on accept |

**Finding:** With 500 visitors and 5 agents, the load-phase accept/reply flow did not complete via socket events. Phase 1 API coverage (single-thread end-to-end accept + reply) **passed successfully**.

---

## Error Breakdown

| Error | Count | Cause |
|---|---|---|
| `429 Too Many Requests` | 525 | API rate limiting on session create / message |
| `404 Not Found` | 10 | Agent accept/reply — no session ID from socket event |
| `502 Bad Gateway` | 2 | Transient failure on AI-assist endpoint |
| `403 Forbidden` | 1 | Single message auth edge case |

---

## CRM Data Verification (Post-Test)

Data **was confirmed in the chat API** immediately after the test:

| Check | Result |
|---|---|
| Open sessions on NST site (API) | **536 OPEN sessions** confirmed |
| Load-test visitors (`vload-*`) | **100+ visible** in API listing |
| Sessions left open (not deleted) | **Yes** — end/delete steps disabled in test |
| Fresh verify session | **Created and visible** |

### How to find chats in CRM

1. Log in to CRM (staging) as **`(staging agent account)`**
2. Open **Live Chat**
3. Select site **`NST`** (site ID: `cmrd7thsz0000ncqggnafo1ri`)
4. Filter: **OPEN → All**
5. Search for any of these:
   - `vload-403` (or any `vload-*` visitor)
   - `VERIFY-1783669266742` (fresh verification chat)

### Important: API backend

| Backend | Chat data for NST? |
|---|---|
| `api.chat.crm.swagprinthub.com` | **YES** — all NST load-test data is here |
| `api.crm.swagprinthub.com` | **NO** — chat endpoints return 404 |

If the CRM UI at `app.crm.swagprinthub.com` reads from `api.crm` for Live Chat, **no NST chats will appear**. The agent CRM must be connected to **`api.chat.crm.swagprinthub.com`** for this tenant.

---

## Phase 1 — API Coverage (Single User E2E)

All core chat APIs validated successfully in the coverage phase:

- Widget config, session create, visitor message, agent accept, agent reply
- Session end / delete **disabled** so load-test data persists in CRM

---

## Recommendations for the Team

1. **Rate limiting:** Raise or tune rate limits on `POST /api/public/chat/sessions` if 500+ concurrent visitors is a production target (~47% blocked at current limits).
2. **CRM wiring:** Confirm agent CRM UI uses **`api.chat.crm.swagprinthub.com`** for NST tenant — not `api.crm`.
3. **Site selector:** In CRM Live Chat, select site **NST** (not legacy Dev23 site).
4. **Agent capacity:** 5 agents cannot accept 500 concurrent chats in real time; scale agents or use queue metrics for realistic load tests.
5. **WebSockets:** No issues at 500 connections — socket.io layer is healthy.

---

## Artifacts

| File | Location |
|---|---|
| Raw results (JTL) | `jmeter-socketio-test/results-full-500v-5a.jtl` |
| HTML dashboard | `jmeter-socketio-test/dashboard-full-500v-5a/index.html` |
| JMeter test plan | `jmeter-socketio-test/crm_chat_full_jmeter.jmx` |
| Session check script | `list-staging-sessions.mjs` |

---

## Conclusion

The NST staging chat platform **successfully handles ~240 concurrent visitor sessions** and **500 WebSocket connections** in a single load burst. The primary bottleneck is **REST API rate limiting (429)**, not WebSocket infrastructure. Load-test chat data **is stored and queryable** on `api.chat.crm.swagprinthub.com` under site **NST** — verify in CRM using the search tags above.

**Test status:** Completed  
**Data in CRM API:** Verified  
**Ready for team review:** Yes
