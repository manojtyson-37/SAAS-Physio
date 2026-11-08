#!/usr/bin/env bash
# Click-speed budget. Logs in with the public demo admin and times the pages and APIs a user hits on every click.
#   scripts/perf-check.sh https://clinicos-cloud.vercel.app      # default
# Fails (exit 1) when a median exceeds the budget, so a slow click is caught before a person feels it.
# Budget is measured FROM THIS MACHINE: the network floor to the server is included, so read it as "what a user here feels".
set -u
BASE="${1:-https://clinicos-cloud.vercel.app}"; BUDGET_MS="${BUDGET_MS:-700}"
J=$(mktemp); trap 'rm -f "$J"' EXIT
curl -s -c "$J" -o /dev/null -H 'content-type: application/json' -d "{\"email\":\"${PERF_EMAIL:-admin@sunrisephysio.in}\",\"password\":\"${PERF_PASS:-Admin@123}\"}" "$BASE/api/auth/login"
fail=0
for p in /app /app/patients /app/opd /api/auth/me /api/dashboard /api/patients /api/visits /api/invoices; do
  t=$(for i in 1 2 3; do curl -s -b "$J" -o /dev/null -w '%{time_total}\n' "$BASE$p"; done | sort -n | sed -n 2p)
  ms=$(python3 -c "print(int(float('$t')*1000))")
  [ "$ms" -gt "$BUDGET_MS" ] && { echo "SLOW  $p ${ms}ms (budget ${BUDGET_MS}ms)"; fail=1; } || echo "ok    $p ${ms}ms"
done
exit $fail
