import { describe, expect, it, vi } from 'vitest'

const model = (
  rank: number,
  provider: string,
  extra: Record<string, unknown> = {}
) => ({
  slug: `m${rank}`,
  name: `Model ${rank}`,
  workflowCount: 0,
  routerId: `router/m${rank}`,
  capabilities: [],
  recommendedRank: rank,
  provider,
  href: `/hub/models/m${rank}/`,
  thumbnail: { url: `/m${rank}.png`, kind: 'image' as const },
  ...extra
})

vi.mock(import('@/config/workshop-browse-content'), () => ({
  workshopModels: [
    model(3, 'Kling'),
    model(1, 'ByteDance'),
    model(2, 'ByteDance'),
    model(0, 'Google', { flag: 'unreleased' }),
    model(4, 'Runway', { thumbnail: { url: '/m4.mp4', kind: 'video' } }),
    model(5, 'Luma', {
      thumbnail: { url: '/m5.mp4', kind: 'video', poster: '/m5.jpg' }
    })
  ]
}))

const workflow = (rank: number, extra: Record<string, unknown> = {}) => ({
  type: 'CLOUD' as const,
  workflowId: `w${rank}`,
  slug: `w${rank}`,
  name: `Workflow ${rank}`,
  href: `/hub/workflows/w${rank}/`,
  workflowCount: 1,
  capabilities: [],
  recommendedRank: rank,
  author: 'ComfyUI',
  thumbnail: { url: `/w${rank}.webp`, kind: 'image' as const },
  ...extra
})

vi.mock(import('@/config/workshop-workflow-content'), () => ({
  workflowModels: [
    ...Array.from({ length: 14 }, (_, index) => workflow(14 - index)),
    workflow(0, { thumbnail: undefined })
  ],
  workflowDetailsBySlug: new Map(),
  workflowPagesFor: () => []
}))

const { hubBannerContent } = await import('./hubBanner')

describe('hubBannerContent', () => {
  it('takes the twelve best ranked workflows that have a still to show', () => {
    expect(hubBannerContent.workflows.map((tile) => tile.name)).toEqual(
      Array.from({ length: 12 }, (_, index) => `Workflow ${index + 1}`)
    )
    expect(hubBannerContent.workflows[0]).toEqual({
      kind: 'workflow',
      name: 'Workflow 1',
      maker: 'ComfyUI',
      href: '/hub/workflows/w1/',
      imageUrl: '/w1.webp'
    })
  })

  it('shows one released model per partner, using a poster for video', () => {
    expect(
      hubBannerContent.models.map(({ maker, imageUrl }) => [maker, imageUrl])
    ).toEqual([
      ['ByteDance', '/m1.png'],
      ['Kling', '/m3.png'],
      ['Luma', '/m5.jpg']
    ])
  })
})
