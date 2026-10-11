/**
 * `emitted(name)` is typed as always returning an array of emissions, but
 * returns undefined for an event the component never emitted. Reading a
 * payload off it directly throws before the test can report the real failure,
 * so narrow through these helpers instead of asserting the shape.
 */
export function lastEmission(
  emissions: unknown[] | undefined
): unknown[] | undefined {
  const last = emissions?.at(-1)
  return Array.isArray(last) ? last : undefined
}

/** First argument of the most recent emission, when it is a number. */
export function lastNumberEmitted(
  emissions: unknown[] | undefined
): number | undefined {
  const [value] = lastEmission(emissions) ?? []
  return typeof value === 'number' ? value : undefined
}
