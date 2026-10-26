/**
 * Narrows an unknown parsed-JSON value to an indexable object.
 *
 * Arrays are excluded. The predicate claims `Record<string, unknown>`, which an
 * array is not, so admitting one lets a caller index it by string key with no
 * complaint from the compiler. This also matches the sibling guards already in
 * `browser_tests/fixtures/customNode/`, so the name means one thing across the
 * fixtures.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
