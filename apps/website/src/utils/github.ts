const GITHUB_REPO_API_URL = 'https://api.github.com/repos/Comfy-Org/ComfyUI'
const GITHUB_REPO_LABEL = 'Comfy-Org/ComfyUI'

let inflight: Promise<number | null> | undefined

export function resetGitHubStarsFetcherForTests(): void {
  inflight = undefined
}

export function fetchGitHubStarsForBuild(
  fetchImpl: typeof fetch = fetch
): Promise<number | null> {
  inflight ??= fetchGitHubStars(fetchImpl)
  return inflight
}

export async function fetchGitHubStars(
  fetchImpl: typeof fetch = fetch
): Promise<number | null> {
  const override = readGitHubStarsOverride()
  if (override !== undefined) return override

  try {
    const res = await fetchImpl(GITHUB_REPO_API_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' }
    })
    if (!res.ok) {
      console.warn(await formatGitHubStarsHttpError(res))
      return null
    }

    const data: unknown = await res.json()
    const count = readStargazerCount(data)
    if (count === null) {
      console.warn(
        `Failed to fetch GitHub stars for ${GITHUB_REPO_LABEL}: response missing numeric stargazers_count`
      )
      return null
    }

    return count
  } catch (error) {
    console.warn(
      `Failed to fetch GitHub stars for ${GITHUB_REPO_LABEL}: ${formatError(error)}`
    )
    return null
  }
}

export function formatStarCount(count: number): string {
  if (count >= 1_000_000) {
    const m = count / 1_000_000
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`
  }
  if (count >= 1_000) {
    const k = count / 1_000
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}K`
  }
  return count.toString()
}

function readGitHubStarsOverride(): number | undefined {
  const rawCount = process.env.WEBSITE_GITHUB_STARS_OVERRIDE
  if (rawCount === undefined || rawCount === '') return undefined

  const count = Number(rawCount)
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(
      'WEBSITE_GITHUB_STARS_OVERRIDE must be a non-negative integer'
    )
  }

  return count
}

function readStargazerCount(data: unknown): number | null {
  if (!isRecord(data) || typeof data.stargazers_count !== 'number') {
    return null
  }

  return data.stargazers_count
}

async function formatGitHubStarsHttpError(res: Response): Promise<string> {
  const bodyMessage = await readGitHubErrorMessage(res)
  const statusText = res.statusText ? ` ${res.statusText}` : ''
  const message = bodyMessage ? `: ${bodyMessage}` : ''
  const headers = formatGitHubResponseHeaders(res.headers)

  return `Failed to fetch GitHub stars for ${GITHUB_REPO_LABEL}: ${res.status}${statusText}${message}${headers}`
}

async function readGitHubErrorMessage(
  res: Response
): Promise<string | undefined> {
  const body = await res.text().catch(() => '')
  if (!body) return undefined

  const parsedMessage = readGitHubErrorBodyMessage(body)
  if (parsedMessage !== undefined) return parsedMessage

  return body.slice(0, 200)
}

function readGitHubErrorBodyMessage(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body)
    if (isRecord(parsed) && typeof parsed.message === 'string') {
      return parsed.message
    }
  } catch {
    return undefined
  }

  return undefined
}

function formatGitHubResponseHeaders(headers: Headers): string {
  const parts = [
    formatHeader(headers, 'x-ratelimit-resource', 'resource'),
    formatHeader(headers, 'x-ratelimit-limit', 'limit'),
    formatHeader(headers, 'x-ratelimit-remaining', 'remaining'),
    formatResetHeader(headers),
    formatHeader(headers, 'x-github-request-id', 'requestId')
  ].filter((part): part is string => part !== undefined)

  return parts.length ? ` (${parts.join(', ')})` : ''
}

function formatHeader(
  headers: Headers,
  headerName: string,
  label: string
): string | undefined {
  const value = headers.get(headerName)
  return value === null ? undefined : `${label}=${value}`
}

function formatResetHeader(headers: Headers): string | undefined {
  const value = headers.get('x-ratelimit-reset')
  if (value === null) return undefined

  const resetSeconds = Number(value)
  if (!Number.isFinite(resetSeconds)) return `reset=${value}`

  return `reset=${new Date(resetSeconds * 1000).toISOString()}`
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
