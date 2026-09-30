import { describe, expect, it, vi } from 'vitest'

vi.mock(import('../config/workshop-browse-content'), () => ({
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

// Twenty illustrated workflows in the worst possible order, and two unusable
// ones ranked above all of them.
const ILLUSTRATED = 20
const workflow = (rank: number, thumbnailUrl?: string) => ({
  type: 'CLOUD' as const,
  workflowId: `w${rank}`,
  slug: `workflows/w${rank}`,
  name: `Workflow ${rank}`,
  href: `/models/workflows/w${rank}/`,
  workflowCount: 1,
  capabilities: [],
  recommendedRank: rank,
  ...(thumbnailUrl ? { thumbnailUrl } : {})
})

vi.mock(import('../config/workshop-workflow-content'), () => ({
  workflowModels: [
    ...Array.from({ length: ILLUSTRATED }, (_, index) =>
      workflow(ILLUSTRATED - index, `/w${ILLUSTRATED - index}.webp`)
    ),
    workflow(0)
  ],
  workflowDetailsBySlug: new Map(),
  workflowPagesFor: () => []
}))

const { discoveryProviders, discoveryWorkflows } =
  await import('./modelDiscovery')

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

describe('discoveryWorkflows', () => {
  it('takes the best ranked fifteen that have artwork to show', () => {
    expect(discoveryWorkflows.map((workflow) => workflow.name)).toEqual(
      Array.from({ length: 15 }, (_, index) => `Workflow ${index + 1}`)
    )
  })

  it('carries what a card needs and nothing it does not', () => {
    expect(discoveryWorkflows[0]).toEqual({
      name: 'Workflow 1',
      href: '/models/workflows/w1/',
      thumbnailUrl: '/w1.webp'
    })
  })
})
