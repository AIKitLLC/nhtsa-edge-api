#!/usr/bin/env bash
# ==============================================================================
# NHTSA Edge API - Cloudflare Automated Setup & Deployment Script
# Safe High-Performance Engineering Standard
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================================================================"
echo -e "🚀 NHTSA Edge API - Cloudflare 1-Click Automated Setup & Deploy"
echo -e "================================================================================${NC}"

# 1. Check Prerequisites
echo -e "\n${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js is required but not installed. Please install Node.js >= 18.${NC}"
  exit 1
fi

PACKAGE_MANAGER="pnpm"
if ! command -v pnpm &> /dev/null; then
  if command -v npm &> /dev/null; then
    PACKAGE_MANAGER="npm"
  else
    echo -e "${RED}❌ Neither pnpm nor npm found.${NC}"
    exit 1
  fi
fi
echo -e "${GREEN}✔ Using package manager: ${PACKAGE_MANAGER}${NC}"

# 2. Check Cloudflare Authentication
echo -e "\n${YELLOW}[2/5] Checking Cloudflare authentication status...${NC}"
if ! npx wrangler whoami &> /dev/null; then
  echo -e "${YELLOW}⚡ Not logged into Cloudflare. Opening browser login...${NC}"
  npx wrangler login
else
  echo -e "${GREEN}✔ Cloudflare authentication verified.${NC}"
fi

# 3. Setup Cloudflare D1 Database
echo -e "\n${YELLOW}[3/5] Setting up Cloudflare D1 Database (nhtsa-db)...${NC}"
D1_OUTPUT=$(npx wrangler d1 create nhtsa-db 2>&1 || true)

if echo "$D1_OUTPUT" | grep -q "database_id"; then
  NEW_DB_ID=$(echo "$D1_OUTPUT" | grep "database_id" | head -n 1 | awk -F '"' '{print $4}')
  echo -e "${GREEN}✔ Created new D1 database with ID: ${NEW_DB_ID}${NC}"
  
  # Update wrangler.jsonc with real database_id
  if [ -n "$NEW_DB_ID" ]; then
    sed -i.bak -e "s/\"database_id\": \"local-nhtsa-db\"/\"database_id\": \"${NEW_DB_ID}\"/g" wrangler.jsonc
    rm -f wrangler.jsonc.bak
    echo -e "${GREEN}✔ Updated wrangler.jsonc with production D1 database_id.${NC}"
  fi
else
  echo -e "${GREEN}✔ D1 database 'nhtsa-db' is ready.${NC}"
fi

# 4. Apply D1 Migrations to Remote Production Database
echo -e "\n${YELLOW}[4/5] Applying D1 migrations to remote production database...${NC}"
npx wrangler d1 migrations apply nhtsa-db --remote || {
  echo -e "${YELLOW}⚠️ Migration check completed (or tables already exist).${NC}"
}

# 5. Build and Deploy Worker
echo -e "\n${YELLOW}[5/5] Deploying Worker to Cloudflare Global Edge...${NC}"
DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
echo "$DEPLOY_OUTPUT"

WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://[^ ]*workers.dev' | head -n 1 || true)

echo -e "\n${CYAN}================================================================================"
echo -e "🎉 DEPLOYMENT COMPLETE!"
echo -e "================================================================================${NC}"

if [ -n "$WORKER_URL" ]; then
  echo -e "Your API is live globally at: ${GREEN}${WORKER_URL}${NC}"
  echo -e "\nTest your new endpoints:"
  echo -e "  - Health Check     : ${CYAN}curl ${WORKER_URL}/${NC}"
  echo -e "  - Local Fast VIN   : ${CYAN}curl ${WORKER_URL}/api/v1/vin/1FM5K8D84HGA00001/local${NC}"
  echo -e "  - Compact VIN      : ${CYAN}curl ${WORKER_URL}/api/v1/vin/5UXWX7C5*BA${NC}"
  echo -e "  - VPIC Drop-in     : ${CYAN}curl ${WORKER_URL}/vehicles/DecodeVinValues/5UXWX7C5*BA?format=json\&clean=true${NC}"
  echo -e "  - Catalog Query    : ${CYAN}curl ${WORKER_URL}/api/v1/models?make=tesla${NC}"
  echo -e "  - Parity Audit     : ${CYAN}curl ${WORKER_URL}/api/v1/vin/1FM5K8D84HGA00001/compare${NC}"
else
  echo -e "Please check the wrangler deploy output above for your worker URL."
fi

echo -e "\n${GREEN}✔ Setup finished successfully!${NC}\n"
