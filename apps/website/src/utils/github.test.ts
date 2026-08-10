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
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init
  })
}

function makeSnapshot(stargazersCount = 126_201): GitHubStarsSnapshot {
  return {
    fetchedAt: '2026-08-10T00:00:00.000Z',
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

const savedOverride = process.env.WEBSITE_GITHUB_STARS_OVERRIDE

beforeEach(() => {
  resetGitHubStarsFetcherForTests()
  delete process.env.WEBSITE_GITHUB_STARS_OVERRIDE
})

afterEach(() => {
  vi.restoreAllMocks()
  if (savedOverride === undefined) {
    delete process.env.WEBSITE_GITHUB_STARS_OVERRIDE
    return
  }
  process.env.WEBSITE_GITHUB_STARS_OVERRIDE = savedOverride
})

describe('fetchGitHubStars', () => {
  it('uses the build-time override without calling GitHub', async () => {
    process.env.WEBSITE_GITHUB_STARS_OVERRIDE = '110000'
    const fetchImpl = vi.fn<typeof fetch>()

    await expect(
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl)
    ).resolves.toBe(110000)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails fast when the build-time override is malformed', async () => {
    process.env.WEBSITE_GITHUB_STARS_OVERRIDE = '110K'
    const fetchImpl = vi.fn<typeof fetch>()

    await expect(
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl)
    ).rejects.toThrow(
      'WEBSITE_GITHUB_STARS_OVERRIDE must be a non-negative integer'
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('memoizes concurrent fetches for the same repository', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      response({ stargazers_count: 126201 })
    )

    const results = await Promise.all([
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl),
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl),
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl)
    ])

    expect(results).toEqual([126201, 126201, 126201])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('keeps memoized values isolated by repository', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const href =
        typeof input === 'string' || input instanceof URL
          ? input.toString()
          : input.url
      return response({
        stargazers_count: href.endsWith('/other-repo') ? 42 : 126201
      })
    })

    const results = await Promise.all([
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl),
      fetchGitHubStars('Comfy-Org', 'other-repo', fetchImpl)
    ])

    expect(results).toEqual([126201, 42])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns null for a non-success response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      response({}, { status: 403 })
    )

    await expect(
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl)
    ).resolves.toBeNull()
  })

  it('returns null for an invalid star count', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      response({ stargazers_count: -1 })
    )

    await expect(
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl)
    ).resolves.toBeNull()
  })
})

describe('fetchGitHubStarsForBuild', () => {
  it('returns a fresh snapshot when GitHub succeeds', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      response({ stargazers_count: 126201 })
    )

    const outcome = await fetchGitHubStarsForBuild({ fetchImpl })

    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot).toMatchObject({
      repository: 'Comfy-Org/ComfyUI',
      stargazersCount: 126201
    })
  })

  it('falls back to the snapshot when GitHub fails', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      response({}, { status: 403 })
    )

    const outcome = await fetchGitHubStarsForBuild({ fetchImpl, snapshotUrl })

    expect(outcome).toEqual({
      status: 'stale',
      reason: 'HTTP 403',
      snapshot: makeSnapshot()
    })
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('returns failed when GitHub and the snapshot are unavailable', async () => {
    const snapshotUrl = withSnapshotDir(null)
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('network down')
    })

    const outcome = await fetchGitHubStarsForBuild({ fetchImpl, snapshotUrl })

    expect(outcome).toEqual({
      status: 'failed',
      reason: 'network error: network down'
    })
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })
})

describe('formatStarCount', () => {
  it('formats the visual-test override to match committed snapshots', () => {
    expect(formatStarCount(110000)).toBe('110K')
  })
})
