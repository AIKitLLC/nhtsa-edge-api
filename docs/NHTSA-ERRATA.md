# NHTSA vPIC errata

Defects found in the official vPIC PostgreSQL dump (`vPICList_lite_2026_09`) while
porting and verifying its decoder, with the evidence and what this project does about
each. Findings are reproduced on every weekly run by `scripts/vpic/errata/audit.ts`
(job summary and the `vpic-parity` artifact of the `vPIC data refresh & dev deploy`
workflow), against the dump restored unchanged in PostgreSQL and the live vPIC API.

| Id | Where | Defect | Live API | This project |
| :-- | :-- | :-- | :-- | :-- |
| E1 | `vpic.spvindecode` (code) | `VinDescriptor` model-year overrides never apply | correct | **Fixed** |
| E2 | `vpic.WMIYearValidChars_CacheExceptions` + `spvindecode_errorcode` (code) | column referenced as `wmi` resolves to the outer query; latent while the table is empty | unknown | Documented, monitored |
| E3 | `vpic.Pattern` 1650796 (data) | references Model 28450, which is not in `vpic.Model` | same defect; returns the raw id `28450` as the model name | Model left empty (documented) |
| E4 | `vpic.VinSchema` (data) | 6 schemas not linked to any WMI | — | Harmless (never used) |
| C1 | `vpic.Wmi` | 2 WMIs contain `O` (`1OY`, `4OG`) | same | Kept: manufacturer registrations |
| C2 | `vpic.Pattern` | 628 keys contain a literal `I`, `O` or `Q` | same | Kept: describe VINs that exist |

(Audit ids: E1 → audit E1, E3 → audit E4, E4 → audit E5, C1/C2 → audit E2/E3.)

---

## E1 — `VinDescriptor` overrides never apply in the dump's `spvindecode` (fixed)

`vpic.VinDescriptor` lists 11- or 14-character VIN descriptors whose model year NHTSA
overrides, because the manufacturer coded position 10 for the wrong year. The dump's
function reads it before the VIN is set:

```sql
vin varchar(17) = '';                               -- declaration
...
var_descriptor = vpic.fVinDescriptor(vin);          -- computed from '' → '********'
vin = upper(trim(v));                               -- the VIN is assigned only here
select vd.ModelYear into dmy from vpic.VinDescriptor vd where vd.Descriptor = var_descriptor;
```

`dmy` is therefore always NULL and pass 1 (descriptor year) never runs. The pass 1 call
also passes an undeclared variable `descriptor`, so the branch would fail if it were
reached.

**Evidence** (VINs built from the descriptors, valid check digit):

| VIN | `VinDescriptor` year | dump `spvindecode` | live `DecodeVinValues` |
| :-- | --: | --: | --: |
| `KNDJH741485111111` | 2009 | 2008 | **2009** |
| `KNDJH742385111111` | 2009 | 2008 | **2009** |
| `KNDJJ741985111111` | 2009 | 2008 | **2009** |
| `KMHGC4DH8BU111111` | 2012 | 2011 | **2012** |

The other 65 of the 69 descriptors decode to the same year either way.

**Fix:** `src/vpic/decode.ts` computes the descriptor from the VIN, as the live API does.
Covered by `test/vpic/errata.test.ts`; the SQL comparison classifies these VINs as
`erratum-E1` instead of failing.

## E2 — `WMIYearValidChars_CacheExceptions` column mismatch (latent)

`spvindecode_errorcode` excludes cached valid characters for listed WMIs with:

```sql
AND var_wmi NOT IN (SELECT DISTINCT wmi FROM vpic.WMIYearValidChars_CacheExceptions)
```

In the dump the table's columns are `WMI`, `CreatedOn`, `Id`, created with quoted
identifiers, so there is no lower-case `wmi` column. PostgreSQL then resolves `wmi` to the
outer `WMIYearValidChars.wmi`, which equals `var_wmi`. The condition becomes
`var_wmi NOT IN (var_wmi, …)`: as soon as the table holds **any** row, every WMI
loses its cached characters and falls back to recomputing them from patterns.

The table is empty in `vPICList_lite_2026_09`, so decoding is unaffected today.
`scripts/vpic/sql-verify/projection.ts` reports its columns and row count on every
run, and fails the data update if it ever has rows.

## E3 — Pattern refers to a Model that is not in the dump

Pattern 1650796 (schema "YADEA TECHNOLOGY GROUP CO. LTD - Schema for Motorcycle
L5X/LR4", keys `U1`, element Model) has attribute id `28450`, which `vpic.Model` does
not contain. For `L5XU10006M1000001` the live API returns `Model: "28450"`,
`ModelID: "28450"` and an empty Make. The live database has the same missing row and
shows the id as if it were a name.

This project returns an empty Model, as the dump's function does. Printing an id as a
model name would be wrong, and the real name is not available from any NHTSA source.

## E4 — Unused VIN schemas

6 rows of `vpic.VinSchema` are not linked to any WMI through `Wmi_VinSchema`, so no VIN
can reach them. No effect on decoding.

## C1, C2 — `I`, `O`, `Q` in WMIs and pattern keys (compliance, not defects)

49 CFR 565.15 excludes `I`, `O` and `Q` from every VIN position. The dump nevertheless
registers WMIs `1OY` (J D Bertolini Industries) and `4OG` (Flex-King Corporation), both
trailer makers, and 628 pattern keys with such letters (mostly trailers, buses and
motorcycles from small manufacturers). These are manufacturer submissions describing
VINs that were actually stamped. The data is kept as is, so those real, non-compliant
VINs still decode as NHTSA's own service decodes them.

---

Reported upstream: not yet. The evidence above is self-contained for a report to NHTSA's
vPIC team (contact via https://vpic.nhtsa.dot.gov).
