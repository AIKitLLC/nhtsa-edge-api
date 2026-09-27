import { z } from "zod";

/**
 * Full or partial VIN accepted by the decoder: 1-17 characters, letters, digits or
 * '*' wildcards (the decoder reports invalid characters such as I, O, Q itself).
 */
export const VinQuerySchema = z
  .string()
  .min(3, "VIN must be at least 3 characters")
  .max(17, "VIN must be at most 17 characters")
  .regex(/^[A-Z0-9*]+$/, "VIN must contain only letters, digits or '*' wildcards");

/**
 * Full 17-character VIN (letters I, O, Q are never used in a VIN).
 */
export const FullVinSchema = z
  .string()
  .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN must be exactly 17 characters (I, O and Q are not allowed)");

export type VinParseResult =
  | { readonly ok: true; readonly vin: string }
  | { readonly ok: false; readonly message: string };

/**
 * Normalizes (trim + uppercase) and validates a VIN path parameter.
 */
export function parseVin(raw: string, schema: z.ZodType<string> = VinQuerySchema): VinParseResult {
  const result = schema.safeParse(raw.trim().toUpperCase());
  if (result.success) {
    return { ok: true, vin: result.data };
  }
  return { ok: false, message: result.error.errors[0]?.message ?? "Invalid VIN format" };
}

export type ModelYearParseResult =
  | { readonly ok: true; readonly value: number | null }
  | { readonly ok: false; readonly message: string };

/**
 * Optional model year hint (?modelyear=YYYY), as accepted by vPIC's DecodeVinValues.
 */
export function parseModelYear(raw: string | undefined): ModelYearParseResult {
  if (raw === undefined || raw.trim() === "") return { ok: true, value: null };
  const trimmed = raw.trim();
  if (!/^\d{4}$/.test(trimmed)) return { ok: false, message: "modelyear must be a 4-digit year" };
  return { ok: true, value: Number(trimmed) };
}
