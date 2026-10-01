/**
 * `doc_subscribed` refusal for a stored document the server can no longer
 * read (an older document schema). Sent only to a subscribe that advertised
 * `supports_reseed`; the follower answers it once with a `doc_reseed`
 * carrying the canvas it shows.
 *
 * Kept out of `docFrameClient.ts` so a suite that module-mocks the client
 * still sees the real value.
 */
export const STALE_SCHEMA_RESEED_REQUIRED = 'stale_schema_reseed_required'
export const RESEED_CONFLICT = 'conflict'
/**
 * The permanent `doc_subscribed` refusal a host sent for an unreadable stored
 * document BEFORE `supports_reseed` existed, and still sends to a subscribe
 * that does not advertise it. A refusal this tab cannot answer with a reseed
 * is that same state, so it is reported as this code — see
 * `useAgentCrdtFollower`'s `unanswerableRefusal`.
 */
export const SCHEMA_VERSION_MISMATCH = 'schema_version_mismatch'

const RETRYABLE_RESEED_CODES = new Set([
  'retry',
  'unavailable',
  'overloaded',
  'error'
])

export function isRetryableReseedCode(code: string | undefined): boolean {
  return code !== undefined && RETRYABLE_RESEED_CODES.has(code)
}
