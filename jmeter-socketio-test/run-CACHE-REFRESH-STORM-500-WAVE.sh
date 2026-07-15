#!/bin/bash
# =============================================================================
# CACHE_REFRESH_STORM_500_USERS_WAVE
# =============================================================================
# JMeter plan: CACHE_REFRESH_STORM_500_USERS_WAVE.jmx
#
# Scenario: Many users refresh the website at the same time (F5 storm).
# Verifies the cache layer can absorb concurrent traffic and the public API
# survives concurrent identical GETs without failing.
#
# Default: 500 total users = 5 waves × 100 users, short ramp (near-simultaneous),
# 3 refresh loops per user, 60s pause between waves.
# =============================================================================
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$DIR/load-env.sh"

JMX="$DIR/CACHE_REFRESH_STORM_500_USERS_WAVE.jmx"

TOTAL_USERS="${TOTAL_USERS:-500}"
WAVES="${WAVES:-5}"
USERS_PER_WAVE="${USERS_PER_WAVE:-$((TOTAL_USERS / WAVES))}"
# Short ramp = many refreshes nearly at once (thundering herd / cache stampede)
REFRESH_RAMP="${REFRESH_RAMP:-5}"
REFRESH_LOOPS="${REFRESH_LOOPS:-3}"
WAVE_PAUSE="${WAVE_PAUSE:-60}"

# Website under cache (defaults from visitor_origin)
WEBSITE_HOST="${WEBSITE_HOST:-}"
if [[ -z "$WEBSITE_HOST" && -n "${VISITOR_ORIGIN:-}" ]]; then
  WEBSITE_HOST="${VISITOR_ORIGIN#https://}"
  WEBSITE_HOST="${WEBSITE_HOST#http://}"
  WEBSITE_HOST="${WEBSITE_HOST%%/*}"
fi
WEBSITE_HOST="${WEBSITE_HOST:-nst.staging.rev9solutions.com}"
WEBSITE_PROTOCOL="${WEBSITE_PROTOCOL:-https}"
WEBSITE_PATH="${WEBSITE_PATH:-/}"

RESULTS_DIR="$DIR/results-CACHE_REFRESH_STORM_500"
MERGED="$RESULTS_DIR/results-CACHE_REFRESH_STORM_500-merged.jtl"
DASHBOARD="$DIR/dashboard-CACHE_REFRESH_STORM_500"
LOG="$DIR/run-CACHE_REFRESH_STORM_500-$(date +%Y%m%d-%H%M%S).log"

export JVM_ARGS="${JVM_ARGS:--Xms512m -Xmx2g -XX:+UseG1GC}"
ulimit -n 16384 2>/dev/null || true
mkdir -p "$RESULTS_DIR"

run_jmeter() {
  jmeter -n -t "$JMX" \
    "${JMETER_CREDS_ARGS[@]}" \
    -Jwebsite_host="$WEBSITE_HOST" \
    -Jwebsite_protocol="$WEBSITE_PROTOCOL" \
    -Jwebsite_path="$WEBSITE_PATH" \
    -Jvisitor_api_host="${VISITOR_API_HOST:-api.chat.crm.swagprinthub.com}" \
    -Jvisitor_origin="${VISITOR_ORIGIN:-https://nst.staging.rev9solutions.com}" \
    -Jwidget_public_key="${WIDGET_PUBLIC_KEY:-}" \
    "$@"
}

{
  echo "============================================================"
  echo " CACHE REFRESH STORM — 500 USERS (WAVE)"
  echo "============================================================"
  echo "JMX:           $JMX"
  echo "Website:       ${WEBSITE_PROTOCOL}://${WEBSITE_HOST}${WEBSITE_PATH}"
  echo "Cached API:    https://${VISITOR_API_HOST:-api.chat.crm.swagprinthub.com}/api/public/chat/sites/\$KEY/config"
  echo "Total users:   $TOTAL_USERS = $WAVES waves × $USERS_PER_WAVE"
  echo "Ramp/wave:     ${REFRESH_RAMP}s (short = simultaneous refresh)"
  echo "Loops/user:    $REFRESH_LOOPS refreshes each"
  echo "Wave pause:    ${WAVE_PAUSE}s"
  echo "Results:       $MERGED"
  echo "Dashboard:     $DASHBOARD/index.html"
  echo "============================================================"
  echo ""

  rm -f "$MERGED"
  rm -rf "$DASHBOARD"

  for ((wave = 1; wave <= WAVES; wave++)); do
    WAVE_JTL="$RESULTS_DIR/wave-${wave}.jtl"
    rm -f "$WAVE_JTL"
    echo "---- Wave $wave / $WAVES ($USERS_PER_WAVE concurrent refreshers) ----"
    run_jmeter \
      -Jrefresh_threads="$USERS_PER_WAVE" \
      -Jrefresh_ramp="$REFRESH_RAMP" \
      -Jrefresh_loops="$REFRESH_LOOPS" \
      -l "$WAVE_JTL"

    if [[ $wave -lt $WAVES ]]; then
      echo "Cooling down ${WAVE_PAUSE}s before next wave..."
      sleep "$WAVE_PAUSE"
    fi
  done

  echo ""
  echo "Merging wave results..."
  python3 "$DIR/merge-jtl.py" "$RESULTS_DIR"/wave-*.jtl -o "$MERGED"
  echo "Generating dashboard..."
  jmeter -g "$MERGED" -o "$DASHBOARD"

  echo ""
  echo "Done."
  echo "Merged JTL: $MERGED"
  echo "Dashboard:  $DASHBOARD/index.html"
  echo ""
  echo "How to judge cache:"
  echo "  - Compare latency of REPRESH API 1st vs 2nd hit (2nd should be similar/faster when cached)"
  echo "  - Check CDN/app metrics: origin RPS should stay flat while client refresh RPS rises"
  echo "  - Inspect Age / X-Cache / CF-Cache-Status headers in detailed view if enabled"
} 2>&1 | tee "$LOG"
