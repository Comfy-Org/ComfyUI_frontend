const GITHUB_REPO_API_URL = 'https://api.github.com/repos/Comfy-Org/ComfyUI'
// Fetched from GitHub on 2026-05-06.
const GITHUB_STARS_FALLBACK = 111_605

let inflight: Promise<number> | undefined

export function resetGitHubStarsFetcherForTests(): void {
  inflight = undefined
}

export function fetchGitHubStarsForBuild(
  fetchImpl: typeof fetch = fetch
): Promise<number> {
  inflight ??= fetchGitHubStars(fetchImpl).then(
    (stars) => stars ?? GITHUB_STARS_FALLBACK
  )
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
    if (!res.ok) return null
    const data: unknown = await res.json()
    return readStargazerCount(data)
  } catch {
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
  if (data === null || typeof data !== 'object') return null
  const count = (data as { stargazers_count?: unknown }).stargazers_count
  return typeof count === 'number' ? count : null
}
