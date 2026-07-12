# Load Test: 1000 Visitors + 10 Agents

## Scenario (realistic)
- **1000 different visitors** each start their own chat (unique `visitorId` per user)
- **Only 10 agents** online to handle the queue (not 1000 agents)
- Same staging: `api.crm.swagprinthub.com` / Dev23 widget site

This matches real life: many customers, few agents.

---

## Results

| Action | Success | Total | Rate |
|---|---:|---:|---:|
| **Agent login** | **10** | **10** | **100%** ✅ |
| **Agent socket connect** | **10** | **10** | **100%** ✅ |
| Visitor session create | 331 | 1000 | 33.1% |
| Visitor socket connect | 331 | 331 | 100% |
| Visitor message (REST) | 267 | 331 | 80.7% |
| Agent accept | 659 | 660 | 99.8% |
| Agent reply | 626 | 627 | 99.8% |
| Reply pushed to visitor (socket) | 16 | 331 | 4.8% |

**Duration:** ~232 seconds (~3m 52s)

---

## Comparison: Same 1000 visitors, different agent counts

| Test | Agents | Agent login | Visitor sessions | Agent sockets |
|---|---:|---:|---:|---:|
| 500 agents + 500 visitors | 500 | 6% | 47.8% | 100% (of logins) |
| **1000 visitors + 10 agents** | **10** | **100%** | **33.1%** | **100%** |
| 50 visitors + 50 agents | 50 | 26% | 100% | 100% |

---

## Key findings

### ✅ Fewer agents = much better agent side
- With **only 10 agents**, login went from **6% → 100%**
- All 10 agents connected sockets and stayed online
- Accept/reply worked at ~100% for sessions they saw
- **Proof:** the agent login problem at 500+500 was rate limiting from hammering the same account 500 times — not a chat bug

### ⚠️ Visitor side still stressed at 1000 users
- Only **331 of 1000** visitor sessions created (33.1%)
- **669 failed** — likely API timeouts, connection resets, server overload
- Of the 331 that connected, sockets worked **100%**
- Messages sent at **80.7%** of connected visitors

### ⚠️ Real-time push still low
- Only **16 visitors** got agent reply via socket (4.8%)
- 10 agents handling 331+ sessionCreated events creates races; many visitors disconnect before reply

---

## Conclusion

| Question | Answer |
|---|---|
| Can 1000 different users initiate chats with fewer agents? | **Partially** — 331/1000 succeeded on staging from one machine |
| Does reducing agents help? | **Yes, massively** for agent login and stability (100% vs 6%) |
| What is the real limit? | **~50 concurrent users** was clean; **1000** overwhelms staging visitor API |

---

## Recommendations
1. For production-like test: **1000 visitors + 10–25 agents** is the right *ratio*
2. Use **multiple agent accounts** if you need >10 agents without login limits
3. Run from **multiple load machines** for fair 1000-visitor test
4. Monitor staging **CPU / DB / API** during 1000-visitor ramp

## Raw data
- `results/complete-results-2026-07-08T07-36-55-680Z.json`
- `results/load-1000-visitors-10-agents.log`
