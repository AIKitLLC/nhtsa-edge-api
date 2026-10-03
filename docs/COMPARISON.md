# How this compares

Three ways to decode a VIN from NHTSA's vPIC data. They share one source, so the right
choice depends on where you want the work done, not on whose data is "better".

| | NHTSA vPIC API | A library that bundles vPIC (e.g. Corgi) | This service |
| :-- | :-- | :-- | :-- |
| Where decoding runs | NHTSA's servers | Inside your process | Cloudflare edge, over HTTPS |
| Network call per decode | Yes, to NHTSA | No | Yes, to this service (no call to NHTSA) |
| You install / ship | Nothing | A package and its database | Nothing |
| Works when NHTSA is down | No | Yes | Yes |
| Works when the maintainer's service is down | n/a | Yes | No |
| Output shape | vPIC's own | The library's own | vPIC's own (drop-in), plus a clean v1 JSON |
| Data freshness | Live | Whatever release you installed | Weekly refresh of NHTSA's monthly dump |
| Limits | Not published; see below | None (your hardware) | 120 requests/min per client and location |

## NHTSA vPIC API

The reference. It is the right choice when you need NHTSA's latest edits the day they are
made, or when a handful of lookups a day does not justify anything else.

- A batch call takes up to 50 VINs. This service enforces the same limit on its
  drop-in batch endpoint.
- NHTSA does not publish a rate limit. Third-party write-ups report HTTP 429 under sustained
  load and multi-second response times ([one example](https://eitserv.tech/en/blog/nhtsa-vin-decoder-api-tutorial)); we have not measured this ourselves.
  Run `scripts/benchmark.sh <base-url>` from your own network to measure both sides.

## Libraries that bundle vPIC

[Corgi](https://github.com/cardog-ai/corgi) (`@cardog/corgi`) is the best-known one. From its
own materials: fully offline, TypeScript, runs in Node, browsers and Cloudflare Workers, ships
a database of roughly 20 MB compressed, and v3 moved to precomputed binary indexes for speed
([README](https://app.unpkg.com/@cardog/corgi@2.0.4/files/README.md),
[v3 write-up](https://cardog.app/blog/corgi-v3-binary-indexes)).

Choose a library when you decode at high volume, need no network dependency at all, or run
somewhere that cannot call out. It will beat any HTTP service on latency, including this one,
because nothing leaves the process.

We have not run Corgi against this decoder, so we make **no claim about which is more
accurate or faster**. Both start from the same NHTSA data. What we can say is what we check
on our side, below.

## This service

Choose it when you want vPIC-shaped answers without running anything, or you have a client
that already speaks vPIC and you want it to stop depending on NHTSA's availability.

What it adds, and how to check each claim:

| Claim | How to check it |
| :-- | :-- |
| The decoder reproduces NHTSA's own `spVinDecode` | Weekly CI restores NHTSA's original dump in PostgreSQL and compares this decoder with NHTSA's SQL functions: 0 unexplained differences on 11,000 VINs. Method and numbers: [DATA.md](DATA.md#verification-against-the-reference-sql-functions) |
| It matches the live API | A fixed sample of 1,000 VINs is compared field by field with the live vPIC API; about 95% are identical on every field, and the rest is newer live data. The gate fails below 85% |
| Defects in NHTSA's dump are handled and written down | [NHTSA-ERRATA.md](NHTSA-ERRATA.md), with VINs that reproduce each one |
| Data changes are reviewable | `data/vpic` is committed to git; an update is a diff and a revert is `git revert` |
| Decode time | Server-side p50 1.4 ms, p95 6.2 ms ([README](../README.md)); this excludes the network to the edge, which dominates for a single call |

## Limits worth knowing

- **Only vPIC is fully offline.** Recalls are proxied to NHTSA and cached; EPA and RDW
  enrichment is at model level, not per vehicle.
- **Not live.** Results can differ from the live API wherever NHTSA edited data after the dump
  this service serves. Every response carries `X-Vpic-Data-Version`, and `/api/v1/vin/:vin/compare`
  shows the difference for one VIN.
- **One deployment.** If this service is down you are down, unlike a library. It runs on
  Cloudflare Workers and is rate limited to protect that cost.
- **Not affiliated with NHTSA.** Independent project; the data is a U.S. Government work.

## Reproduce

```bash
pnpm install && pnpm build:data
pnpm test                          # decoder vs recorded live results and the SQL-derived pins
scripts/benchmark.sh https://data.ai-kit.net 50   # latency from your network, vs live vPIC
```

Found a number here that you cannot reproduce? Open an issue; that is a bug in this document.
