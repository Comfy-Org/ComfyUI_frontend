/**
 * How long the deployment listing request may take once sent. Ingest
 * answers it with several upstream calls in a row (deployments, builds,
 * then each Build's Releases).
 */
export const DEPLOYMENT_LISTING_TIMEOUT_MS = 30_000

/**
 * How long the editor's missing-model check waits for the boot listing
 * before it checks the library as on Comfy Cloud. The request timeout only
 * starts once the sign-in step before it has answered, and that step can
 * hang (the token exchange is a plain fetch), so this ceiling sits above
 * it: a listing that answers within the request timeout is still waited
 * for, and a hung sign-in never holds the check forever.
 */
export const DEPLOYMENT_LISTING_BACKSTOP_MS =
  DEPLOYMENT_LISTING_TIMEOUT_MS + 15_000

/**
 * The pauses before each retry of the page's boot listing when it fails
 * without a definite answer (a 5xx, a 408 or 429, a network error, a
 * request timeout): three attempts in all. The editor's boot waits no
 * longer than `DEPLOYMENT_LISTING_BACKSTOP_MS` for them.
 */
export const DEPLOYMENT_LISTING_RETRY_DELAYS_MS: readonly number[] = [
  1_000, 2_000
]

/** How long the boot waits for the listing when this browser has no deployment hint or link. */
export const DEPLOYMENT_LISTING_NO_HINT_WAIT_MS = 5_000

/** Minimum gap between focus-triggered listing retries. */
export const DEPLOYMENT_LISTING_FOCUS_RETRY_MS = 60_000
