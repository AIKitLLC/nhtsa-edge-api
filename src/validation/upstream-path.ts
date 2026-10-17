import { FullVinSchema, parseVin } from "./vin";

/**
 * Allowlist for the /vehicles/* and /recalls/* proxies.
 * An unknown path used to miss the cache and still call upstream (with the data.gov key
 * on api.nhtsa.gov). Only the endpoints published by vPIC and the recalls API are forwarded.
 * vPIC names are from https://vpic.nhtsa.dot.gov/api/ on 2026-10-17.
 */

const MAX_PATH_LENGTH = 512;
const MAX_SEGMENT_LENGTH = 80;
const MAX_QUERY_VALUE_LENGTH = 128;

/** First character is a letter, digit, or VIN wildcard. The rest is the punctuation vPIC puts in names. */
const SEGMENT_CHARS = /^[A-Za-z0-9*][A-Za-z0-9* .,'_()-]*$/;

const REJECTED =
  "Path is not an allowlisted endpoint, or a segment is empty, too long, or uses a character that is not allowed.";

export type PathDecision = { readonly ok: true; readonly canonicalPath: string } | { readonly ok: false; readonly message: string };

const rejected = (): PathDecision => ({ ok: false, message: REJECTED });

/** One value segment after the endpoint name (a VIN, make, id, or variable). Zero is allowed. */
const VALUE_ENDPOINTS: ReadonlySet<string> = new Set([
  "decodevin",
  "decodevinvalues",
  "decodevinextended",
  "decodevinvaluesextended",
  "decodewmi",
  "getwmisformanufacturer",
  "getmanufacturerdetails",
  "getmakeformanufacturer",
  "getmakesformanufacturerandyear",
  "getmakesforvehicletype",
  "getvehicletypesformake",
  "getvehicletypesformakeid",
  "getequipmentplantcodes",
  "getmodelsformakeid",
  "getmodelsformake",
  "getvehiclevariablevalueslist",
]);

/** No path segments after the endpoint name. Filters are query parameters. */
const BARE_ENDPOINTS: ReadonlySet<string> = new Set([
  "getallmakes",
  "getparts",
  "getallmanufacturers",
  "getvehiclevariablelist",
  "getcanadianvehiclespecifications",
]);

/** Key/value tail. Keys are fixed words; values are segments. */
const PAIR_ENDPOINTS: Readonly<Record<string, readonly string[]>> = {
  getmodelsformakeyear: ["make", "modelyear", "vehicletype"],
  getmodelsformakeidyear: ["makeid", "modelyear", "vehicletype"],
};

/**
 * api.nhtsa.gov paths are case-sensitive. recallsByVin may take the VIN as one more segment;
 * recallsByVehicle takes none (make, model, and year are query parameters).
 */
const RECALLS_ENDPOINTS: Readonly<Record<string, { readonly canonical: string; readonly value: boolean }>> = {
  recallsbyvehicle: { canonical: "recallsByVehicle", value: false },
  recallsbyvin: { canonical: "recallsByVin", value: true },
};

function segmentOk(segment: string): boolean {
  if (segment.length === 0 || segment.length > MAX_SEGMENT_LENGTH) return false;
  if (segment === "." || segment === "..") return false;
  return SEGMENT_CHARS.test(segment);
}

function splitPath(pathname: string): string[] | null {
  if (pathname.length === 0 || pathname.length > MAX_PATH_LENGTH || !pathname.startsWith("/")) return null;
  let path = pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const raw = path.slice(1).split("/");
  if (raw.some((piece) => piece.length === 0)) return null;
  const parts: string[] = [];
  for (const piece of raw) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(piece);
    } catch {
      return null;
    }
    const segment = decoded.trim();
    if (!segmentOk(segment)) return null;
    parts.push(segment);
  }
  return parts;
}

export function allowVehiclesPath(pathname: string): PathDecision {
  const parts = splitPath(pathname);
  if (!parts || parts[0]?.toLowerCase() !== "vehicles" || !parts[1]) return rejected();
  const endpoint = parts[1].toLowerCase();
  const rest = parts.slice(2).map((segment) => segment.toLowerCase());

  if (BARE_ENDPOINTS.has(endpoint)) {
    return rest.length === 0 ? { ok: true, canonicalPath: `/vehicles/${endpoint}` } : rejected();
  }

  if (VALUE_ENDPOINTS.has(endpoint)) {
    if (rest.length > 1) return rejected();
    const tail = rest.length === 1 ? `/${rest[0]}` : "";
    return { ok: true, canonicalPath: `/vehicles/${endpoint}${tail}` };
  }

  const keys = PAIR_ENDPOINTS[endpoint];
  if (!keys || rest.length === 0 || rest.length % 2 !== 0) return rejected();
  const allowed = new Set(keys);
  const seen = new Set<string>();
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (!key || !value || !allowed.has(key) || seen.has(key)) return rejected();
    seen.add(key);
  }
  return { ok: true, canonicalPath: `/vehicles/${endpoint}/${rest.join("/")}` };
}

