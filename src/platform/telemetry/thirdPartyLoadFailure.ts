/**
 * Messages a browser produces when a script or module request never reaches the
 * network — the signature of a client-side blocker (ad blocker, tracking
 * protection, corporate proxy, strict DNS) rather than of anything we shipped.
 * Chromium, Firefox and WebKit each word this differently, hence the list.
 *
 * Deliberately narrow: a vendor 5xx, a malformed response, or a bug in our own
 * initialisation produces none of these and stays an error.
 */
const BLOCKED_LOAD_MESSAGES = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'unable to preload css',
  'err_blocked_by_client',
  'networkerror',
  'network error',
  'load failed',
  'failed to fetch'
] as const

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

/**
 * True when the failure is a request the client refused to make, so nothing in
 * the product actually broke.
 */
export function isBlockedThirdPartyLoad(error: unknown): boolean {
  const text = errorText(error).toLowerCase()
  return BLOCKED_LOAD_MESSAGES.some((message) => text.includes(message))
}

/**
 * Reports a third-party analytics SDK that failed to load. A blocked request is
 * a warning — the user's choice, not a defect — while anything else keeps the
 * error level so real load failures stay visible in RUM.
 */
export function reportThirdPartyLoadFailure(
  providerName: string,
  error: unknown
): void {
  if (isBlockedThirdPartyLoad(error)) {
    console.warn(
      `${providerName} analytics did not load; the client appears to be blocking it:`,
      error
    )
    return
  }
  console.error(`Failed to load ${providerName}:`, error)
}
