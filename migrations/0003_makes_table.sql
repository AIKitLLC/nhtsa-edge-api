-- Dedicated makes table for the live API sync.
-- Previously makes were stored as fake ('<make>', 'BASE_MODEL') rows in makes_models.

CREATE TABLE IF NOT EXISTS makes (
  make TEXT PRIMARY KEY,
  make_id INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO makes (make)
SELECT DISTINCT make FROM makes_models WHERE model = 'BASE_MODEL';

DELETE FROM makes_models WHERE model = 'BASE_MODEL';

-- vds_patterns was never read or written by the worker
DROP TABLE IF EXISTS vds_patterns;
