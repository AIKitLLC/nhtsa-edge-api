/**
 * DDL for a PostgreSQL "vpic" schema rebuilt from data/vpic, just enough for the
 * verbatim NHTSA functions (docs/vpic-reference/decode-functions.sql) to run.
 *
 * data/vpic keeps a projection of the dump, so a few things are reconstructed:
 *   - createdon = changedon, updatedon = NULL: every decode query reads
 *     coalesce(UpdatedOn, CreatedOn), which is what changedon holds.
 *   - pattern.keys_regex = vpic.sqlwild_to_regex(keys) (a stored column in the dump).
 *   - wmiyearvalidchars is expanded back from its (wmi, year) aggregate.
 *   - vNCSA* views and WMIYearValidChars_CacheExceptions are not in data/vpic: created empty.
 */

import { TABLE_SPECS } from "../lib/tables";

const INT_COLUMNS = new Set(["year", "yearfrom", "yearto", "modelyear", "weight"]);
const BOOL_COLUMNS = new Set(["tobeqced", "isprivate", "iskey", "checkdigit"]);
const TS_COLUMNS = new Set(["changedon", "publicavailabilitydate"]);

export function columnType(column: string): string {
  if (column === "attributeid") return "varchar";
  if (column === "id" || column.endsWith("id") || INT_COLUMNS.has(column)) return "integer";
  if (BOOL_COLUMNS.has(column)) return "boolean";
  if (TS_COLUMNS.has(column)) return "timestamp";
  return "varchar";
}

function tableDdl(table: string, columns: readonly string[]): string {
  const cols = columns.map((c) => `  "${c}" ${columnType(c)}`);
  if (columns.includes("changedon")) {
    cols.push(`  createdon timestamp GENERATED ALWAYS AS ("changedon") STORED`, `  updatedon timestamp`);
  }
  if (table === "pattern") cols.push(`  keys_regex varchar`);
  return `CREATE TABLE vpic."${table}" (\n${cols.join(",\n")}\n);`;
}

/** Everything created before the data is loaded. */
export function schemaDdl(): string {
  return [
    `DROP SCHEMA IF EXISTS vpic CASCADE;`,
    `CREATE SCHEMA vpic;`,
    `CREATE TYPE vpic."tblDecodingItem" AS (
  "Id" integer, "DecodingId" integer, "CreatedOn" timestamp, "PatternId" integer,
  "Keys" varchar, "VinSchemaId" integer, "WmiId" integer, "ElementId" integer,
  "AttributeId" varchar, "Value" varchar, "Source" varchar, "Priority" integer, "TobeQCed" boolean
);`,
    ...TABLE_SPECS.map((s) => tableDdl(s.table, s.columns)),
    `CREATE TABLE vpic.wmiyearvalidchars_agg (wmi varchar, year integer, validchars varchar);`,
    `CREATE TABLE vpic.wmiyearvalidchars_cacheexceptions (wmi varchar);`,
    `CREATE VIEW vpic.vncsabodytype AS SELECT NULL::integer AS id, NULL::varchar AS name WHERE false;`,
    `CREATE VIEW vpic.vncsamake AS SELECT NULL::integer AS id, NULL::varchar AS name WHERE false;`,
    `CREATE VIEW vpic.vncsamodel AS SELECT NULL::integer AS id, NULL::varchar AS name WHERE false;`,
  ].join("\n\n");
}

/** Run after data and functions are loaded. */
export function postLoadSql(): string {
  return `
UPDATE vpic.pattern SET keys_regex = vpic.sqlwild_to_regex(keys) WHERE keys LIKE '%[%';

CREATE TABLE vpic.wmiyearvalidchars AS
SELECT a.wmi, a.year, split_part(part, ':', 1)::integer AS position, ch AS "char"
FROM vpic.wmiyearvalidchars_agg a
CROSS JOIN LATERAL unnest(string_to_array(a.validchars, ';')) AS part
CROSS JOIN LATERAL regexp_split_to_table(split_part(part, ':', 2), '') AS ch;

CREATE INDEX ON vpic.wmiyearvalidchars (wmi, year);
CREATE INDEX ON vpic.wmiyearvalidchars_agg (wmi, year);
CREATE INDEX ON vpic.wmi (wmi);
CREATE INDEX ON vpic.wmi_vinschema (wmiid);
CREATE INDEX ON vpic.wmi_vinschema (vinschemaid);
CREATE INDEX ON vpic.pattern (vinschemaid);
CREATE INDEX ON vpic.wmi_make (wmiid);
CREATE INDEX ON vpic.make_model (modelid);
CREATE INDEX ON vpic.vehiclespecpattern (vspecschemapatternid);
CREATE INDEX ON vpic.vinexception (vin);
CREATE INDEX ON vpic.vindescriptor (descriptor);
ANALYZE;
`;
}

/**
 * The live API checks VIN characters only against WMIYearValidChars; when a
 * (wmi, year) pair is missing it reports no position errors. The PostgreSQL
 * spvindecode_errorcode instead recomputes the characters from patterns. The port
 * follows the live API, so for a like-for-like comparison every missing pair gets a
 * sentinel row at position 0 (never checked): the table is no longer empty, the
 * fallback is skipped, and no position has constraints — the live behaviour.
 */
export function cacheOnlySql(existingPairs = "SELECT wmi, year FROM vpic.wmiyearvalidchars_agg"): string {
  return `
CREATE TEMP TABLE cached_pairs AS ${existingPairs};
CREATE INDEX ON cached_pairs (wmi, year);
INSERT INTO vpic.wmiyearvalidchars (wmi, year, position, "char")
SELECT w.wmi, y.year, 0, '_'
FROM (SELECT DISTINCT wmi FROM vpic.wmi) w
CROSS JOIN generate_series(1980, 2045) AS y(year)
WHERE NOT EXISTS (SELECT 1 FROM cached_pairs a WHERE a.wmi = w.wmi AND a.year = y.year);
ANALYZE vpic.wmiyearvalidchars;
`;
}

/** The same, on a database restored from the original dump. */
export const cacheOnlyDumpSql = (): string => `
-- The dump's id sequence is not advanced past the restored rows
SELECT setval(pg_get_serial_sequence('vpic.wmiyearvalidchars', 'id'), (SELECT max(id) FROM vpic.wmiyearvalidchars));
${cacheOnlySql("SELECT DISTINCT wmi, year FROM vpic.wmiyearvalidchars")}`;
