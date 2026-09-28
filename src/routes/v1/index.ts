import { Hono } from "hono";
import type { Env } from "../../types/env";
import { vinRouter } from "./vin";
import { catalogRouter } from "./catalog";
import { recallsRouter } from "./recalls";
import { unifiedRouter } from "./unified";

/**
 * Clean v1 REST API, mounted at /api/v1.
 */
export const v1Router = new Hono<{ Bindings: Env }>();

v1Router.route("/", vinRouter);
v1Router.route("/", unifiedRouter);
v1Router.route("/", catalogRouter);
v1Router.route("/", recallsRouter);
