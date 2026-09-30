/**
 * Read-only GitHub REST access for workflow steps that outgrew an inline
 * `actions/github-script` block. That action supplies an authenticated client
 * and opt-in retries; a step that runs a `tsx` module instead, so its logic
 * can be imported and tested, has to bring both.
 */
const ATTEMPTS = 3
const RETRY_DELAY_MS = 2_000
/** A secondary-limit `retry-after` can exceed the job's whole budget. */
const MAX_RETRY_DELAY_MS = 30_000

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * GitHub answers a primary rate limit with 403 and a secondary one with 403 or
 * 429, so status alone does not separate "slow down" from "you asked wrong".
 * The rate-limit headers do, and `actions/github-script`'s `retries` option —
 * which the steps this replaced relied on — retries the same set.
 */
function isTransient(response: Response): boolean {
  if (response.status >= 500 || response.status === 429) return true
  return (
    response.status === 403 &&
    (response.headers.has('retry-after') ||
      response.headers.get('x-ratelimit-remaining') === '0')
  )
}

function backoffFor(response: Response, fallbackMs: number): number {
  const seconds = Number(response.headers.get('retry-after'))
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1_000, MAX_RETRY_DELAY_MS)
    : fallbackMs
}

/**
 * The caller has no fallback — one transient failure costs the coverage report
 * — so server errors, rate limits and transport failures are retried. Any
 * other 4xx is this module's own mistake and is raised immediately.
 */
export async function fetchGitHubJson(
  path: string,
  retryDelayMs: number = RETRY_DELAY_MS
): Promise<unknown> {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (!token) throw new Error('GH_TOKEN is required to reach the GitHub API.')

  const apiRoot = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  let lastError = new Error(`No attempt was made for ${path}.`)

  let backoffMs = retryDelayMs

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(backoffMs)

    let response: Response
    try {
      response = await fetch(`${apiRoot}${path}`, {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          'x-github-api-version': '2022-11-28'
        },
        signal: AbortSignal.timeout(30_000)
      })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      continue
    }

    if (response.ok) return response.json()

    const detail = `GitHub returned ${response.status} for ${path}.`
    if (!isTransient(response)) throw new Error(detail)
    backoffMs = backoffFor(response, retryDelayMs)
    lastError = new Error(detail)
  }

  throw lastError
}
