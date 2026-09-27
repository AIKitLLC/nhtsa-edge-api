import type { MiddlewareHandler } from "hono";

/**
 * Universal CORS middleware allowing web and mobile apps to call the API freely
 */
export const corsMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    if (c.req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    await next();

    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    return;
  };
};
