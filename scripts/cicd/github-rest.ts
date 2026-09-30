/**
 * Read-only GitHub REST access for workflow steps that outgrew an inline
 * `actions/github-script` block. That action supplies an authenticated client
 * and retries for free; a step that runs a `tsx` module instead — so its logic
 * can be imported and tested — has to bring both.
 */
const ATTEMPTS = 3
const RETRY_DELAY_MS = 2_000

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * The caller has no fallback — a transient 5xx costs the coverage report — so
 * server errors and transport failures are retried. A 4xx is the caller's own
 * mistake and is raised immediately.
 */
export async function fetchGitHubJson(
  path: string,
  retryDelayMs: number = RETRY_DELAY_MS
): Promise<unknown> {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (!token) throw new Error('GH_TOKEN is required to reach the GitHub API.')

  const apiRoot = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  let lastError = new Error(`No attempt was made for ${path}.`)

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(retryDelayMs)

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
    if (response.status < 500) throw new Error(detail)
    lastError = new Error(detail)
  }

  throw lastError
}
