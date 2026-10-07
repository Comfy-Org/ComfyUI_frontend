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
