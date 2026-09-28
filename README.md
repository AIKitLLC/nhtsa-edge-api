# NHTSA Edge API & High-Performance Caching Gateway ⚡🚗

> High-performance **Cloudflare Workers** edge gateway providing vehicle data APIs (NHTSA VPIC & Safety Recalls) with ultra-low latency (~2ms - 15ms), ~70% - 90% payload bandwidth reduction, local in-memory decoding (49 CFR Part 565), and resilient multi-tier caching.

---

## 🎯 The Problems with Direct NHTSA API & The Cloudflare Solution

| Criteria | Direct NHTSA API (`vpic.nhtsa.dot.gov`) | Cloudflare Edge API (`nhtsa-edge-api`) |
| :--- | :--- | :--- |
| **Average Latency** | **300ms - 2,500ms+** (single origin in US, high cross-continent ping) | **2ms - 15ms** (served locally from 330+ Cloudflare Edge PoPs worldwide) |
| **Local RAM Decode** | Not available (must call remote servers) | **0.01ms - 0.05ms** (in-memory 49 CFR Part 565 engine) |
| **Payload Size** | **~4 KB - 18 KB** (bloated with 100+ empty `""` and `null` attributes) | **~800 B - 1.2 KB** (Clean V1 / `?clean=true` cuts 70% - 90% bandwidth) |
| **Availability / Downtime** | Vulnerable to maintenance outages and network spikes | **99.99% Resilient**: Local engine works offline even if NHTSA is down |
| **Spike Protection** | Prone to `504 Gateway Timeout` or rate-limiting / IP bans | **Request Coalescing (Single-Flight)**: protects upstream servers |
| **Backwards Compatibility**| Requires custom parsing for legacy applications | **100% Drop-in Replacement**: identical paths and format options |
| **Data Ingestion** | Manual gigabyte SQL Server/CSV downloads | **Dual-Channel Sync**: Git-embedded master data + Automated Nightly Sync |

---

## 🏗️ Technical Architecture (Safe High-Performance Engineering)

1. **Ultra-lightweight Hono v4 Framework**: Optimized specifically for Web Standards and Cloudflare Workers V8 isolates runtime, achieving sub-millisecond routing overhead (~0.01ms).
2. **Model 2 Hybrid Architecture & Multi-Tier Edge Caching**:
   - **Embedded Master Datasets (Version-Controlled in Git)**: Bundles **13,001 global WMIs** (`data/wmi-master.json`) and **32,009 vehicle models** (`data/makes-models.json`) extracted directly from the official `vPICList_lite_2026_09` release.
   - **Sub-millisecond In-Memory Decoder**: Decodes VINs in **0.01ms - 0.05ms** using pure TypeScript implementation of federal standard **49 CFR Part 565** (Modulo 11 Check Digit validation, low-volume WMI pos 3='9' handling, 30-year model year cycle).
   - **L1 Edge Cache API (`caches.default`)**: Anycast Edge PoP cache with `stale-while-revalidate` background refresh.
   - **Cloudflare D1 (SQLite Edge Database)**: Distributed SQLite edge database supporting automated migrations and incremental catalog sync.
3. **Request Coalescing (Thundering Herd Protection)**: Concurrent cache-miss requests for the same VIN share a single upstream Promise, eliminating redundant upstream requests.
4. **Resilient Network Client**: Equipped with `AbortController` timeout (default 5s) and automatic retry with exponential backoff on upstream 502/503/504 errors.
5. **Strict Type Safety Doctrine**: TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, zero `any`, strict runtime boundary validations with `zod`.
6. **Shadow Parity Audit (`/api/v1/vin/:vin/compare`)**: Real-time cross-verification between the local decoding engine and live NHTSA VPIC output.

---

## 🚀 Installation & Quickstart

