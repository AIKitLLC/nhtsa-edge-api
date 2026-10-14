/**
 * OpenAPI 3.1 description of the public API, served at /openapi.json.
 * It is hand-written; test/openapi.test.ts checks that every path it lists is a real
 * route and that the documented examples decode, so it cannot drift silently.
 */

const VIN = "1HGCM82633A004352";

const vinParam = {
  name: "vin",
  in: "path",
  required: true,
  description: "3 to 17 characters: letters, digits or `*` wildcards. Partial VINs are decoded too.",
  schema: { type: "string", minLength: 3, maxLength: 17, pattern: "^[A-Za-z0-9*]+$" },
  example: VIN,
} as const;

const modelYearParam = {
  name: "modelyear",
  in: "query",
  description: "Model year hint, for VINs where the year cannot be read from the VIN.",
  schema: { type: "string", pattern: "^\\d{4}$", example: "2012" },
} as const;

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const versionHeader = {
  "X-Vpic-Data-Version": { description: "vPIC dump that answered, e.g. vPICList_lite_2026_09.", schema: { type: "string" } },
} as const;

export const OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "AI Kit Data API",
    version: "1.0.0",
    summary: "Offline NHTSA vPIC VIN decoding and related US vehicle data.",
    description:
      "Decodes VINs inside the Worker with a port of NHTSA's `spVinDecode` over the official vPIC dump, checked against NHTSA's SQL and the live API. " +
      "No API key. Requests are limited to 120 per minute per client and location; over the limit the API answers 429 with `Retry-After`. " +
      "Independent project, not affiliated with any U.S. government agency.",
    license: { name: "MIT", url: "https://github.com/AIKitLLC/nhtsa-edge-api/blob/main/LICENSE" },
    contact: { name: "AI Kit LLC", url: "https://github.com/AIKitLLC/nhtsa-edge-api" },
  },
  servers: [{ url: "https://data.ai-kit.net" }],
  tags: [
    { name: "VIN", description: "Offline decoding" },
    { name: "Catalog", description: "Makes and models in the bundled dataset" },
    { name: "vPIC drop-in", description: "Same paths and JSON shape as vpic.nhtsa.dot.gov" },
    { name: "Recalls", description: "Proxied to NHTSA and cached" },
  ],
  paths: {
    "/api/v1/vin/{vin}": {
      get: {
        tags: ["VIN"],
        operationId: "decodeVin",
        summary: "Decode a VIN",
        description: "Clean JSON: typed headline fields plus every decoded attribute keyed by vPIC variable code.",
        parameters: [vinParam, modelYearParam],
        responses: {
          "200": {
            description: "Decoded vehicle",
            headers: versionHeader,
            content: { "application/json": { schema: { $ref: "#/components/schemas/DecodeResponse" } } },
          },
          "400": errorResponse("Invalid VIN or model year"),
          "429": errorResponse("Rate limited"),
        },
      },
    },
    "/api/v1/vin/{vin}/unified": {
      get: {
        tags: ["VIN"],
        operationId: "unifiedProfile",
        summary: "Decode plus US EPA and EU RDW reference data",
        description:
          "Enrichment is at model level, not per vehicle. A failing source is reported in the response and does not fail the request.",
        parameters: [
          vinParam,
          modelYearParam,
          { name: "epa", in: "query", description: "`false` skips the EPA lookup.", schema: { type: "string", enum: ["false"] } },
          { name: "eu", in: "query", description: "`false` skips the RDW lookup.", schema: { type: "string", enum: ["false"] } },
        ],
        responses: {
          "200": { description: "Vehicle profile", content: { "application/json": { schema: { type: "object" } } } },
          "400": errorResponse("Invalid VIN or model year"),
          "429": errorResponse("Rate limited"),
        },
      },
    },
    "/api/v1/vin/{vin}/compare": {
      get: {
        tags: ["VIN"],
        operationId: "compareWithLiveVpic",
        summary: "Compare the offline decode with the live vPIC API",
        description: "Field by field. Calls NHTSA on every request and is never cached.",
        parameters: [vinParam, modelYearParam],
        responses: {
          "200": { description: "List of differing fields", content: { "application/json": { schema: { type: "object" } } } },
          "400": errorResponse("Invalid VIN or model year"),
          "502": errorResponse("NHTSA did not answer"),
          "429": errorResponse("Rate limited"),
        },
      },
    },
    "/api/v1/makes": {
      get: {
        tags: ["Catalog"],
        operationId: "listMakes",
        summary: "Every make in the bundled dataset",
        responses: {
          "200": { description: "Makes", content: { "application/json": { schema: { type: "object" } } } },
          "429": errorResponse("Rate limited"),
        },
      },
    },
    "/api/v1/models": {
      get: {
        tags: ["Catalog"],
        operationId: "listModels",
        summary: "Models of a make",
        parameters: [{ name: "make", in: "query", required: true, schema: { type: "string" }, example: "toyota" }],
        responses: {
          "200": { description: "Models grouped by matching make", content: { "application/json": { schema: { type: "object" } } } },
          "400": errorResponse("Missing make"),
          "404": errorResponse("Unknown make"),
          "429": errorResponse("Rate limited"),
        },
      },
    },
    "/api/v1/recalls/{vin}": {
      get: {
        tags: ["Recalls"],
        operationId: "recallsByVin",
        summary: "Safety recall campaigns for a VIN",
        description: "Proxied to NHTSA and cached for 6 hours; unavailable when NHTSA is.",
        parameters: [{ ...vinParam, description: "Full 17-character VIN (I, O and Q are not used in VINs)." }],
        responses: {
          "200": { description: "Recalls as returned by NHTSA", content: { "application/json": { schema: { type: "object" } } } },
          "400": errorResponse("Invalid VIN"),
          "429": errorResponse("Rate limited"),
        },
      },
    },
    "/vehicles/DecodeVinValues/{vin}": {
      get: {
        tags: ["vPIC drop-in"],
        operationId: "vpicDecodeVinValues",
        summary: "vPIC DecodeVinValues, answered offline",
        parameters: [
          vinParam,
          { name: "format", in: "query", schema: { type: "string", enum: ["json"], default: "json" } },
          modelYearParam,
          { name: "clean", in: "query", description: "`true` drops empty and \"Not Applicable\" values.", schema: { type: "boolean" } },
        ],
        responses: {
          "200": { description: "vPIC envelope", headers: versionHeader, content: { "application/json": { schema: { $ref: "#/components/schemas/VpicEnvelope" } } } },
          "429": errorResponse("Rate limited"),
        },
      },
    },
    "/vehicles/DecodeVin/{vin}": {
      get: {
        tags: ["vPIC drop-in"],
        operationId: "vpicDecodeVin",
        summary: "vPIC DecodeVin (one row per variable), answered offline",
        parameters: [vinParam, { name: "format", in: "query", schema: { type: "string", enum: ["json"], default: "json" } }],
        responses: {
          "200": { description: "vPIC envelope", headers: versionHeader, content: { "application/json": { schema: { $ref: "#/components/schemas/VpicEnvelope" } } } },
          "429": errorResponse("Rate limited"),
        },
      },
    },
    "/vehicles/DecodeVINValuesBatch/": {
      post: {
        tags: ["vPIC drop-in"],
        operationId: "vpicDecodeBatch",
        summary: "vPIC batch decode, up to 50 VINs per request",
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["data"],
                properties: {
                  format: { type: "string", enum: ["json"], default: "json" },
                  data: { type: "string", description: "`VIN[,modelyear];VIN[,modelyear];...`", example: `${VIN};5YJ3E1EB1NF000001,2022` },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "vPIC envelope with one result per entry", headers: versionHeader, content: { "application/json": { schema: { $ref: "#/components/schemas/VpicEnvelope" } } } },
          "400": errorResponse("More than 50 entries, or an invalid VIN"),
          "429": errorResponse("Rate limited"),
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { const: false },
          error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      VpicEnvelope: {
        type: "object",
        properties: {
          Count: { type: "integer" },
          Message: { type: "string" },
          SearchCriteria: { type: "string" },
          Results: { type: "array", items: { type: "object", additionalProperties: true } },
        },
      },
      DecodeResponse: {
        type: "object",
        required: ["success", "data", "dataVersion"],
        properties: {
          success: { const: true },
          source: { const: "LOCAL_VPIC" },
          dataVersion: { type: "string", example: "vPICList_lite_2026_09" },
          decodeMs: { type: "number" },
          data: {
            type: "object",
            description: "Headline fields are null when the VIN does not determine them. `attributes` holds every non-empty decoded value.",
            properties: {
              vin: { type: "string" },
              make: { type: ["string", "null"] },
              model: { type: ["string", "null"] },
              modelYear: { type: ["integer", "null"] },
              trim: { type: ["string", "null"] },
              manufacturer: { type: ["string", "null"] },
              vehicleType: { type: ["string", "null"] },
              bodyClass: { type: ["string", "null"] },
              doors: { type: ["integer", "null"] },
              driveType: { type: ["string", "null"] },
              engineCylinders: { type: ["integer", "null"] },
              displacementL: { type: ["number", "null"] },
              engineHp: { type: ["number", "null"] },
              fuelType: { type: ["string", "null"] },
              electrificationLevel: { type: ["string", "null"] },
              plantCountry: { type: ["string", "null"] },
              errorCodes: { type: "array", items: { type: "integer" } },
              errorText: { type: ["string", "null"] },
              isCleanDecode: { type: "boolean" },
              suggestedVin: { type: ["string", "null"] },
              attributes: { type: "object", additionalProperties: { type: "string" } },
            },
          },
        },
      },
    },
  },
} as const;

export const OPENAPI_EXAMPLE_VIN = VIN;
