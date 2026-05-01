export async function fetchGitHubStars(
  owner: string,
  repo: string
): Promise<number | null> {
  const override = readGitHubStarsOverride()
  if (override !== undefined) return override

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Accept: 'application/vnd.github.v3+json' }
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.stargazers_count ?? null
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
