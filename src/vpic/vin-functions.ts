/**
 * Scalar VIN functions ported from the vPIC dump
 * (docs/vpic-reference/decode-functions.sql):
 *   vpic.fVinWMI, vpic.fVinDescriptor, vpic.fVINCheckDigit, vpic.fVINCheckDigit2,
 *   vpic.fVinModelYear2
 */

/** vpic.fVinWMI: 3 characters, or 6 (1-3 + 12-14) when position 3 is '9'. */
export function vinWmi(vin: string): string {
  let wmi = vin.length > 3 ? vin.substring(0, 3) : vin;
  if (wmi.charAt(2) === "9" && vin.length >= 14) {
    wmi += vin.substring(11, 14);
  }
  return wmi;
}

/** vpic.fVinDescriptor: VIN padded with '*', check digit masked, first 11 (or 14) chars. */
export function vinDescriptor(vin: string): string {
  let padded = `${vin.trim()}*****************`.substring(0, 17);
  padded = `${padded.substring(0, 8)}*${padded.substring(9)}`;
  const descriptor = padded.charAt(2) === "9" ? padded.substring(0, 14) : padded.substring(0, 11);
  return descriptor.toUpperCase();
}

const TRANSLITERATION: Readonly<Record<string, number>> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const WEIGHTS: readonly number[] = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

// Patterns use `~*` (case-insensitive); the ',' inside the classes is literal, as in the source.
const PATTERN_DEFAULT = /^[a-h,j-n,p,r-z,0-9]/i;
const PATTERN_MY = /^[a-h,j-n,p,r-t,v-y,1-9]/i;
const PATTERN_NUMBERS = /^[0-9]/i;

function checkDigit(vin: string, patternFor: (pos: number) => RegExp): string {
  if (vin.length !== 17) return "";
  let sum = 0;
  for (let i = 1; i <= 17; i++) {
    const ch = vin.charAt(i - 1);
    if (!patternFor(i).test(ch)) return "?";
    const value = TRANSLITERATION[ch] ?? -1;
    sum += value * (WEIGHTS[i - 1] ?? 0);
  }
  // Equivalent to the REAL arithmetic of the source for the value range of a VIN sum
  const remainder = ((sum % 11) + 11) % 11;
  return remainder === 10 ? "X" : String(remainder);
}

/** vpic.fVINCheckDigit (used by the error-correction step). */
export function vinCheckDigit(vin: string): string {
  const pos3 = vin.charAt(2);
  return checkDigit(vin, (i) => {
    if (i === 10) return PATTERN_MY;
    if ((i === 13 || i === 14) && pos3 === "9") return PATTERN_DEFAULT;
    if ((i === 13 || i === 14) && pos3 !== "9") return PATTERN_NUMBERS;
    if (i >= 15) return PATTERN_NUMBERS;
    return PATTERN_DEFAULT;
  });
}

/** vpic.fVINCheckDigit2 (used for error code 1). */
export function vinCheckDigit2(vin: string, isCarMpvLt: boolean): string {
  const pos3 = vin.charAt(2);
  return checkDigit(vin, (i) => {
    if (i === 10) return PATTERN_MY;
    if (i === 13 && pos3 !== "9" && isCarMpvLt) return PATTERN_NUMBERS;
    if (i === 14 && pos3 !== "9") return PATTERN_NUMBERS;
    if (i >= 15) return PATTERN_NUMBERS;
    return PATTERN_DEFAULT;
  });
}

/** Model-year cycle from position 10 (A=2010 ... Y=2030, 1=2031 ... 9=2039). */
function baseModelYear(pos10: string): number | null {
  const code = pos10.charCodeAt(0);
  const a = "A".charCodeAt(0);
  if (pos10 >= "A" && pos10 <= "H") return 2010 + code - a;
  if (pos10 >= "J" && pos10 <= "N") return 2010 + code - a - 1;
  if (pos10 === "P") return 2023;
  if (pos10 >= "R" && pos10 <= "T") return 2010 + code - a - 3;
  if (pos10 >= "V" && pos10 <= "Y") return 2010 + code - a - 4;
  if (pos10 >= "1" && pos10 <= "9") return 2031 + code - "1".charCodeAt(0);
  return null;
}

export interface WmiTypeInfo {
  readonly vehicleTypeId: number | null;
  readonly truckTypeId: number | null;
}

/** Passenger car, MPV, or light truck (TruckTypeId 1): the 49 CFR 565 model-year rule applies. */
export function isCarMpvLightTruck(info: WmiTypeInfo | null): boolean {
  if (!info) return false;
  return info.vehicleTypeId === 2 || info.vehicleTypeId === 7 || (info.vehicleTypeId === 3 && info.truckTypeId === 1);
}

/**
 * vpic.fVinModelYear2: positive when conclusive, negated when only a guess,
 * null when position 10 is not a model-year code.
 */
export function vinModelYear2(vin: string, wmiInfo: WmiTypeInfo | null, now: Date): number | null {
  const upper = vin.toUpperCase();
  if (upper.length < 10) return null;

  let modelYear = baseModelYear(upper.charAt(9));
  if (modelYear === null) return null;

  let conclusive = false;
  // fVinWMI is never null for a VIN of length >= 10
  const carLt = isCarMpvLightTruck(wmiInfo);
  const pos7 = upper.charAt(6);
  if (carLt && /^[0-9]$/.test(pos7)) {
    modelYear -= 30;
    conclusive = true;
  }
  if (carLt && /^[A-Z]$/.test(pos7)) {
    conclusive = true;
  }
  if (modelYear > now.getUTCFullYear() + 2) {
    modelYear -= 30;
    conclusive = true;
  }

  return conclusive ? modelYear : -modelYear;
}
