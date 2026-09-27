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
