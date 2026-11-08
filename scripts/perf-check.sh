#!/usr/bin/env bash
# Click-speed budget for EVERY sidebar page and the APIs behind them.
#   scripts/perf-check.sh [base-url]            default https://clinicos-cloud.vercel.app
#   BUDGET_MS=700 PERF_EMAIL=... PERF_PASS=...  overrides
# Logs in with a demo admin that has most modules on, takes the median of 3 calls per route, and exits 1 if any
# route is over budget. Measured from THIS machine, so the network distance to the server is included: it is what a user here feels.
# A 404 means the module is off for this demo clinic: reported as "skip". 403 is a failure (a real auth regression).
set -u
BASE="${1:-https://clinicos-cloud.vercel.app}"; BUDGET_MS="${BUDGET_MS:-700}"
J=$(mktemp); trap 'rm -f "$J"' EXIT
curl -s -c "$J" -o /dev/null -H 'content-type: application/json' -d "{\"email\":\"${PERF_EMAIL:-admin@brightsmile.demo}\",\"password\":\"${PERF_PASS:-Admin@123}\"}" "$BASE/api/auth/login"
PAGES="/app /app/patients /app/opd /app/appointments /app/invoices /app/invoices/new /app/services /app/inventory /app/pharmacy /app/pharmacy/dispense /app/staff /app/attendance /app/ratings /app/lab /app/lab/new /app/radiology /app/radiology/new /app/ipd /app/ipd/admit /app/dental /app/exercise /app/marketing /app/settings /app/support"
APIS="/api/auth/me /api/dashboard /api/patients /api/patients?limit=6&q=a /api/doctors /api/visits /api/appointments /api/invoices /api/services /api/inventory/items /api/staff /api/settings/modules /api/support/tickets"
fail=0; slow=0; n=0
for p in $PAGES $APIS; do
  res=$(for i in 1 2 3; do curl -s -b "$J" -o /dev/null -w '%{time_total} %{http_code}\n' "$BASE$p"; done | sort -n | sed -n 2p)
  code=${res#* }; ms=$(python3 -c "print(int(float('${res% *}')*1000))")
  if [ "$code" = "404" ]; then echo "skip  $p (module off for this demo clinic)"; continue; fi
  n=$((n+1))
  if [ "$code" != "200" ]; then echo "FAIL  $p http $code"; fail=1
  elif [ "$ms" -gt "$BUDGET_MS" ]; then echo "SLOW  $p ${ms}ms (budget ${BUDGET_MS}ms)"; slow=1
  else echo "ok    $p ${ms}ms"; fi
done
echo "checked $n routes"; [ $fail -eq 0 ] && [ $slow -eq 0 ]
