/**
 * Deep-clone a widget value for inline serialization or per-instance
 * isolation. Uses `structuredClone` (handles `Date`, `Map`/`Set`, `BigInt`)
 * with a raw-reference fallback so malformed blobs (circular refs, throwing
 * `toJSON`, functions/symbols, etc.) cannot abort an entire serialize or
 * configure pass.
 */
export function cloneWidgetValue<TValue>(value: TValue): TValue {
  if (value == null || typeof value !== 'object') return value
  try {
    return structuredClone(value)
  } catch {
    return value
  }
}
