#!/usr/bin/env bash
# Latency benchmark: live NHTSA vPIC vs this worker's offline decoder.
# Usage: scripts/benchmark.sh [base_url] [requests]
#   base_url  default http://localhost:8787 (pnpm dev); use the dev/prod worker URL for real numbers
#   requests  per endpoint, default 20
set -euo pipefail

BASE="${1:-http://localhost:8787}"
N="${2:-20}"
VIN="1HGCM82633A004352"

measure() {
  local url="$1"
  for _ in $(seq 1 "$N"); do
    curl -s -o /dev/null -w "%{time_total}\n" "$url"
  done | sort -n | awk '
    { t[NR] = $1 }
    END {
      p50 = t[int((NR + 1) * 0.50)]; p95 = t[int((NR + 1) * 0.95)]; if (p95 == "") p95 = t[NR]
      printf "p50 %.1f ms   p95 %.1f ms   (n=%d)\n", p50 * 1000, p95 * 1000, NR
    }'
}

echo "VIN ${VIN}, ${N} requests each"
printf "%-36s " "NHTSA vPIC (live)";            measure "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${VIN}?format=json"
printf "%-36s " "Worker /vehicles/DecodeVinValues"; measure "${BASE}/vehicles/DecodeVinValues/${VIN}?format=json"
printf "%-36s " "Worker /api/v1/vin";            measure "${BASE}/api/v1/vin/${VIN}"
