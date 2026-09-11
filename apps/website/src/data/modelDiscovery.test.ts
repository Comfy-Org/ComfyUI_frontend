import { describe, expect, it, vi } from 'vitest'

vi.mock(import('../config/models-catalogue'), () => ({
  workshopModels: [
    { provider: 'Kling', thumbnailUrl: '/first.webp' },
    { provider: 'Kling', thumbnailUrl: '/second.webp' },
    { provider: 'Kling' }
  ].map((model, index) => ({
    slug: `kling-test-${index}`,
    name: `Kling test ${index}`,
    workflowCount: 0,
    href: `/models/kling-test-${index}/`,
    routerId: `kling/test-${index}`,
    capabilities: [],
    ...model
  }))
}))

const { discoveryProviders } = await import('./modelDiscovery')

describe('discoveryProviders', () => {
  it('uses the first illustrated model while counting every provider model', () => {
    const kling = discoveryProviders.find(
      (provider) => provider.name === 'Kling'
    )
    expect(kling).toMatchObject({
      modelCount: 3,
      thumbnailUrl: '/first.webp'
    })
  })
})
