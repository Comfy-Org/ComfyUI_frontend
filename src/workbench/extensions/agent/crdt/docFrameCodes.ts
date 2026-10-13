import type { ServerDocFrame } from './docFrameClient'

const SERVER_DOC_FRAMES: Record<ServerDocFrame['type'], true> = {
  doc_update: true,
  doc_subscribed: true,
  doc_ops_result: true,
  doc_reset: true,
  doc_reseed_result: true,
  awareness: true
}

export const SERVER_DOC_FRAME_TYPES = Object.keys(SERVER_DOC_FRAMES)

export const STALE_SCHEMA_RESEED_REQUIRED = 'stale_schema_reseed_required'
export const RESEED_CONFLICT = 'conflict'

type RetryableReseedCode = 'retry' | 'unavailable' | 'overloaded' | 'error'

const RETRYABLE_RESEED_CODES: ReadonlySet<string> =
  new Set<RetryableReseedCode>([
    'retry',
    'unavailable',
    'overloaded',
    'error'
  ] as const)

export function isRetryableReseedCode(
  code: string | undefined
): code is RetryableReseedCode {
  return code !== undefined && RETRYABLE_RESEED_CODES.has(code)
}
