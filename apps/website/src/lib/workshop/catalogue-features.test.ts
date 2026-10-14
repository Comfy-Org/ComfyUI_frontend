import { describe, expect, it } from 'vitest'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { workflowFeatures } from './catalogue-features'

function workflow(
  slug: string,
  extra: Partial<WorkflowWorkshopModel> = {}
): WorkflowWorkshopModel {
  return {
    slug,
    name: slug,
    workflowCount: 1,
    href: `/hub/workflows/${slug}/`,
    capabilities: [],
    type: 'CLOUD',
    workflowId: slug,
    thumbnail: { url: `/${slug}.webp`, kind: 'image' },
    ...extra
  }
}

describe('workflowFeatures', () => {
  it('features the four most recommended workflows that have a still, as Comfy workflows', () => {
    const features = workflowFeatures([
      workflow('unranked'),
      workflow('third', { recommendedRank: 3 }),
      workflow('first', { recommendedRank: 1 }),
      workflow('video-only', {
        recommendedRank: 0,
        thumbnail: { url: '/clip.mp4', kind: 'video' }
      }),
      workflow('second', { recommendedRank: 2 }),
      workflow('fourth', { recommendedRank: 4 })
    ])

    expect(features.map(({ key }) => key)).toEqual([
      'first',
      'second',
      'third',
      'fourth'
    ])
    expect(features[0]).toMatchObject({
      badge: 'Featured',
      source: { label: 'Comfy workflow', logo: '/icons/logomark.svg' },
      cta: 'Open workflow',
      ctaLabel: 'Open workflow first',
      href: '/hub/workflows/first/',
      still: '/first.webp'
    })
    expect(features[0]?.price).toBeUndefined()
  })
})