### 1. Prerequisites
- Node.js >= 18 (fully verified on Node v24)
- `pnpm`, `bun`, or `npm`

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/your-username/nhtsa-edge-api.git
cd nhtsa-edge-api
pnpm install
```

### 3. Run Locally (Miniflare Edge Simulator)
```bash
pnpm dev
# Local development server listens at http://localhost:8787
```

### 4. Run Typecheck and Automated Tests
```bash
# Verify strict TypeScript type safety (Zero errors)
pnpm typecheck

# Run test suite (30/30 unit & integration tests)
pnpm test

# Run 50-request rate-limit protected benchmark suite
pnpm run test:50
```

### 5. Live Speed Benchmark
While `pnpm dev` is running, open another terminal window and run:
```bash
./scripts/benchmark.sh 8787
```

**Measured Benchmark Results:**
```text
==========================================================
⚡ NHTSA API vs Cloudflare Edge API Benchmark
==========================================================
Test VIN: 5UXWX7C5*BA

Direct NHTSA VPIC : 0.286s | 3994 bytes
Edge Proxy (HIT)  : 0.0035s | 3994 bytes  (80x faster)
Edge Compact (HIT): 0.0034s | 1251 bytes  (70% payload bandwidth reduction)
==========================================================
```

---

## 📡 API Reference & Usage Guide

### Option 1: Modern RESTful V1 Clean API (Recommended)
Standardized clean JSON format, strongly typed numbers/booleans, omitting 100+ blank fields:

| Method | Endpoint | Description | Cache TTL |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/vin/:vin` | Compact VIN decode with automatic local engine fallback | 30 days |
| `GET` | `/api/v1/vin/:vin/unified` | **Multi-Source Unified Profile** (NHTSA + US EPA EV Range + EU RDW Specs) | 30 days |
| `GET` | `/api/v1/vin/:vin/local` | In-memory 49 CFR Part 565 fast decode (0.01ms - 5ms, 100% offline) | Permanent |
| `GET` | `/api/v1/vin/:vin/compare` | Parity audit comparing local engine vs official NHTSA output | Realtime |
| `GET` | `/api/v1/makes` | Comprehensive list of all registered vehicle makes | 7 days |
| `GET` | `/api/v1/models?make=toyota` | List of models for a specific manufacturer | 7 days |
| `GET` | `/api/v1/recalls/:vin` | Safety recall campaigns by VIN | 6 hours |

**Sample Response `GET /api/v1/vin/5UXWX7C5*BA`:**
```json
{
  "success": true,
  "data": {
    "vin": "5UXWX7C5*BA",
    "make": "BMW",
    "model": "X3",
    "year": 2011,
    "trim": "xDrive35i",
    "vehicleType": "MULTIPURPOSE PASSENGER VEHICLE (MPV)",
    "bodyClass": "Sport Utility Vehicle [SUV]/Multipurpose Vehicle [MPV]",
    "doors": 4,
    "driveType": "AWD/All-Wheel Drive",
    "engineCylinders": 6,
    "displacementL": 3,
    "engineHp": 300,
    "fuelType": "Gasoline",
    "plantCountry": "GERMANY",
    "plantCity": "MUNICH",
    "manufacturer": "BMW NORTH AMERICA",
    "isValidVin": true,
    "errorCode": "0",
    "errorText": "0 - VIN decoded clean",
    "extraAttributes": {
      "AirBagLocFront": "1st Row (Driver and Passenger)",
      "TPMS": "Direct",
      "DisplacementCC": "2979.168"
    }
  },
  "source": "EDGE_CACHE",
  "cached": true,
  "timestamp": "2026-09-27T03:40:18.535Z"
}
```

---

### Option 2: 100% Drop-in Transparent VPIC Proxy
Designed for existing applications already integrated with `vpic.nhtsa.dot.gov/api/vehicles/*`. No path or parsing modifications required — simply point your base URL to the Cloudflare Worker:

- `GET /vehicles/DecodeVinValues/:vin?format=json`
- `GET /vehicles/DecodeVin/:vin?format=json`
- `GET /vehicles/GetModelsForMake/:make?format=json`
- `GET /vehicles/GetAllMakes?format=json`

