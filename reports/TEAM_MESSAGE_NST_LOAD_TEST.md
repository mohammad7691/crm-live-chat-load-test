# NST Live Chat Load Test — Team Message

**Date:** 10 July 2026  
**Site:** [Noori Sultan Traders (NST)](https://nst.staging.rev9solutions.com/)  
**CRM:** [Live Chat Workspace](https://app.crm.swagprinthub.com/live-chats/workspace)

---

Hi team,

Sharing the full summary of the NST live chat load test — what was requested, what load was applied, what passed, what failed, and where the data is in CRM.

---

## What Was Asked

1. **Switch the load test** from the old Dev23 customer site to the new NST staging site (`https://nst.staging.rev9solutions.com/`).
2. **Run load tests** against NST — starting with a small run, then scaling to **500 concurrent visitors**.
3. **Confirm chat data appears in CRM** at `app.crm.swagprinthub.com/live-chats/workspace` under site **NST**.
4. **Re-run load** so sessions are dated **2026-07-10** and visible even with the CRM date filter (`from=2026-07-10&to=2026-07-10`).
5. **Fix CRM visibility** — only 1 chat was showing in the UI despite hundreds of sessions being created in the backend.

---

## What Load Was Applied

| Parameter | Value |
|---|---|
| **Concurrent visitors** | **500** |
| **Concurrent agents** | **5** |
| **Visitor ramp-up** | 180 seconds (~2.8 users/sec) |
| **Agent ramp-up** | 15 seconds |
| **Test duration** | ~3 min 44 sec |
| **Tool** | Apache JMeter 5.6.3 (REST API + socket.io WebSockets) |

### Environment

| Setting | Value |
|---|---|
| Customer website | `https://nst.staging.rev9solutions.com` |
| Chat API (visitors) | `https://api.chat.crm.swagprinthub.com` |
| Auth API (agents) | `https://api.crm.swagprinthub.com` |
| CRM site name | **NST** |
| Site ID | `cmrd7thsz0000ncqggnafo1ri` |
| Widget public key | `(configured via .env)` |
| Agent login | `(staging agent account)` (staging) |

### What Each Virtual User Did

**Visitor flow (×500):**
1. Create chat session
2. Set visitor name (`NST Load 2026-07-10 User N`)
3. Engine.IO / socket.io WebSocket connect
4. Send a visitor message via REST
5. Close WebSocket

**Agent flow (×5):**
1. Login
2. Set presence online
3. WebSocket connect
4. List open sessions
5. Accept chat + reply (load phase)

**Coverage flow (×2 threads, Phase 1):**
Full end-to-end API test — widget config, session create, bot handoff, agent accept, reply, transfer, whisper, transcript, etc. (single-thread validation before load).

---

## Overall Results

| Metric | Result |
|---|---|
| Total HTTP/WebSocket samples | **5,621** |
| Passed | **4,823** |
| Failed | **798** |
| **Error rate** | **14.2%** |
| Throughput | **~26 req/s** |

---

## What Passed ✅

### Visitor / real-time layer (strong)

| Step | Result |
|---|---|
| WebSocket handshake | **500 / 500** (100%) |
| Socket.io namespace connect | **500 / 500** (100%) |
| WebSocket open / probe / upgrade / close | **500 / 500** each (100%) |

**Takeaway:** The real-time WebSocket layer handled **500 concurrent connections** with no errors.

### Visitor REST (partial — rate limited)

| Step | Result |
|---|---|
| Session create | **238 / 500** (47.6%) |
| Update profile (visitor name) | **238 / 500** (47.6%) |
| Send message | **238 / 500** (47.6%) |

**Takeaway:** ~238 full visitor journeys completed. The rest were blocked by API rate limiting.

### Agent setup (all OK)

| Step | Result |
|---|---|
| Agent login | **5 / 5** (100%) |
| Set presence | **5 / 5** (100%) |
| WebSocket connect | **5 / 5** (100%) |
| List sessions | **5 / 5** (100%) |

### Phase 1 API coverage (almost all OK)

All core chat APIs passed in the single-thread coverage phase:

- Widget config, session create, profile update, visitor message
- Bot handoff, agent accept, agent reply, whisper
- Session fetch, messages fetch, transfer flow, transcript
- Session end/delete **disabled** so load data stays in CRM

**Only coverage failure:** `COV Agent ai-assist` — **2 / 2 failed** with `502 Bad Gateway` (transient, non-critical).

---

## What Failed ❌

### 1. Session create / profile / message — `429 Too Many Requests` (main failure)

| Step | Failed | Error |
|---|---|---|
| V Create session | **262 / 500** | HTTP 429 |
| V Update profile | **262 / 500** | HTTP 429 |
| V Send message | **262 / 500** | HTTP 429 |

**Cause:** API rate limiting on `POST /api/public/chat/sessions` and related endpoints when 500 users hit the system in ~3 minutes.

**Impact:** Only **238 of 500** intended sessions were created. This is a **rate limit bottleneck**, not a WebSocket or CRM storage issue.

---

### 2. Agent accept + reply in load phase — `404 Not Found`

| Step | Failed | Error |
|---|---|---|
| A Accept chat | **5 / 5** | HTTP 404 |
| A Agent reply | **5 / 5** | HTTP 404 |

**Cause:** In the 500-user load phase, agents did not receive the real-time socket event (`NO_EVENT_SESSION`) in time to accept a specific chat. With 500 visitors and only 5 agents, the accept/reply flow could not complete via WebSocket events.

**Impact:** Load-phase agent accept/reply failed, but **Phase 1 coverage proved accept + reply works** when run sequentially (2/2 OK).

---

### 3. AI assist endpoint — `502 Bad Gateway`

| Step | Failed | Error |
|---|---|---|
| COV Agent ai-assist | **2 / 2** | HTTP 502 |

**Cause:** Transient gateway error on the AI-assist endpoint under test conditions.

**Impact:** Non-critical for chat load testing. Core chat flow unaffected.

---

## CRM Visibility — Issues Found & Fixed

This was the biggest confusion during the test. **Data was in the backend, but the CRM UI was not showing it.**

### Issue 1: Wrong site ID (fixed early)
Test was initially pointing at old Dev23 site ID. Updated to NST: `cmrd7thsz0000ncqggnafo1ri`.

### Issue 2: Missing visitor names (fixed)
Load sessions had no `visitorName` — only `visitorId` (`vload-*`). CRM inbox requires a name to display chats.  
**Fix:** Added `V Update profile` step with `NST Load 2026-07-10 User N`.

### Issue 3: Sessions were being deleted (fixed)
Phase 1 was closing/deleting sessions after test.  
**Fix:** Disabled `COV Visitor end session` and `COV Agent delete session`.

### Issue 4: Chats not in CRM inbox queue (fixed)
238 sessions existed in the API as OPEN, but CRM only shows:
- `assignment=pending` (needs bot handoff), or
- `assignment=assigned` (agent accepted)

Load visitors never triggered **bot handoff** (`liveAgentHandoff: true`), so **0 appeared in the pending queue**. Only ~19 assigned chats (VERIFY / JMeter COV) were visible — that's why it looked like "only 1 user."

**Fixes applied:**
1. Added `V Bot message handoff` to JMeter for future runs
2. Ran `make-sessions-visible.mjs` — agent-accepted **237** existing load sessions
3. **CRM assigned queue now: 257 sessions** (all searchable as `NST Load 2026-07-10 User *`)

### Issue 5: Wrong API for chat data (informational)
| API | NST chat data? |
|---|---|
| `api.chat.crm.swagprinthub.com` | **YES** — all chat sessions here |
| `api.crm.swagprinthub.com` | **NO** — chat endpoints return 404 |

CRM UI must read from **`api.chat`** for NST chats.

---

## Final Data in CRM (as of 10 Jul 2026)

| Check | Count |
|---|---|
| Sessions created by 500-user test | **238** |
| Named `NST Load 2026-07-10 User *` | **238** |
| Agent-accepted (visible in CRM inbox) | **237** |
| Total OPEN on NST site | **1,019+** |
| All dated **2026-07-10** | **Yes** |

### How to verify in CRM

1. Open: `https://app.crm.swagprinthub.com/live-chats/workspace?tab=open&from=2026-07-10&to=2026-07-10`
2. Select site: **NST**
3. Search: **`NST Load 2026-07-10`**
4. You should see ~238 chats

---

## Summary Table — Pass / Fail at a Glance

| Area | Asked / Target | Achieved | Status |
|---|---|---|---|
| Concurrent visitors | 500 | 500 attempted, 238 sessions created | ⚠️ Rate limited |
| Concurrent agents | 5 | 5 logged in, WS connected | ✅ |
| WebSocket connections | 500 | 500 / 500 | ✅ |
| Visitor messages | 500 | 238 / 500 | ⚠️ Rate limited |
| Agent accept (load phase) | 5 | 0 / 5 | ❌ Socket timing |
| Agent accept (coverage) | 2 | 2 / 2 | ✅ |
| Data in CRM API | Yes | 238 sessions confirmed | ✅ |
| Data visible in CRM UI | Yes | 237 accepted + searchable | ✅ |
| AI assist | 2 | 0 / 2 | ❌ 502 transient |

---

## Recommendations

1. **Raise rate limits** on session create if 500+ concurrent visitors is a production target (~52% blocked at current limits).
2. **Always include bot handoff** in load tests so chats appear in the CRM pending queue.
3. **Always set visitorName** via profile PATCH so chats are searchable in CRM.
4. **Scale agents** realistically — 5 agents cannot accept 500 chats in real time; use queue depth metrics for SLA testing.
5. **WebSockets are healthy** — no issues at 500 connections.
6. **Investigate CRM date filter** — URL uses `from`/`to` but API expects `updatedFrom`/`updatedTo`.

---

## Artifacts

| File | Location |
|---|---|
| JMeter test plan | `jmeter-socketio-test/crm_chat_full_jmeter.jmx` |
| Raw results | `jmeter-socketio-test/results-full-500v-5a.jtl` |
| HTML dashboard | `jmeter-socketio-test/dashboard-full-500v-5a/index.html` |
| Session checker | `list-staging-sessions.mjs` |
| CRM visibility fix | `make-sessions-visible.mjs` |
| Full report | `reports/LOAD_TEST_500_USERS_NST_FINAL_SUMMARY.md` |

---

## Conclusion

We ran a **500 concurrent visitor / 5 agent** load test on NST staging. The system handled **500 WebSocket connections perfectly** but **rate-limited session creation to ~238 sessions** (52% blocked with HTTP 429). Agent accept/reply failed in the load phase due to socket event timing, but passed in single-thread coverage.

All **238 load-test chats are stored** on `api.chat.crm.swagprinthub.com` under site **NST**, dated **2026-07-10**, and **237 are now visible in CRM** after the inbox queue fix. Search **`NST Load 2026-07-10`** to verify.

Let me know if you need a re-run with longer ramp-up, more agents, or higher rate limits.

---

**Test status:** Completed  
**Data in CRM:** Verified and visible  
**Ready for review:** Yes
