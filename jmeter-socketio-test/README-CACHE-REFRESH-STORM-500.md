# CACHE REFRESH STORM — 500 Users (Wave)

**File (look for this name):** `CACHE_REFRESH_STORM_500_USERS_WAVE.jmx`  
**Runner:** `./run-CACHE-REFRESH-STORM-500-WAVE.sh`

## What this tests

Users often refresh the website many times. Each refresh can hit the server. With a **cache layer**, repeated requests should not always hit origin.

This plan simulates **many users refreshing at once** (short ramp = near-simultaneous) so you can check:

1. Can the site/API survive concurrent refresh traffic?
2. Does the **same public config API** stay healthy when hit repeatedly?
3. Is the 2nd immediate request as fast/stable as the first (cache benefit)?

## Flow per virtual user

1. **GET website page** (simulates browser F5 on NST staging)
2. **GET** `/api/public/chat/sites/{widgetKey}/config` (typical cached public API)
3. **GET same API again** immediately (cache re-hit check)
4. Repeat **3 loops** (multiple refreshes)

**Phase 0** warms cache once before the storm.

## Default wave profile

| Setting | Value |
|---|---|
| Total users | **500** |
| Waves | **5 × 100** |
| Ramp per wave | **5 seconds** (near-simultaneous) |
| Refresh loops | **3** per user |
| Pause between waves | **60 seconds** |

## How to run

```bash
cd jmeter-socketio-test
chmod +x run-CACHE-REFRESH-STORM-500-WAVE.sh
./run-CACHE-REFRESH-STORM-500-WAVE.sh
```

Optional overrides:

```bash
TOTAL_USERS=500 WAVES=5 USERS_PER_WAVE=100 REFRESH_RAMP=3 REFRESH_LOOPS=5 \
  WEBSITE_HOST=nst.staging.rev9solutions.com \
  ./run-CACHE-REFRESH-STORM-500-WAVE.sh
```

Uses `../.env` for `WIDGET_PUBLIC_KEY`, `VISITOR_ORIGIN`, `VISITOR_API_HOST`.

## Results

- `results-CACHE_REFRESH_STORM_500/results-CACHE_REFRESH_STORM_500-merged.jtl`
- `dashboard-CACHE_REFRESH_STORM_500/index.html`

## Open in JMeter GUI

```bash
jmeter -t CACHE_REFRESH_STORM_500_USERS_WAVE.jmx
```

## Note

Chat **session create** is intentionally **not** in this plan (not a shared-cache resource). For chat capacity, use `crm_chat_full_jmeter_1000.jmx` / `run-1000-load.sh`.
