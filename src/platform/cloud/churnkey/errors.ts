/**
 * Thrown when the backend's `/billing/churnkey/auth` endpoint is missing
 * (e.g. backend hasn't been deployed yet). Callers should treat this the
 * same as Churnkey not being configured at all and fall back to the
 * legacy cancel dialog rather than surfacing a toast.
 */
export class ChurnkeyAuthUnavailableError extends Error {
  constructor() {
    super('Churnkey auth endpoint not available')
    this.name = 'ChurnkeyAuthUnavailableError'
  }
}

/**
 * Thrown when the Churnkey embed script fails to load — network failure or,
 * more likely, an ad blocker (churn-prevention scripts are on common
 * blocklists). Callers must fall back to the legacy cancel dialog so the
 * user always has a way to cancel.
 */
export class ChurnkeyEmbedLoadError extends Error {
  constructor() {
    super('Churnkey embed script failed to load')
    this.name = 'ChurnkeyEmbedLoadError'
  }
}
