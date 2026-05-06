/**
 * Build an opaque composite-key string from a tuple of values, suitable for
 * use as a Map or Set key. Uses JSON.stringify so the encoding is injective
 * across arbitrary string inputs (no separator collision possible). Keep the
 * format opaque at consumer boundaries — do not parse it externally except
 * in modules that own the round-trip (e.g. favoritedWidgetsStore).
 */
export function makeCompositeKey(parts: readonly unknown[]): string {
  return JSON.stringify(parts)
}
