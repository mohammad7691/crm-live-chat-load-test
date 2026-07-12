#!/bin/bash
# 1000-user load test — wave mode (single IP) or distributed mode (multi-node generators).
# Original files untouched; uses crm_chat_full_jmeter_1000.jmx only.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$DIR/load-env.sh"
PLUGIN="$DIR/../jmeter-plugins/jmeter-websocket-samplers.jar"
JMX="$DIR/crm_chat_full_jmeter_1000.jmx"

# --- defaults tuned for 1000 users without timeout / 429 burst ---
TOTAL_USERS="${TOTAL_USERS:-1000}"
WAVES="${WAVES:-5}"
USERS_PER_WAVE="${USERS_PER_WAVE:-$((TOTAL_USERS / WAVES))}"
AGENT_THREADS="${AGENT_THREADS:-10}"
AGENT_RAMP="${AGENT_RAMP:-15}"
VISITOR_RAMP="${VISITOR_RAMP:-120}"
WAVE_PAUSE="${WAVE_PAUSE:-90}"
VISITOR_THROUGHPUT="${VISITOR_THROUGHPUT:-200}"

# Patch throughput in 1000 JMX copy (JMeter requires numeric literal in XML)
python3 - "$JMX" "$VISITOR_THROUGHPUT" <<'PY'
import re, sys
path, tp = sys.argv[1], sys.argv[2]
text = open(path).read()
text = re.sub(
    r'(<ConstantThroughputTimer[^>]*>.*?<name>throughput</name>\s*<value>)[^<]+(</value>)',
    rf'\g<1>{float(tp)}\g<2>',
    text,
    count=1,
    flags=re.S,
)
open(path, 'w').write(text)
PY

RESULTS_DIR="$DIR/results-1000"
MERGED="$RESULTS_DIR/results-1000-merged.jtl"
DASHBOARD="$DIR/dashboard-1000"

export JVM_ARGS="${JVM_ARGS:--Xms1g -Xmx4g -XX:+UseG1GC}"
ulimit -n 65536 2>/dev/null || ulimit -n 16384 2>/dev/null || true

mkdir -p "$RESULTS_DIR"

run_jmeter() {
  local extra_args=("$@")
  jmeter -n -t "$JMX" \
    -Jsearch_paths="$PLUGIN" \
    "${JMETER_CREDS_ARGS[@]}" \
    "${extra_args[@]}"
}

echo "CRM Chat 1000-User Load Test"
echo "============================"
echo "JMX:      $JMX"
echo "Plugin:   $PLUGIN"
echo ""

if [[ -n "${JMETER_REMOTE_HOSTS:-}" ]]; then
  echo "Mode: DISTRIBUTED (load generators on multiple nodes)"
  echo "Remote hosts: $JMETER_REMOTE_HOSTS"
  echo "Visitors: $TOTAL_USERS | Agents: $AGENT_THREADS"
  echo "Ramp: ${VISITOR_RAMP}s visitors / ${AGENT_RAMP}s agents"
  echo ""
  rm -f "$MERGED"
  rm -rf "$DASHBOARD"
  run_jmeter \
    -Jvisitor_threads="$TOTAL_USERS" \
    -Jvisitor_ramp="$VISITOR_RAMP" \
    -Jagent_threads="$AGENT_THREADS" \
    -Jagent_ramp="$AGENT_RAMP" \
    -Jvisitor_throughput="$VISITOR_THROUGHPUT" \
    -Jwave_id=1 \
    -R "$JMETER_REMOTE_HOSTS" \
    -l "$MERGED" \
    -e -o "$DASHBOARD"
else
  echo "Mode: WAVE (sequential waves from this machine — avoids IP 429 burst)"
  echo "Total users: $TOTAL_USERS = $WAVES waves × $USERS_PER_WAVE users"
  echo "Wave pause:  ${WAVE_PAUSE}s (rate-limit window cooldown)"
  echo "Throughput:  ${VISITOR_THROUGHPUT} visitor REST samples/min (throttled)"
  echo ""
  echo "Tip: For true multi-IP / multi-node load, set JMETER_REMOTE_HOSTS=ip1,ip2,ip3"
  echo "     (each machine runs jmeter-server) and re-run this script."
  echo ""

  rm -f "$MERGED"
  rm -rf "$DASHBOARD"

  for ((wave = 1; wave <= WAVES; wave++)); do
  WAVE_JTL="$RESULTS_DIR/wave-${wave}.jtl"
  rm -f "$WAVE_JTL"
  echo "---- Wave $wave / $WAVES ($USERS_PER_WAVE visitors) ----"
  run_jmeter \
    -Jvisitor_threads="$USERS_PER_WAVE" \
    -Jvisitor_ramp="$VISITOR_RAMP" \
    -Jagent_threads="$AGENT_THREADS" \
    -Jagent_ramp="$AGENT_RAMP" \
    -Jvisitor_throughput="$VISITOR_THROUGHPUT" \
    -Jwave_id="$wave" \
    -l "$WAVE_JTL"

  if [[ $wave -lt $WAVES ]]; then
    echo "Cooling down ${WAVE_PAUSE}s before next wave (IP rate-limit window)..."
    sleep "$WAVE_PAUSE"
  fi
  done

  echo ""
  echo "Merging wave results..."
  python3 "$DIR/merge-jtl.py" "$RESULTS_DIR"/wave-*.jtl -o "$MERGED"
  echo "Generating dashboard..."
  jmeter -g "$MERGED" -o "$DASHBOARD"
fi

echo ""
echo "Done."
echo "Merged JTL: $MERGED"
echo "Dashboard:  $DASHBOARD/index.html"
