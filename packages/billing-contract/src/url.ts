/**
 * The one place a string becomes a `URL` in this package. Every entry point
 * here takes input that arrived over a URL bar, so a parse failure is a value
 * to branch on rather than an exception each caller has to remember to catch.
 */
export function parseUrl(value: string | URL, base?: string): URL | undefined {
  try {
    return new URL(value instanceof URL ? value.href : value, base)
  } catch {
    return undefined
  }
}

/**
 * Lets the parsers accept the path-and-query form a router hands them
 * (`/v1/checkout?...`) as readily as a full href. It is never read back: only
 * the pathname and the query survive parsing, and `.invalid` is reserved by
 * RFC 2606 so a bug that leaked it could not reach a real host.
 */
export const CONTRACT_PARSE_BASE = 'https://billing.invalid/'
