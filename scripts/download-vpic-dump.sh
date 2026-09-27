#!/usr/bin/env bash
set -euo pipefail

# Downloads an official NHTSA vPICList_lite PostgreSQL dump.
# Usage: scripts/download-vpic-dump.sh [target_dir] [dump_name]
#   dump_name defaults to data/sync-metadata.json -> latestAvailableDump (or activeDumpVersion)
TARGET_DIR="${1:-./nhtsa-dumps}"
DEFAULT_DUMP=$(node -e 'const m=require("./data/sync-metadata.json");process.stdout.write(m.latestAvailableDump||m.activeDumpVersion)')
DUMP_NAME="${2:-$DEFAULT_DUMP}"
BASE_URL="https://vpic.nhtsa.dot.gov/downloads"

mkdir -p "${TARGET_DIR}"

echo "=========================================================="
echo "📦 NHTSA Official vPICList Database Downloader"
echo "=========================================================="
echo "Destination directory: ${TARGET_DIR}"
echo ""

FILE_NAME="${DUMP_NAME}.plain.zip"
DOWNLOAD_URL="${BASE_URL}/${FILE_NAME}"

echo "Downloading official PostgreSQL plain SQL dump: ${DOWNLOAD_URL}..."
curl -L -f --progress-bar -o "${TARGET_DIR}/${FILE_NAME}" "${DOWNLOAD_URL}"

echo ""
echo "✅ Download complete! File saved to: ${TARGET_DIR}/${FILE_NAME}"
echo ""
echo "To restore into your PostgreSQL database:"
echo "----------------------------------------------------------"
echo "1. Unzip the file:"
echo "   unzip ${TARGET_DIR}/${FILE_NAME} -d ${TARGET_DIR}/"
echo ""
echo "2. Restore into PostgreSQL (creates schema 'vpic'):"
echo "   psql -h <HOST> -U <USER> -d <DATABASE> --no-owner --no-privileges -f ${TARGET_DIR}/vPICList_lite_*.sql"
echo ""
echo "3. Test decoding via official stored procedure:"
echo "   SELECT * FROM vpic.spVinDecode('5UXWX7C50BA000001');"
echo "=========================================================="