> **Pro-Tip**: Append `&clean=true` to any VPIC proxy endpoint to automatically strip empty `""` keys while maintaining the original schema:
> ```
> GET /vehicles/DecodeVinValues/5UXWX7C5*BA?format=json&clean=true
> ```

---

## 🌐 Deploying to Cloudflare (Production)

### Method 1: 1-Click Automated Script (Recommended)
The repository includes an automated setup script that verifies authentication, creates your D1 Database, applies migrations, and deploys globally:

```bash
pnpm run setup:cloudflare
# Or via shell directly:
bash scripts/setup-cloudflare.sh
```

**What the script does automatically:**
1. Checks Cloudflare authentication status (`wrangler whoami`).
2. Creates the distributed **Cloudflare D1 (`nhtsa-db`)** database.
3. Automatically updates `wrangler.jsonc` with your production `database_id`.
4. Applies all schema migrations (`wmi_catalog`, `makes_models`, `sync_history`).
5. Deploys the worker across 330+ edge locations and outputs live testing URLs.

---

### Method 2: Manual Step-by-Step Deployment

1. **Log in to Cloudflare:**
   ```bash
   npx wrangler login
   ```

2. **Create D1 Database:**
   ```bash
   npx wrangler d1 create nhtsa-db
   ```
   *Copy the generated `database_id` and paste it into `wrangler.jsonc`.*

3. **Apply Remote Database Migrations:**
   ```bash
   npx wrangler d1 migrations apply nhtsa-db --remote
   ```

4. **(Optional) Enable Global Persistent KV Cache:**
   ```bash
   npx wrangler kv:namespace create NHTSA_CACHE_KV
   ```
   *Uncomment `kv_namespaces` in `wrangler.jsonc` and set `"ENABLE_KV_CACHE": "true"`.*

5. **Deploy Worker:**
   ```bash
   pnpm deploy
   ```

**Official Production URL**: `https://nhtsa-edge-api.tuannx87.workers.dev`

---

## 🔄 Automated Data Updates via GitHub Actions

This repository includes an automated DataOps workflow at [`.github/workflows/nhtsa-sql-sync.yml`](.github/workflows/nhtsa-sql-sync.yml):

* **Schedule**: Runs automatically at **03:00 UTC every Sunday night and Monday night** (`cron: '0 3 * * 0,1'`).
* **Manual Trigger**: Can also be executed anytime via the `Run workflow` button under the **Actions** tab on GitHub.

### Automated Workflow Pipeline:
1. Probes the official NHTSA downloads repository (`https://vpic.nhtsa.dot.gov/downloads/`) for newly released monthly SQL dumps (`vPICList_lite_YYYY_MM`).
2. Downloads and ingests new records into Git-tracked files (`data/wmi-master.json`, `data/makes-models.json`).
3. If no new monthly dump is published yet, performs an incremental live API catalog sync for newly registered makes/models.
4. Executes safety unit tests (`bun test`).
5. If changes are detected: Commits and pushes the updated dataset back to Git, then automatically redeploys the worker to Cloudflare!

> **Setup Secret**: Add `CLOUDFLARE_API_TOKEN` to **Repository Settings -> Secrets and variables -> Actions** to allow GitHub Actions to redeploy automatically after dataset updates.

---

## ⚖️ Legal Attribution & Disclaimer

* **Public Domain**: The VPIC database and vehicle specifications are official works of the United States Federal Government and are in the public domain under **17 U.S.C. § 105** (No copyright protection).
* **Privacy & DPPA Compliance**: The data consists exclusively of vehicle engineering specifications (Make, Model, Year, Engine, GVWR, Plant). It **does not contain any Personally Identifiable Information (PII)** or vehicle registration/owner data, fully complying with the *Driver's Privacy Protection Act (18 U.S.C. § 2721)*.
* **Attribution**: Vehicle data is provided by the **National Highway Traffic Safety Administration (NHTSA)**, U.S. Department of Transportation (DOT). This project is an independent high-performance edge gateway and is not officially affiliated with or endorsed by NHTSA or the United States Government.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
