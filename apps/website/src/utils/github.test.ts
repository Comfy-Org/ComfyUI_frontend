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
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ stargazers_count: 110000 }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    )

    const [a, b] = await Promise.all([
      fetchGitHubStarsForBuild(fetchImpl as unknown as typeof fetch),
      fetchGitHubStarsForBuild(fetchImpl as unknown as typeof fetch)
    ])

    expect(a).toBe(110000)
    expect(b).toBe(110000)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('logs GitHub response details when the API request fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
          status: 403,
          statusText: 'Forbidden',
          headers: {
            'x-github-request-id': 'ABC:123',
            'x-ratelimit-limit': '60',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1777937662',
            'x-ratelimit-resource': 'core'
          }
        })
    )

    await expect(
      fetchGitHubStars(fetchImpl as unknown as typeof fetch)
    ).resolves.toBeNull()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to fetch GitHub stars for Comfy-Org/ComfyUI: 403 Forbidden: API rate limit exceeded'
      )
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('resource=core'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('limit=60'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('remaining=0'))
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `reset=${new Date(1777937662 * 1000).toISOString()}`
      )
    )
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('requestId=ABC:123')
    )
  })

  it('logs thrown request failures', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })

    await expect(
      fetchGitHubStars(fetchImpl as unknown as typeof fetch)
    ).resolves.toBeNull()
    expect(warn).toHaveBeenCalledWith(
      'Failed to fetch GitHub stars for Comfy-Org/ComfyUI: network down'
    )
  })
})

describe('formatStarCount', () => {
  it('formats the visual-test override to match committed snapshots', () => {
    expect(formatStarCount(110000)).toBe('110K')
  })
})
