/**
 * Narrow an unknown caught value to an Error.
 *
 * Replaces unsafe `value as Error` assertions. When `value` is not already
 * an Error instance, wraps it in a new Error whose message is the stringified
 * input so downstream consumers (loggers, Sentry, toasts) always receive a
 * usable Error object instead of `undefined.message`.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string') return new Error(value)
  if (value === undefined) return new Error('undefined')
  try {
    const serialised = JSON.stringify(value)
    return new Error(serialised ?? String(value))
  } catch {
    return new Error(String(value))
  }
}

/**
 * Extract a message from an unknown caught value without asserting its type.
 * Returns `undefined` when the value carries no usable message.
 */
export function getErrorMessage(value: unknown): string | undefined {
  if (value instanceof Error) return value.message
  if (typeof value === 'string') return value
  if (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  ) {
    return (value as { message: string }).message
  }
  return undefined
}
