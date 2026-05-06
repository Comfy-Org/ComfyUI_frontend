import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchGitHubStars,
  fetchGitHubStarsForBuild,
  formatStarCount,
  resetGitHubStarsFetcherForTests
} from './github'

describe('fetchGitHubStars', () => {
  const savedOverride = process.env.WEBSITE_GITHUB_STARS_OVERRIDE

  afterEach(() => {
    resetGitHubStarsFetcherForTests()
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

    await expect(fetchGitHubStars()).rejects.toThrow(
      'WEBSITE_GITHUB_STARS_OVERRIDE must be a non-negative integer'
    )
  })

  it('memoizes build-time star fetches within a single process', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ stargazers_count: 110000 }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    )

    const [a, b] = await Promise.all([
      fetchGitHubStarsForBuild(fetchImpl),
      fetchGitHubStarsForBuild(fetchImpl)
    ])

    expect(a).toBe(110000)
    expect(b).toBe(110000)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('falls back to the last known star count for build-time fetch failures', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 403 })
    )

    const fallback = await fetchGitHubStarsForBuild(fetchImpl)

    expect(Number.isSafeInteger(fallback)).toBe(true)
    expect(fallback).toBeGreaterThan(0)
  })
})

describe('formatStarCount', () => {
  it('formats the visual-test override to match committed snapshots', () => {
    expect(formatStarCount(110000)).toBe('110K')
  })
})
