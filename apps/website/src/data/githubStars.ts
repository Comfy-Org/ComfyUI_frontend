export interface GitHubStarsSnapshot {
  fetchedAt: string
  repository: 'Comfy-Org/ComfyUI'
  stargazersCount: number
}

export function isGitHubStarsSnapshot(
  value: unknown
): value is GitHubStarsSnapshot {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as {
    fetchedAt?: unknown
    repository?: unknown
    stargazersCount?: unknown
  }
  return (
    typeof candidate.fetchedAt === 'string' &&
    candidate.repository === 'Comfy-Org/ComfyUI' &&
    typeof candidate.stargazersCount === 'number' &&
    Number.isSafeInteger(candidate.stargazersCount) &&
    candidate.stargazersCount >= 0
  )
}
