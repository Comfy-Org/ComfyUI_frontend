/** Widens values whose public type is stricter than legacy extension reality. */
export function extensionValue<T>(value: T): T | null | undefined {
  return value
}
