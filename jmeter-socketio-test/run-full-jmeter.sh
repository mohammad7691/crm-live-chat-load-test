#!/bin/bash
# Run the FULL JMeter test (API coverage + socket.io + load) matching the last complete Node run.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$DIR/load-env.sh"
PLUGIN="$DIR/../jmeter-plugins/jmeter-websocket-samplers.jar"
JMX="$DIR/crm_chat_full_jmeter.jmx"

VISITOR_THREADS="${VISITOR_THREADS:-50}"
AGENT_THREADS="${AGENT_THREADS:-50}"
VISITOR_RAMP="${VISITOR_RAMP:-60}"
AGENT_RAMP="${AGENT_RAMP:-60}"
RESULTS="$DIR/results-full-${VISITOR_THREADS}v-${AGENT_THREADS}a.jtl"
DASHBOARD="$DIR/dashboard-full-${VISITOR_THREADS}v-${AGENT_THREADS}a"

ulimit -n 4096 2>/dev/null || true
rm -f "$RESULTS"
rm -rf "$DASHBOARD"

echo "CRM Chat Full JMeter Test"
echo "========================="
echo "Visitors: $VISITOR_THREADS (ramp ${VISITOR_RAMP}s)"
echo "Agents:   $AGENT_THREADS (ramp ${AGENT_RAMP}s)"
echo "Plugin:   $PLUGIN"
echo "Results:  $RESULTS"
echo ""

jmeter -n -t "$JMX" \
  -Jsearch_paths="$PLUGIN" \
  "${JMETER_CREDS_ARGS[@]}" \
  -Jvisitor_threads="$VISITOR_THREADS" \
  -Jvisitor_ramp="$VISITOR_RAMP" \
  -Jagent_threads="$AGENT_THREADS" \
  -Jagent_ramp="$AGENT_RAMP" \
  -l "$RESULTS" \
  -e -o "$DASHBOARD"

echo ""
echo "Done."
echo "Dashboard: $DASHBOARD/index.html"
echo "Raw JTL:   $RESULTS"
