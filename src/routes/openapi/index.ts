import { Hono } from "hono";
import type { Env } from "../../types/env";
import { LLMS_TXT } from "./llms";
import { OPENAPI } from "./spec";

/** /openapi.json and /llms.txt: static documents, cacheable by browsers and the CDN. */
export const openapiRouter = new Hono<{ Bindings: Env }>();

const CACHE = "public, max-age=3600";

openapiRouter.get("/openapi.json", (c) => {
  c.header("Cache-Control", CACHE);
  return c.json(OPENAPI);
});

openapiRouter.get("/llms.txt", (c) => {
  c.header("Cache-Control", CACHE);
  return c.text(LLMS_TXT);
});
