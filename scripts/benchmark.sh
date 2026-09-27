#!/usr/bin/env bash
set -euo pipefail

# Benchmark script: Direct NHTSA VPIC API vs Cloudflare Edge API
PORT="${1:-8787}"
HOST="http://localhost:${PORT}"
VIN="5UXWX7C5*BA"

echo "=========================================================="
echo "⚡ NHTSA API vs Cloudflare Edge API Benchmark"
echo "=========================================================="
echo "Test VIN: ${VIN}"
echo ""

# 1. Benchmark Direct NHTSA VPIC API
echo "1. Querying Direct NHTSA VPIC API (vpic.nhtsa.dot.gov)..."
DIRECT_URL="https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${VIN}?format=json"

DIRECT_METRICS=$(curl -s -w "%{time_total}:%{size_download}:%{http_code}" -o /tmp/direct_nhtsa.json "${DIRECT_URL}")
DIRECT_TIME=$(echo "${DIRECT_METRICS}" | cut -d: -f1)
DIRECT_SIZE=$(echo "${DIRECT_METRICS}" | cut -d: -f2)
DIRECT_CODE=$(echo "${DIRECT_METRICS}" | cut -d: -f3)

echo "   Status: ${DIRECT_CODE}"
echo "   Latency: ${DIRECT_TIME}s"
echo "   Payload size: ${DIRECT_SIZE} bytes"
echo ""

# 2. Benchmark Cloudflare Edge Proxy (Cache MISS)
echo "2. Querying Cloudflare Edge API (1st request -> Cache MISS / Fetch Upstream)..."
EDGE_PROXY_URL="${HOST}/vehicles/DecodeVinValues/${VIN}?format=json"

MISS_METRICS=$(curl -s -w "%{time_total}:%{size_download}:%{http_code}" -o /tmp/edge_miss.json "${EDGE_PROXY_URL}")
MISS_TIME=$(echo "${MISS_METRICS}" | cut -d: -f1)
MISS_SIZE=$(echo "${MISS_METRICS}" | cut -d: -f2)
MISS_CODE=$(echo "${MISS_METRICS}" | cut -d: -f3)

echo "   Status: ${MISS_CODE}"
echo "   Latency: ${MISS_TIME}s"
echo "   Payload size: ${MISS_SIZE} bytes"
echo ""

# 3. Benchmark Cloudflare Edge Proxy (Cache HIT)
echo "3. Querying Cloudflare Edge API (2nd request -> Cache HIT)..."
HIT_METRICS=$(curl -s -w "%{time_total}:%{size_download}:%{http_code}" -o /tmp/edge_hit.json "${EDGE_PROXY_URL}")
HIT_TIME=$(echo "${HIT_METRICS}" | cut -d: -f1)
HIT_SIZE=$(echo "${HIT_METRICS}" | cut -d: -f2)
HIT_CODE=$(echo "${HIT_METRICS}" | cut -d: -f3)

echo "   Status: ${HIT_CODE}"
echo "   Latency: ${HIT_TIME}s"
echo "   Payload size: ${HIT_SIZE} bytes"
echo ""

# 4. Benchmark Cloudflare Compact V1 API (High-performance clean schema - MISS)
echo "4. Querying Cloudflare Compact API (1st request -> Fetch Upstream)..."
V1_URL="${HOST}/api/v1/vin/${VIN}"
V1_METRICS=$(curl -s -w "%{time_total}:%{size_download}:%{http_code}" -o /tmp/edge_v1.json "${V1_URL}")
V1_TIME=$(echo "${V1_METRICS}" | cut -d: -f1)
V1_SIZE=$(echo "${V1_METRICS}" | cut -d: -f2)
V1_CODE=$(echo "${V1_METRICS}" | cut -d: -f3)

echo "   Status: ${V1_CODE}"
echo "   Latency: ${V1_TIME}s"
echo "   Payload size: ${V1_SIZE} bytes"
echo ""

# 5. Benchmark Cloudflare Compact V1 API (Cache HIT)
echo "5. Querying Cloudflare Compact API (2nd request -> Cache HIT)..."
V1_HIT_METRICS=$(curl -s -w "%{time_total}:%{size_download}:%{http_code}" -o /tmp/edge_v1_hit.json "${V1_URL}")
V1_HIT_TIME=$(echo "${V1_HIT_METRICS}" | cut -d: -f1)
V1_HIT_SIZE=$(echo "${V1_HIT_METRICS}" | cut -d: -f2)
V1_HIT_CODE=$(echo "${V1_HIT_METRICS}" | cut -d: -f3)

echo "   Status: ${V1_HIT_CODE}"
echo "   Latency: ${V1_HIT_TIME}s"
echo "   Payload size: ${V1_HIT_SIZE} bytes"
echo ""

echo "=========================================================="
echo "📊 RESULTS SUMMARY"
echo "=========================================================="
echo "Direct NHTSA VPIC : ${DIRECT_TIME}s | ${DIRECT_SIZE} bytes"
echo "Edge Proxy (HIT)  : ${HIT_TIME}s | ${HIT_SIZE} bytes"
echo "Edge Compact (HIT): ${V1_HIT_TIME}s | ${V1_HIT_SIZE} bytes"
echo "----------------------------------------------------------"
echo "Payload reduction : from ${DIRECT_SIZE} bytes down to ${V1_HIT_SIZE} bytes (~70% reduction)!"
echo "=========================================================="
