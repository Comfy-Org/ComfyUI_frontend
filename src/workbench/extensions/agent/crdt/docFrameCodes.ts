export const STALE_SCHEMA_RESEED_REQUIRED = 'stale_schema_reseed_required'
export const RESEED_CONFLICT = 'conflict'

const RETRYABLE_RESEED_CODES = new Set([
  'retry',
  'unavailable',
  'overloaded',
  'error'
])

export function isRetryableReseedCode(code: string | undefined): boolean {
  return code !== undefined && RETRYABLE_RESEED_CODES.has(code)
}
