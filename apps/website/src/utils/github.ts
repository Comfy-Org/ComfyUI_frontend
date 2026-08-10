import { readFile } from 'node:fs/promises'

import type { GitHubStarsSnapshot } from '../data/githubStars'
import type { BuildDataFetchResult, BuildDataOutcome } from './buildDataSource'

import bundledSnapshot from '../data/github-stars.snapshot.json' with { type: 'json' }
import { isGitHubStarsSnapshot } from '../data/githubStars'
import { createBuildDataSource } from './buildDataSource'

const GITHUB_OWNER = 'Comfy-Org'
const GITHUB_REPO = 'ComfyUI'
const GITHUB_REPOSITORY = `${GITHUB_OWNER}/${GITHUB_REPO}` as const

interface FetchGitHubStarsOptions {
  fetchImpl?: typeof fetch
  snapshotUrl?: URL
}

type GitHubStarsResult =
  | { kind: 'ok'; count: number }
  | { kind: 'err'; reason: string }

export type FetchOutcome = BuildDataOutcome<GitHubStarsSnapshot>

const inflight = new Map<string, Promise<GitHubStarsResult>>()
const githubStarsSource = createBuildDataSource<
  FetchGitHubStarsOptions,
  GitHubStarsSnapshot
>({
  name: 'GitHub stars',
  fetchFresh: fetchFreshGitHubStars,
  readSnapshot: (options) => readSnapshot(options.snapshotUrl),
  getCacheKey: getGitHubStarsCacheKey,
  getDefaultOptions: () => ({})
})

export function resetGitHubStarsFetcherForTests(): void {
  inflight.clear()
  githubStarsSource.resetForTests()
}

export const fetchGitHubStarsForBuild = githubStarsSource.fetchForBuild

export async function fetchGitHubStars(
  owner: string,
  repo: string,
  fetchImpl: typeof fetch = fetch
): Promise<number | null> {
  const override = readGitHubStarsOverride()
  if (override !== undefined) return override

  const result = await fetchGitHubStarCount(owner, repo, fetchImpl)
  return result.kind === 'ok' ? result.count : null
}

async function fetchFreshGitHubStars(
  options: FetchGitHubStarsOptions
): Promise<BuildDataFetchResult<GitHubStarsSnapshot>> {
  const override = readGitHubStarsOverride()
  if (override !== undefined) {
    return {
      kind: 'ok',
      snapshot: makeSnapshot(override),
      data: {}
    }
  }

  const result = await fetchGitHubStarCount(
    GITHUB_OWNER,
    GITHUB_REPO,
    options.fetchImpl ?? fetch
  )
  if (result.kind === 'err') return result

  return {
    kind: 'ok',
    snapshot: makeSnapshot(result.count),
    data: {}
  }
}

function fetchGitHubStarCount(
  owner: string,
  repo: string,
  fetchImpl: typeof fetch
): Promise<GitHubStarsResult> {
  const key = `${owner}/${repo}`
  const cached = inflight.get(key)
  if (cached) return cached

  const request = callOnce(owner, repo, fetchImpl)
  inflight.set(key, request)
  return request
}

async function callOnce(
  owner: string,
  repo: string,
  fetchImpl: typeof fetch
): Promise<GitHubStarsResult> {
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    )
    if (!response.ok) {
      return {
        kind: 'err',
        reason: `HTTP ${response.status} ${response.statusText || ''}`.trim()
      }
    }

    const count = readStargazerCount(await response.json())
    if (count === null) {
      return {
        kind: 'err',
        reason:
          'response schema validation failed: stargazers_count must be a non-negative safe integer'
      }
    }

    return { kind: 'ok', count }
  } catch (error) {
    const reason =
      error instanceof Error
        ? `network error: ${error.message}`
        : 'network error'
    return { kind: 'err', reason }
  }
}

async function readSnapshot(
  snapshotUrl: URL | undefined
): Promise<GitHubStarsSnapshot | null> {
  if (!snapshotUrl) {
    return isGitHubStarsSnapshot(bundledSnapshot) ? bundledSnapshot : null
  }
  try {
    const text = await readFile(snapshotUrl, 'utf8')
    const parsed: unknown = JSON.parse(text)
    return isGitHubStarsSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

function makeSnapshot(stargazersCount: number): GitHubStarsSnapshot {
  return {
    fetchedAt: new Date().toISOString(),
    repository: GITHUB_REPOSITORY,
    stargazersCount
  }
}

function readStargazerCount(data: unknown): number | null {
  if (data === null || typeof data !== 'object') return null
  if (!('stargazers_count' in data)) return null
  const count = data.stargazers_count
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
    ? count
    : null
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

function getGitHubStarsCacheKey(options: FetchGitHubStarsOptions): string {
  return JSON.stringify({
    override: process.env.WEBSITE_GITHUB_STARS_OVERRIDE ?? '',
    snapshotUrl: options.snapshotUrl?.href ?? ''
  })
}
