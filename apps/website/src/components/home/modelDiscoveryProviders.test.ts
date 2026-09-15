import { describe, expect, it, vi } from 'vitest'

import type { DiscoveryProvider } from '../../data/modelDiscovery'
import { discoveryProviders } from '../../data/modelDiscovery'
import { resolveDiscoveryProviders } from './modelDiscoveryProviders'

const provider: DiscoveryProvider = {
  name: 'Example Labs',
  logo: 'example',
  modelCount: 3,
  thumbnailUrl: 'https://example.com/thumbnail.webp'
}

describe('resolveDiscoveryProviders', () => {
  it('neither loads nor exposes the catalogue when Models is disabled', async () => {
    const load = vi.fn<() => Promise<readonly DiscoveryProvider[]>>()

    await expect(resolveDiscoveryProviders(false, load)).resolves.toEqual([])
    expect(load).not.toHaveBeenCalled()
  })

  it('returns exactly what the loader provides when Models is enabled', async () => {
    const load = vi.fn(async () => [provider])

    await expect(resolveDiscoveryProviders(true, load)).resolves.toEqual([
      provider
    ])
    expect(load).toHaveBeenCalledOnce()
  })

  it('reads the real catalogue by default when enabled', async () => {
    // Pins the default loader the homepages actually use, not just the seam.
    const providers = await resolveDiscoveryProviders(true)

    expect(providers.length).toBeGreaterThan(0)
    expect(providers).toBe(discoveryProviders)
  })
})
