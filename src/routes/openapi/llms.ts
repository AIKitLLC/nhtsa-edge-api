/** /llms.txt: a plain-text summary for AI agents and crawlers (https://llmstxt.org). */

import { OPENAPI_EXAMPLE_VIN } from "./spec";

const SITE = "https://data.ai-kit.net";

export const LLMS_TXT = `# AI Kit Data

> Offline NHTSA vPIC VIN decoding at the edge, plus related US vehicle data. No API key. Independent project by AI Kit LLC, not affiliated with any U.S. government agency.

Decode a VIN with one GET request, for example:

    curl -s ${SITE}/api/v1/vin/${OPENAPI_EXAMPLE_VIN}

The response has \`data.make\`, \`data.model\`, \`data.modelYear\`, \`data.isCleanDecode\` and \`data.attributes\` (every decoded vPIC variable). Check \`data.errorCodes\` before trusting a result: partial or invalid VINs are decoded as far as possible and flagged. Requests are limited to 120 per minute per client; a 429 carries Retry-After.

## API

- [OpenAPI 3.1 description](${SITE}/openapi.json): every endpoint, parameter and response
- [API reference](${SITE}/docs): the same, as a web page
- [VIN decoder](${SITE}/vpic): interactive decoder, single and batch

## Data and accuracy

- [Data pipeline and verification](https://github.com/AIKitLLC/nhtsa-edge-api/blob/main/docs/DATA.md): the decoder is compared with NHTSA's own SQL functions on the original dump, and with the live vPIC API
- [Known defects in NHTSA's dump](https://github.com/AIKitLLC/nhtsa-edge-api/blob/main/docs/NHTSA-ERRATA.md)
- [Source code, MIT](https://github.com/AIKitLLC/nhtsa-edge-api)

## Limits

- Only vPIC decoding is fully offline. Recalls are proxied to NHTSA and cached; EPA and RDW enrichment is at model level, not per vehicle.
- Results can differ from the live vPIC API where NHTSA has published newer data than the monthly dump the service serves; every response states its data version in \`X-Vpic-Data-Version\`.
`;
