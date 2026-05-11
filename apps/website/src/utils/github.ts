import { readFile } from 'node:fs/promises'

import type { GitHubStarsSnapshot } from '../data/githubStars'
import type { BuildDataFetchResult, BuildDataOutcome } from './buildDataSource'

import bundledSnapshot from '../data/github-stars.snapshot.json' with { type: 'json' }
import { isGitHubStarsSnapshot } from '../data/githubStars'
import { createBuildDataSource } from './buildDataSource'

const GITHUB_REPOSITORY = 'Comfy-Org/ComfyUI'
const GITHUB_REPO_API_URL = `https://api.github.com/repos/${GITHUB_REPOSITORY}`

export type FetchOutcome = BuildDataOutcome<GitHubStarsSnapshot>

interface FetchGitHubStarsOptions {
  fetchImpl?: typeof fetch
  snapshotUrl?: URL
}

const githubStarsSource = createBuildDataSource<
  FetchGitHubStarsOptions,
  GitHubStarsSnapshot
>({
  name: 'GitHub stars',
  fetchFresh: fetchFreshGitHubStars,
  readSnapshot: (options) => readSnapshot(options.snapshotUrl),
  getCacheKey: getGitHubStarsCacheKey
})

export const resetGitHubStarsFetcherForTests = githubStarsSource.resetForTests
export const fetchGitHubStarsForBuild = githubStarsSource.fetchForBuild

export async function fetchGitHubStars(
  fetchImpl: typeof fetch = fetch
): Promise<number | null> {
  const result = await fetchFreshGitHubStars({ fetchImpl })
  if (result.kind === 'err') return null
  return result.snapshot.stargazersCount
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

  const response = await callOnce(options.fetchImpl ?? fetch)
  if (response.kind === 'err') return response

  const count = readStargazerCount(response.body)
  if (count === null) {
    return {
      kind: 'err',
      reason:
        'response schema validation failed: stargazers_count must be a non-negative safe integer'
    }
  }

  return {
    kind: 'ok',
    snapshot: makeSnapshot(count),
    data: {}
  }
}

type CallResponse =
  | { kind: 'ok'; body: unknown }
  | { kind: 'err'; reason: string }

async function callOnce(fetchImpl: typeof fetch): Promise<CallResponse> {
  try {
    const res = await fetchImpl(GITHUB_REPO_API_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' }
    })
    if (res.ok) return { kind: 'ok', body: await res.json() }
    return {
      kind: 'err',
      reason: `HTTP ${res.status} ${res.statusText || ''}`.trim()
    }
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
    if (isGitHubStarsSnapshot(parsed)) return parsed
    return null
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
  const count = (data as { stargazers_count?: unknown }).stargazers_count
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
