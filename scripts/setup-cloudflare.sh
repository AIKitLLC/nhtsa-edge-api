#!/usr/bin/env bash
# ==============================================================================
# NHTSA Edge API - Cloudflare setup & deploy
#   1. checks prerequisites and Cloudflare login
#   2. creates (or reuses) the D1 database and writes its id into wrangler.jsonc
#   3. applies D1 migrations
#   4. deploys the worker
#   5. creates the ADMIN_TOKEN secret if it does not exist yet
# Safe to re-run.
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DB_NAME="nhtsa-db"
PLACEHOLDER_ID="local-nhtsa-db"
UUID_RE='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

cd "$(dirname "$0")/.."

echo -e "${CYAN}NHTSA Edge API - Cloudflare setup & deploy${NC}"

# 1. Prerequisites -------------------------------------------------------------
echo -e "\n${YELLOW}[1/5] Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}Node.js >= 18 is required.${NC}"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  if command -v pnpm &> /dev/null; then pnpm install; else npm install; fi
fi

if ! npx wrangler whoami &> /dev/null; then
  echo -e "${YELLOW}Not logged into Cloudflare. Opening browser login...${NC}"
  npx wrangler login
fi
echo -e "${GREEN}Cloudflare authentication OK.${NC}"

# 2. D1 database (create or reuse) --------------------------------------------
echo -e "\n${YELLOW}[2/5] Resolving D1 database '${DB_NAME}'...${NC}"
DB_ID=$(npx wrangler d1 list --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const db=JSON.parse(s).find(d=>d.name===process.argv[1]);process.stdout.write(db?.uuid??"")}catch{}})' "$DB_NAME" \
  || true)

if [ -z "$DB_ID" ]; then
  CREATE_OUTPUT=$(npx wrangler d1 create "$DB_NAME" 2>&1)
  echo "$CREATE_OUTPUT"
  DB_ID=$(echo "$CREATE_OUTPUT" | grep -oE "$UUID_RE" | head -n 1 || true)
fi

if [ -z "$DB_ID" ]; then
  echo -e "${RED}Could not determine the D1 database id. Run 'npx wrangler d1 list' and set it in wrangler.jsonc manually.${NC}"
  exit 1
fi
echo -e "${GREEN}D1 database id: ${DB_ID}${NC}"

if grep -q "\"database_id\": \"${PLACEHOLDER_ID}\"" wrangler.jsonc; then
  sed -i.bak -e "s/\"database_id\": \"${PLACEHOLDER_ID}\"/\"database_id\": \"${DB_ID}\"/" wrangler.jsonc
  rm -f wrangler.jsonc.bak
  echo -e "${GREEN}Updated wrangler.jsonc. Commit this change so CI deploys use the same database.${NC}"
fi

# 3. Migrations ----------------------------------------------------------------
echo -e "\n${YELLOW}[3/5] Applying D1 migrations (remote)...${NC}"
npx wrangler d1 migrations apply "$DB_NAME" --remote

# 4. Deploy --------------------------------------------------------------------
echo -e "\n${YELLOW}[4/5] Deploying worker...${NC}"
DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
echo "$DEPLOY_OUTPUT"
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^ ]+\.workers\.dev' | head -n 1 || true)

# 5. ADMIN_TOKEN secret ---------------------------------------------------------
echo -e "\n${YELLOW}[5/5] Checking ADMIN_TOKEN secret...${NC}"
if npx wrangler secret list 2>/dev/null | grep -q '"ADMIN_TOKEN"'; then
  echo -e "${GREEN}ADMIN_TOKEN already set.${NC}"
else
  ADMIN_TOKEN=$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')
  printf '%s' "$ADMIN_TOKEN" | npx wrangler secret put ADMIN_TOKEN
  echo -e "${GREEN}Created ADMIN_TOKEN. Store it in your password manager - it is shown only once:${NC}"
  echo -e "  ${CYAN}${ADMIN_TOKEN}${NC}"
fi

echo -e "\n${GREEN}Setup finished.${NC}"
if [ -n "$WORKER_URL" ]; then
  echo -e "Worker URL: ${GREEN}${WORKER_URL}${NC}"
  echo -e "  curl ${WORKER_URL}/"
  echo -e "  curl ${WORKER_URL}/api/v1/vin/1HGCG5655WA027834/local"
  echo -e "  curl ${WORKER_URL}/api/v1/models?make=tesla"
  echo -e "\n${YELLOW}Note:${NC} the Cache API is a no-op on *.workers.dev. Attach a custom domain"
  echo -e "      (or enable KV) for edge caching to take effect. See README > Caching."
fi
