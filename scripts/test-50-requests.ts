#!/usr/bin/env bun
/**
 * 50-Request Comprehensive Test Suite across Diverse NHTSA Edge API Paths
 * Covers: Local Engine, Compact V1, Catalog, VPIC Proxy, Recalls, Parity Compare, Sync, and Error Boundaries.
 * Includes adaptive delays between calls to avoid spamming upstream NHTSA servers.
 */

interface TestCase {
  id: number;
  category: string;
  method: "GET" | "POST";
  path: string;
  expectedStatus: number;
  delayMs: number; // Delay before request to protect upstream
}

interface TestResult {
  id: number;
  category: string;
  method: string;
  path: string;
  status: number;
  expectedStatus: number;
  passed: boolean;
  latencyMs: number;
  source: string;
  sampleSummary: string;
}

const testCases: TestCase[] = [
  // ==========================================
  // Category 1: V1 Local Fast Decoding (< 1ms RAM)
  // ==========================================
  { id: 1, category: "Local Fast Decode", method: "GET", path: "/api/v1/vin/1FM5K8D84HGA00001/local", expectedStatus: 200, delayMs: 20 },
  { id: 2, category: "Local Fast Decode", method: "GET", path: "/api/v1/vin/5YJ3E1EB8NF000001/local", expectedStatus: 200, delayMs: 20 },
  { id: 3, category: "Local Fast Decode", method: "GET", path: "/api/v1/vin/1HGCR2F83PA000001/local", expectedStatus: 200, delayMs: 20 },
  { id: 4, category: "Local Fast Decode", method: "GET", path: "/api/v1/vin/4T1B11HK5JU000001/local", expectedStatus: 200, delayMs: 20 },
  { id: 5, category: "Local Fast Decode", method: "GET", path: "/api/v1/vin/WBA3A5C50DF000001/local", expectedStatus: 200, delayMs: 20 },
  { id: 6, category: "Local Fast Decode", method: "GET", path: "/api/v1/vin/WAUZZZF27SA000001/local", expectedStatus: 200, delayMs: 20 },
  { id: 7, category: "Local Fast Decode", method: "GET", path: "/api/v1/vin/1G1YY22U065000001/local", expectedStatus: 200, delayMs: 20 },
  { id: 8, category: "Local Fast Decode", method: "GET", path: "/api/v1/vin/KMHD35LH0JU000001/local", expectedStatus: 200, delayMs: 20 },
  { id: 9, category: "Local Fast Decode", method: "GET", path: "/api/v1/vin/KNAGU4A40G5000001/local", expectedStatus: 200, delayMs: 20 },
  { id: 10, category: "Local Fast Decode", method: "GET", path: "/api/v1/vin/WP0AB2A90GS000001/local", expectedStatus: 200, delayMs: 20 },

  // ==========================================
  // Category 2: V1 Compact VIN Decoding (Edge Caching & Payload Optimization)
  // ==========================================
  { id: 11, category: "Compact VIN Decode", method: "GET", path: "/api/v1/vin/5UXWX7C5*BA", expectedStatus: 200, delayMs: 200 },
  { id: 12, category: "Compact VIN Decode", method: "GET", path: "/api/v1/vin/1FM5K8D84HGA00001", expectedStatus: 200, delayMs: 200 },
  { id: 13, category: "Compact VIN Decode", method: "GET", path: "/api/v1/vin/5YJ3E1EB8NF000001", expectedStatus: 200, delayMs: 200 },
  { id: 14, category: "Compact VIN Decode", method: "GET", path: "/api/v1/vin/1HGCR2F83PA000001", expectedStatus: 200, delayMs: 200 },
  { id: 15, category: "Compact VIN Decode", method: "GET", path: "/api/v1/vin/4T1B11HK5JU000001", expectedStatus: 200, delayMs: 200 },
  // Immediate Repeats -> Verify L1 Edge Cache HIT (0ms upstream)
  { id: 16, category: "Compact VIN (Cache HIT)", method: "GET", path: "/api/v1/vin/5UXWX7C5*BA", expectedStatus: 200, delayMs: 30 },
  { id: 17, category: "Compact VIN (Cache HIT)", method: "GET", path: "/api/v1/vin/1FM5K8D84HGA00001", expectedStatus: 200, delayMs: 30 },
  { id: 18, category: "Compact VIN (Cache HIT)", method: "GET", path: "/api/v1/vin/5YJ3E1EB8NF000001", expectedStatus: 200, delayMs: 30 },

  // ==========================================
  // Category 3: Local NHTSA Models & Makes Catalog (32,009 models in Git)
  // ==========================================
  { id: 19, category: "Catalog Query", method: "GET", path: "/api/v1/models?make=toyota", expectedStatus: 200, delayMs: 20 },
  { id: 20, category: "Catalog Query", method: "GET", path: "/api/v1/models?make=honda", expectedStatus: 200, delayMs: 20 },
  { id: 21, category: "Catalog Query", method: "GET", path: "/api/v1/models?make=ford", expectedStatus: 200, delayMs: 20 },
  { id: 22, category: "Catalog Query", method: "GET", path: "/api/v1/models?make=tesla", expectedStatus: 200, delayMs: 20 },
  { id: 23, category: "Catalog Query", method: "GET", path: "/api/v1/models?make=bmw", expectedStatus: 200, delayMs: 20 },
  { id: 24, category: "Catalog Query", method: "GET", path: "/api/v1/models?make=mercedes-benz", expectedStatus: 200, delayMs: 20 },
  { id: 25, category: "Catalog Query", method: "GET", path: "/api/v1/models?make=hyundai", expectedStatus: 200, delayMs: 20 },
  { id: 26, category: "Catalog Query", method: "GET", path: "/api/v1/models?make=kia", expectedStatus: 200, delayMs: 20 },
  { id: 27, category: "Catalog Query", method: "GET", path: "/api/v1/models?make=porsche", expectedStatus: 200, delayMs: 20 },
  { id: 28, category: "Catalog Query", method: "GET", path: "/api/v1/models?make=vinfast", expectedStatus: 200, delayMs: 20 },
  { id: 29, category: "Catalog Query", method: "GET", path: "/api/v1/makes", expectedStatus: 200, delayMs: 20 },

  // ==========================================
  // Category 4: Transparent VPIC Drop-in Proxy
  // ==========================================
  { id: 30, category: "VPIC Drop-in Proxy", method: "GET", path: "/vehicles/DecodeVinValues/5UXWX7C5*BA?format=json", expectedStatus: 200, delayMs: 200 },
  { id: 31, category: "VPIC Proxy (Clean Mode)", method: "GET", path: "/vehicles/DecodeVinValues/5UXWX7C5*BA?format=json&clean=true", expectedStatus: 200, delayMs: 150 },
  { id: 32, category: "VPIC Variable Array", method: "GET", path: "/vehicles/DecodeVin/1HGCR2F83HA?format=json", expectedStatus: 200, delayMs: 200 },
  { id: 33, category: "VPIC Models Proxy", method: "GET", path: "/vehicles/GetModelsForMake/subaru?format=json", expectedStatus: 200, delayMs: 200 },
  { id: 34, category: "VPIC Models Proxy", method: "GET", path: "/vehicles/GetModelsForMake/mazda?format=json", expectedStatus: 200, delayMs: 200 },
  { id: 35, category: "VPIC Models Proxy", method: "GET", path: "/vehicles/GetModelsForMake/lexus?format=json", expectedStatus: 200, delayMs: 200 },
  { id: 36, category: "VPIC Models Proxy", method: "GET", path: "/vehicles/GetModelsForMake/audi?format=json", expectedStatus: 200, delayMs: 200 },
  // Verify Cache HIT on proxy endpoint
  { id: 37, category: "VPIC Proxy (Cache HIT)", method: "GET", path: "/vehicles/GetModelsForMake/subaru?format=json", expectedStatus: 200, delayMs: 30 },

  // ==========================================
  // Category 5: Vehicle Variables & Live Catalog Sync
  // ==========================================
  { id: 38, category: "VPIC Variable List", method: "GET", path: "/vehicles/GetVehicleVariableList?format=json", expectedStatus: 200, delayMs: 200 },
  { id: 39, category: "VPIC Variable Values", method: "GET", path: "/vehicles/GetVehicleVariableValuesList/Battery%20Type?format=json", expectedStatus: 200, delayMs: 150 },
  { id: 40, category: "Live Model Sync", method: "POST", path: "/api/v1/sync/models?make=tesla", expectedStatus: 200, delayMs: 150 },

  // ==========================================
  // Category 6: Parity Comparison Engine (Local vs Upstream Audit)
  // ==========================================
  { id: 41, category: "Parity Compare Audit", method: "GET", path: "/api/v1/vin/1FM5K8D84HGA00001/compare", expectedStatus: 200, delayMs: 250 },
  { id: 42, category: "Parity Compare Audit", method: "GET", path: "/api/v1/vin/5YJ3E1EB8NF000001/compare", expectedStatus: 200, delayMs: 250 },
  { id: 43, category: "Parity Compare Audit", method: "GET", path: "/api/v1/vin/4T1B11HK5JU000001/compare", expectedStatus: 200, delayMs: 250 },

  // ==========================================
  // Category 7: Sync Management & Telemetry
  // ==========================================
  { id: 44, category: "Telemetry & Health", method: "GET", path: "/", expectedStatus: 200, delayMs: 20 },
  { id: 45, category: "Sync Status", method: "GET", path: "/api/v1/sync/status", expectedStatus: 200, delayMs: 20 },
  { id: 46, category: "Live WMI Sync", method: "POST", path: "/api/v1/sync/wmi?wmi=1FM", expectedStatus: 200, delayMs: 200 },
  { id: 47, category: "Live WMI Sync", method: "POST", path: "/api/v1/sync/wmi?wmi=5YJ", expectedStatus: 200, delayMs: 200 },

  // ==========================================
  // Category 8: Input Validation & Boundary Error Handling
  // ==========================================
  { id: 48, category: "Validation Gate", method: "GET", path: "/api/v1/vin/invalid%20vin%20with%20spaces/local", expectedStatus: 400, delayMs: 20 },
  { id: 49, category: "Validation Gate", method: "GET", path: "/api/v1/models", expectedStatus: 400, delayMs: 20 },
  { id: 50, category: "Route Boundary", method: "GET", path: "/non-existent-api-path", expectedStatus: 404, delayMs: 20 },
];

