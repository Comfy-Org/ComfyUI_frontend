import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GitHubStarsSnapshot } from '../data/githubStars'

import {
  fetchGitHubStars,
  fetchGitHubStarsForBuild,
  formatStarCount,
  resetGitHubStarsFetcherForTests
} from './github'

function response(body: unknown, init: Partial<ResponseInit> = {}): Response {
  const base: ResponseInit = {
    status: 200,
    headers: { 'content-type': 'application/json' }
  }
  return new Response(JSON.stringify(body), { ...base, ...init })
}

function makeSnapshot(stargazersCount = 111_605): GitHubStarsSnapshot {
  return {
    fetchedAt: '2026-05-06T00:00:00.000Z',
    repository: 'Comfy-Org/ComfyUI',
    stargazersCount
  }
}

function withSnapshotDir(snapshot: GitHubStarsSnapshot | null): URL {
  const dir = mkdtempSync(join(tmpdir(), 'github-stars-test-'))
  const file = join(dir, 'github-stars.snapshot.json')
  if (snapshot) writeFileSync(file, JSON.stringify(snapshot))
  return pathToFileURL(file)
}

describe('fetchGitHubStars', () => {
  const savedOverride = process.env.WEBSITE_GITHUB_STARS_OVERRIDE

  beforeEach(() => {
    resetGitHubStarsFetcherForTests()
    delete process.env.WEBSITE_GITHUB_STARS_OVERRIDE
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (savedOverride === undefined)
      delete process.env.WEBSITE_GITHUB_STARS_OVERRIDE
    else process.env.WEBSITE_GITHUB_STARS_OVERRIDE = savedOverride
  })

  it('uses the build-time override without calling GitHub', async () => {
    process.env.WEBSITE_GITHUB_STARS_OVERRIDE = '110000'
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(fetchGitHubStars()).resolves.toBe(110000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails fast when the build-time override is malformed', async () => {
    process.env.WEBSITE_GITHUB_STARS_OVERRIDE = '110K'
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(fetchGitHubStars()).rejects.toThrow(
      'WEBSITE_GITHUB_STARS_OVERRIDE must be a non-negative integer'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns fresh stars when the API succeeds', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      response({ stargazers_count: 112464 })
    )

    const outcome = await fetchGitHubStarsForBuild({ fetchImpl })

    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.repository).toBe('Comfy-Org/ComfyUI')
    expect(outcome.snapshot.stargazersCount).toBe(112464)
  })

  it('memoizes build-time star fetches within a single process', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      response({ stargazers_count: 110000 })
    )

    const [a, b] = await Promise.all([
      fetchGitHubStarsForBuild({ fetchImpl }),
      fetchGitHubStarsForBuild({ fetchImpl })
    ])

    expect(a).toBe(b)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('falls back to the committed snapshot when GitHub fetch fails', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      response({}, { status: 403 })
    )

    const outcome = await fetchGitHubStarsForBuild({ fetchImpl, snapshotUrl })

    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^HTTP 403/)
    expect(outcome.snapshot.stargazersCount).toBe(111605)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('returns failed when both GitHub fetch and snapshot are unavailable', async () => {
    const snapshotUrl = withSnapshotDir(null)
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      response({}, { status: 403 })
    )

    const outcome = await fetchGitHubStarsForBuild({ fetchImpl, snapshotUrl })

    expect(outcome.status).toBe('failed')
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('rejects invalid numeric star counts before caching them', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      response({ stargazers_count: -1 })
    )

    const outcome = await fetchGitHubStarsForBuild({ fetchImpl, snapshotUrl })

    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^response schema validation failed/)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })
})

describe('formatStarCount', () => {
  it('formats the visual-test override to match committed snapshots', () => {
    expect(formatStarCount(110000)).toBe('110K')
  })
})
