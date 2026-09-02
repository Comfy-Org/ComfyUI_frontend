const inflight = new Map<string, Promise<number | null>>()

export function resetGitHubStarsFetcherForTests(): void {
  inflight.clear()
}

export async function fetchGitHubStars(
  owner: string,
  repo: string,
  fetchImpl: typeof fetch = fetch
): Promise<number | null> {
  const override = readGitHubStarsOverride()
  if (override !== undefined) return override

  const key = `${owner}/${repo}`
  const cached = inflight.get(key)
  if (cached) return cached

  const request = doFetch(owner, repo, fetchImpl)
  inflight.set(key, request)
  return request
}

async function doFetch(
  owner: string,
  repo: string,
  fetchImpl: typeof fetch
): Promise<number | null> {
  try {
    const res = await fetchImpl(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    )
    if (!res.ok) return null
    const data: unknown = await res.json()
    return readStargazerCount(data)
  } catch {
    return null
  }
}

function readStargazerCount(data: unknown): number | null {
  if (data === null || typeof data !== 'object') return null
  if (!('stargazers_count' in data)) return null
  const count = data.stargazers_count
  return typeof count === 'number' ? count : null
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
