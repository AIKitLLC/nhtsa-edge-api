/**
 * The website served to browsers: the hub at / and the VIN decoder at /vpic.
 * API clients keep getting JSON from the same URLs (see routes/health.ts).
 */

export { renderBatchPage } from "./batch";
export { renderDocsPage } from "./docs";
export { DATASETS, renderHub } from "./hub";
export { type PageInfo } from "./layout";
export { SAMPLE_VINS, renderVpicPage } from "./vpic";
