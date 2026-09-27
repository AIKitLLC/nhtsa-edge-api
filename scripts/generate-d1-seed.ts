import fs from "node:fs";
import path from "node:path";

interface WmiItem {
  make: string;
  country: string | null;
  vehicleType: string | null;
}

const dataPath = path.resolve("./data/wmi-master.json");
const raw = fs.readFileSync(dataPath, "utf-8");
const wmis = JSON.parse(raw) as Record<string, WmiItem>;

const lines: string[] = [
  "-- Official NHTSA WMI Catalog Seed (13,001 Records)",
  "-- Generated directly from NHTSA vPICList_lite dump",
];

const entries = Object.entries(wmis);
const batchSize = 500; // SQLite compound SELECT limit safe chunk size

for (let i = 0; i < entries.length; i += batchSize) {
  const chunk = entries.slice(i, i + batchSize);
  const valueLines = chunk.map(([wmi, item]) => {
    const cleanWmi = wmi.replace(/'/g, "''");
    const cleanMake = (item.make || "").replace(/'/g, "''");
    const cleanMfr = cleanMake;
    const cleanVtype = (item.vehicleType || "").replace(/'/g, "''");
    const cleanCountry = (item.country || "").replace(/'/g, "''");
    return `('${cleanWmi}', '${cleanMake}', '${cleanMfr}', '${cleanVtype}', '${cleanCountry}')`;
  });

  lines.push(
    `INSERT OR IGNORE INTO wmi_catalog (wmi, make, manufacturer, vehicle_type, country) VALUES\n` +
      valueLines.join(",\n") +
      ";\n"
  );
}

const outPath = path.resolve("./migrations/0002_seed_official_wmi.sql");
fs.writeFileSync(outPath, lines.join("\n"));
const stats = fs.statSync(outPath);
console.log(`✅ Generated ${outPath}! Size: ${(stats.size / 1024).toFixed(1)} KB`);
