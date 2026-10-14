import { describe, expect, it, vi } from 'vitest'

import type { HubBannerContent } from '@/data/hubBanner'
import { hubBannerContent } from '@/data/hubBanner'
import { resolveHubBannerContent } from './hubBannerContent'

const content: HubBannerContent = {
  apps: [],
  workflows: [
    {
      kind: 'workflow',
      name: 'Turn a sketch into a render',
      maker: 'ComfyUI',
      href: '/hub/workflows/sketch/',
      imageUrl: 'https://example.com/sketch.webp'
    }
  ],
  models: []
}

describe('resolveHubBannerContent', () => {
  it('neither loads nor exposes the catalogue when the Hub is not in the build', async () => {
    const load = vi.fn<() => Promise<HubBannerContent>>()

    await expect(resolveHubBannerContent(false, load)).resolves.toEqual({
      apps: [],
      workflows: [],
      models: []
    })
    expect(load).not.toHaveBeenCalled()
  })

  it('returns what the loader provides when the Hub is in the build', async () => {
    await expect(
      resolveHubBannerContent(true, async () => content)
    ).resolves.toBe(content)
  })

  it('reads the real catalogue by default', async () => {
    await expect(resolveHubBannerContent(true)).resolves.toBe(hubBannerContent)
  })
})
