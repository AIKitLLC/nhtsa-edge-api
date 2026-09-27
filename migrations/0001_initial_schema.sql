-- Cloudflare D1 NHTSA Local Database Schema
-- High-Performance edge storage for WMI, Makes, Models, VDS patterns, and Decoded VINs

CREATE TABLE IF NOT EXISTS wmi_catalog (
  wmi TEXT PRIMARY KEY,
  make TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  vehicle_type TEXT,
  country TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS makes_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  vehicle_type TEXT,
  UNIQUE(make, model)
);

CREATE TABLE IF NOT EXISTS vds_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wmi TEXT NOT NULL,
  vds_pattern TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  body_class TEXT,
  doors INTEGER,
  engine_cylinders INTEGER,
  displacement_l REAL,
  drive_type TEXT,
  UNIQUE(wmi, vds_pattern)
);

CREATE TABLE IF NOT EXISTS vin_records (
  vin TEXT PRIMARY KEY,
  make TEXT,
  model TEXT,
  year INTEGER,
  body_class TEXT,
  drive_type TEXT,
  engine_cylinders INTEGER,
  displacement_l REAL,
  fuel_type TEXT,
  plant_country TEXT,
  raw_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parity_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vin TEXT NOT NULL,
  parity_score INTEGER NOT NULL,
  local_latency_ms REAL NOT NULL,
  upstream_latency_ms REAL NOT NULL,
  is_exact_match INTEGER NOT NULL,
  discrepancies_json TEXT,
  audited_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast edge lookups (<0.5ms)
CREATE INDEX IF NOT EXISTS idx_wmi_make ON wmi_catalog(make);
CREATE INDEX IF NOT EXISTS idx_models_make ON makes_models(make);
CREATE INDEX IF NOT EXISTS idx_vds_lookup ON vds_patterns(wmi, vds_pattern);
