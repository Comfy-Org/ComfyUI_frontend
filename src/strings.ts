import type { ISlotType } from "./litegraph"

/**
 * Uses the standard String() function to coerce to string, unless the value is null or undefined - then null.
 * @param value The value to convert
 * @returns String(value) or null
 */
export function stringOrNull(value: unknown): string | null {
  return value == null ? null : String(value)
}

/**
 * Uses the standard String() function to coerce to string, unless the value is null or undefined - then an empty string
 * @param value The value to convert
 * @returns String(value) or ""
 */
export function stringOrEmpty(value: unknown): string {
  return value == null ? "" : String(value)
}

export function parseSlotTypes(type: ISlotType): string[] {
  return type == "" || type == "0" ? ["*"] : String(type).toLowerCase().split(",")
}