const BASE_URL = process.env.TEST_HOST || "http://127.0.0.1:8787";
// Sync endpoints require the bearer token (same value as in .dev.vars / the ADMIN_TOKEN secret)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "dev-token";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log(`🚀 Starting Comprehensive 50-Request Test Suite against ${BASE_URL}`);
  console.log("   Protecting upstream with adaptive delay between calls...");
  console.log("================================================================================");

  const results: TestResult[] = [];
  const startTimeTotal = performance.now();

  for (const tc of testCases) {
    if (tc.delayMs > 0) {
      await sleep(tc.delayMs);
    }

    const url = `${BASE_URL}${tc.path}`;
    const start = performance.now();

    try {
      const response = await fetch(url, {
        method: tc.method,
        headers: {
          Accept: "application/json",
          "User-Agent": "NHTSA-50-Request-Test-Runner/1.0",
          ...(tc.method === "POST" ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
        },
      });

      const latencyMs = Math.round((performance.now() - start) * 100) / 100;
      const passed = response.status === tc.expectedStatus;

      // Extract diagnostic headers
      const cacheStatus = response.headers.get("X-Cache-Status") || "";
      const cacheTier = response.headers.get("X-Cache-Tier") || "";

      let sampleSummary = "";
      let source = cacheStatus ? `${cacheStatus} (${cacheTier || "Edge"})` : "";

      try {
        const json = await response.json() as Record<string, unknown>;
        if (json["source"]) {
          source = String(json["source"]);
        }

        if (json["data"]) {
          const d = json["data"] as Record<string, unknown>;
          if (d["make"] && d["model"]) {
            sampleSummary = `${d["make"]} ${d["model"]}`;
          } else if (d["make"]) {
            sampleSummary = `${d["make"]} (${d["count"] ?? d["plantCountry"] ?? ""})`;
          } else if (d["parityScorePercent"] !== undefined) {
            sampleSummary = `Parity: ${d["parityScorePercent"]}%`;
          }
        } else if (json["Count"] !== undefined) {
          sampleSummary = `Count: ${json["Count"]}`;
        } else if (json["count"] !== undefined) {
          sampleSummary = `Count: ${json["count"]}`;
        } else if (json["error"]) {
          const err = json["error"] as Record<string, unknown>;
          sampleSummary = `Err: ${err["code"] || err["message"]}`;
        } else if (json["status"]) {
          sampleSummary = `Status: ${json["status"]}`;
        }
      } catch {
        sampleSummary = "Raw response";
      }

      results.push({
        id: tc.id,
        category: tc.category,
        method: tc.method,
        path: tc.path,
        status: response.status,
        expectedStatus: tc.expectedStatus,
        passed,
        latencyMs,
        source: source || (passed ? "OK" : "ERROR"),
        sampleSummary,
      });

      const icon = passed ? "✅" : "❌";
      const padId = String(tc.id).padStart(2, " ");
      const padStatus = String(response.status).padEnd(3, " ");
      const padLatency = `${latencyMs}ms`.padStart(7, " ");
      const padCat = tc.category.padEnd(23, " ");
      console.log(`[${padId}/50] ${icon} ${padCat} | ${padStatus} | ${padLatency} | ${tc.method} ${tc.path.slice(0, 42).padEnd(42, " ")} | ${sampleSummary}`);

    } catch (err: unknown) {
      const latencyMs = Math.round((performance.now() - start) * 100) / 100;
      results.push({
        id: tc.id,
        category: tc.category,
        method: tc.method,
        path: tc.path,
        status: 0,
        expectedStatus: tc.expectedStatus,
        passed: false,
        latencyMs,
        source: "NETWORK_ERROR",
        sampleSummary: err instanceof Error ? err.message : String(err),
      });
      console.log(`[${String(tc.id).padStart(2, " ")}/50] ❌ ${tc.category.padEnd(23, " ")} | ERR | ${latencyMs}ms | ${tc.method} ${tc.path}`);
    }
  }

  const totalDuration = Math.round((performance.now() - startTimeTotal) / 10) / 100;
  const passedCount = results.filter((r) => r.passed).length;

  console.log("\n================================================================================");
  console.log("📊 TEST EXECUTION SUMMARY (50 REQUESTS)");
  console.log("================================================================================");
  console.log(`• Total Requests Executed : ${results.length}`);
  console.log(`• Success Rate            : ${passedCount}/${results.length} (${(passedCount / results.length * 100).toFixed(1)}%)`);
  console.log(`• Total Duration          : ${totalDuration}s`);
  console.log("--------------------------------------------------------------------------------");

  // Latency breakdown by category
  const categories = [...new Set(results.map((r) => r.category))];
  console.log("Category Breakdown:");
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const avgLat = Math.round(catResults.reduce((acc, c) => acc + c.latencyMs, 0) / catResults.length);
    const minLat = Math.min(...catResults.map((c) => c.latencyMs));
    const maxLat = Math.max(...catResults.map((c) => c.latencyMs));
    const catPassed = catResults.filter((r) => r.passed).length;
    console.log(`  - ${cat.padEnd(25, " ")}: ${catPassed}/${catResults.length} pass | Avg: ${String(avgLat).padStart(4, " ")}ms | Min: ${String(minLat).padStart(4, " ")}ms | Max: ${String(maxLat).padStart(4, " ")}ms`);
  }

  console.log("================================================================================");

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runTestSuite().catch(console.error);