export function allowRecallsPath(pathname: string): PathDecision {
  const parts = splitPath(pathname);
  if (!parts || parts[0]?.toLowerCase() !== "recalls" || !parts[1]) return rejected();
  const spec = RECALLS_ENDPOINTS[parts[1].toLowerCase()];
  if (!spec) return rejected();
  const rest = parts.slice(2);
  if (!spec.value && rest.length !== 0) return rejected();
  if (spec.value && rest.length > 1) return rejected();
  const tail = rest.length === 1 ? `/${rest[0]?.toUpperCase()}` : "";
  return { ok: true, canonicalPath: `/recalls/${spec.canonical}${tail}` };
}

/** Percent-encode each segment so a space in a variable name cannot change the path. */
export function encodeUpstreamPath(canonicalPath: string): string {
  return canonicalPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

const FORMATS: ReadonlySet<string> = new Set(["json", "xml", "csv"]);
const YEAR_KEYS: ReadonlySet<string> = new Set(["year", "modelyear"]);
const CAMPAIGN = /^\d{2}[A-Z]\d{6}$/;
const PAGE = /^[1-9]\d{0,2}$/;

export interface CatalogNames {
  readonly makeByUpper: ReadonlyMap<string, string>;
  readonly variables: ReadonlySet<string>;
}

/** Uppercased make names (value is the bundled spelling) and variable names plus element ids. */
export function catalogFrom(
  makes: readonly { readonly name: string }[],
  elements: readonly { readonly id: number; readonly name: string }[]
): CatalogNames {
  const makeByUpper = new Map<string, string>();
  for (const make of makes) {
    const trimmed = make.name.trim();
    const key = trimmed.toUpperCase();
    if (key.length > 0 && !makeByUpper.has(key)) makeByUpper.set(key, trimmed);
  }
  const variables = new Set<string>();
  for (const element of elements) {
    const name = element.name.trim().toUpperCase();
    if (name.length > 0) variables.add(name);
    variables.add(String(element.id));
  }
  return { makeByUpper, variables };
}

function makeOk(value: string, catalog: CatalogNames): string | null {
  const trimmed = value.trim();
  if (trimmed === "*") return "*";
  return catalog.makeByUpper.get(trimmed.toUpperCase()) ?? null;
}

function variableOk(value: string, catalog: CatalogNames): boolean {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return catalog.variables.has(trimmed);
  return catalog.variables.has(trimmed.toUpperCase());
}

/** Make and variable path segments, and a 4-digit modelyear pair, must match the bundled tables. */
function pathValuesOk(canonicalPath: string, catalog: CatalogNames): boolean {
  const parts = canonicalPath.split("/").filter((part) => part.length > 0);
  const endpoint = parts[1];
  const rest = parts.slice(2);
  if (parts[0] === "recalls" && endpoint === "recallsByVin" && rest[0] && !parseVin(rest[0], FullVinSchema).ok) {
    return false;
  }
  if (parts[0] !== "vehicles" || !endpoint) return true;
  if ((endpoint === "getmodelsformake" || endpoint === "getvehicletypesformake") && rest[0] && !makeOk(rest[0], catalog)) {
    return false;
  }
  if (endpoint === "getvehiclevariablevalueslist" && rest[0] && !variableOk(rest[0], catalog)) return false;
  if (endpoint === "getmodelsformakeyear" || endpoint === "getmodelsformakeidyear") {
    for (let i = 0; i < rest.length; i += 2) {
      const key = rest[i];
      const value = rest[i + 1];
      if (!key || value === undefined) return false;
      if (key === "make" && !makeOk(value, catalog)) return false;
      if (key === "modelyear" && !/^\d{4}$/.test(value)) return false;
    }
  }
  return true;
}

/**
 * Rejects query values that would mint a cache entry per byte of junk, then writes the
 * canonical spelling back so case variants share one entry. Returns false before any upstream call.
 */
export function normalizeProxyQuery(query: URLSearchParams, catalog: CatalogNames): boolean {
  for (const [key, value] of [...query.entries()]) {
    if (value.length > MAX_QUERY_VALUE_LENGTH) return false;
    if (/[\u0000-\u001F\u007F]/.test(value)) return false;
    const name = key.toLowerCase();
    if (name === "format") {
      const format = value.toLowerCase();
      if (!FORMATS.has(format)) return false;
      query.set(key, format);
    } else if (YEAR_KEYS.has(name)) {
      if (!/^\d{4}$/.test(value)) return false;
    } else if (name === "page") {
      if (!PAGE.test(value) || Number(value) > 999) return false;
    } else if (name === "vin") {
      const parsed = parseVin(value, FullVinSchema);
      if (!parsed.ok) return false;
      query.set(key, parsed.vin);
    } else if (name === "campaignnumber") {
      const campaign = value.trim().toUpperCase();
      if (!CAMPAIGN.test(campaign)) return false;
      query.set(key, campaign);
    } else if (name === "make") {
      const canonical = makeOk(value, catalog);
      if (!canonical) return false;
      query.set(key, canonical);
    } else if (name === "variable" && !variableOk(value, catalog)) {
      return false;
    }
  }
  return true;
}

/** Path catalog check plus query normalization. Mutates `query` when the values are valid. */
export function proxyInputOk(canonicalPath: string, query: URLSearchParams, catalog: CatalogNames): boolean {
  return pathValuesOk(canonicalPath, catalog) && normalizeProxyQuery(query, catalog);
}
