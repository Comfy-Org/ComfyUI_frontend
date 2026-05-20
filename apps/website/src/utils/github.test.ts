import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchGitHubStars, formatStarCount } from './github'

describe('fetchGitHubStars', () => {
  const savedOverride = process.env.WEBSITE_GITHUB_STARS_OVERRIDE

  afterEach(() => {
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
})

describe('formatStarCount', () => {
  it('formats the visual-test override to match committed snapshots', () => {
    expect(formatStarCount(110000)).toBe('110K')
  })
})
