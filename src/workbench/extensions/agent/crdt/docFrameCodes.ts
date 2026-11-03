export const SERVER_DOC_FRAME_TYPES = [
  'doc_update',
  'doc_subscribed',
  'doc_ops_result',
  'doc_reset',
  'doc_reseed_result',
  'awareness'
] as const

export type ServerDocFrameType = (typeof SERVER_DOC_FRAME_TYPES)[number]

const PERMANENT_DOC_SUBSCRIBE_REFUSAL_CODES = [
  'schema_version_mismatch',
  'catalog_mismatch',
  'unsupported'
] as const
export type PermanentDocSubscribeRefusalCode =
  (typeof PERMANENT_DOC_SUBSCRIBE_REFUSAL_CODES)[number]

const PERMANENT_SUBSCRIBE_REFUSAL_CODES: ReadonlySet<string> = new Set(
  PERMANENT_DOC_SUBSCRIBE_REFUSAL_CODES
)

export function isPermanentSubscribeRefusalCode(
  code: string
): code is PermanentDocSubscribeRefusalCode {
  return PERMANENT_SUBSCRIBE_REFUSAL_CODES.has(code)
}

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
