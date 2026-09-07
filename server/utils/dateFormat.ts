import { format } from "date-fns";
import { vi } from "date-fns/locale";

/**
 * Safely parses any date representation (Date object, ISO string, numeric timestamp, etc.)
 * Returns null if the value cannot be parsed into a valid Date.
 */
export function parseToDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === "object") {
    if (typeof val.toDate === "function") {
      const d = val.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    // Handle serialized empty objects or unexpected objects
    return null;
  }
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Safely formats a date value without throwing RangeError: Invalid time value.
 * If the date is invalid or empty, returns the provided fallback string.
 */
export function safeFormatDate(
  val: any,
  pattern: string,
  fallback: string = "Thời gian linh hoạt",
  options?: { locale?: any }
): string {
  const d = parseToDate(val);
  if (!d) return fallback;
  try {
    return format(d, pattern, options || { locale: vi });
  } catch (err) {
    return fallback;
  }
}
