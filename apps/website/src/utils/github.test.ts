import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchGitHubStars,
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

    await expect(fetchGitHubStars('Comfy-Org', 'ComfyUI')).resolves.toBe(110000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails fast when the build-time override is malformed', async () => {
    process.env.WEBSITE_GITHUB_STARS_OVERRIDE = '110K'

    await expect(fetchGitHubStars('Comfy-Org', 'ComfyUI')).rejects.toThrow(
      'WEBSITE_GITHUB_STARS_OVERRIDE must be a non-negative integer'
    )
  })

  it('memoizes concurrent fetches for the same repo to one network call', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ stargazers_count: 110000 }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    )

    const [a, b, c] = await Promise.all([
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl as typeof fetch),
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl as typeof fetch),
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl as typeof fetch)
    ])

    expect(a).toBe(110000)
    expect(b).toBe(110000)
    expect(c).toBe(110000)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('keys the in-flight cache by owner/repo', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = typeof url === 'string' ? url : url.toString()
      const count = href.includes('other-repo') ? 42 : 110000
      return new Response(JSON.stringify({ stargazers_count: count }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })

    const [comfy, other] = await Promise.all([
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl as typeof fetch),
      fetchGitHubStars('Comfy-Org', 'other-repo', fetchImpl as typeof fetch)
    ])

    expect(comfy).toBe(110000)
    expect(other).toBe(42)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns null when GitHub responds non-2xx', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('rate limited', { status: 403 })
    )

    await expect(
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl as typeof fetch)
    ).resolves.toBeNull()
  })

  it('returns null when fetch throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })

    await expect(
      fetchGitHubStars('Comfy-Org', 'ComfyUI', fetchImpl as typeof fetch)
    ).resolves.toBeNull()
  })
})

describe('formatStarCount', () => {
  it('formats the visual-test override to match committed snapshots', () => {
    expect(formatStarCount(110000)).toBe('110K')
  })
})
