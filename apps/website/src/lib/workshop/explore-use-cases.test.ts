import { describe, expect, it } from 'vitest'

import type {
  RouterWorkshopModel,
  WorkflowWorkshopModel
} from '@/config/models-catalogue'
import { useCaseTiles } from './explore-use-cases'

function model(
  slug: string,
  fields: Partial<RouterWorkshopModel> = {}
): RouterWorkshopModel {
  return {
    routerId: `acme/${slug}`,
    slug,
    name: slug,
    href: `/hub/models/${slug}/`,
    workflowCount: 0,
    capabilities: [],
    ...fields
  }
}

function workflow(
  slug: string,
  fields: Partial<WorkflowWorkshopModel> = {}
): WorkflowWorkshopModel {
  return {
    type: 'CLOUD',
    workflowId: slug,
    slug: `workflows/${slug}`,
    name: slug,
    href: `/hub/workflows/${slug}/`,
    workflowCount: 0,
    capabilities: [],
    ...fields
  }
}

const still = (url: string) => ({ url, kind: 'image' as const })

const models = [
  model('painter', {
    useCases: ['generate-images'],
    recommendedRank: 2,
    thumbnail: still('/painter.webp')
  }),
  model('sketcher', {
    useCases: ['generate-images'],
    recommendedRank: 1,
    thumbnail: { url: '/sketcher.mp4', kind: 'video' }
  }),
  model('retoucher', {
    useCases: ['edit-images'],
    thumbnail: { url: '/r.mp4', kind: 'video', poster: '/retoucher.jpg' }
  }),
  model('speaker', { useCases: ['audio'] })
]

const workflows = [
  workflow('turnaround', {
    category: 'characters',
    thumbnail: still('/turnaround.webp')
  }),
  workflow('relight', {
    category: 'image-to-image',
    recommendedRank: 0,
    thumbnail: still('/relight.webp')
  })
]

describe('useCaseTiles', () => {
  const tiles = useCaseTiles({ models, workflows })

  it('lists the use cases that hold something, in the Best-for order', () => {
    expect(tiles.map((tile) => tile.useCase)).toEqual([
      'generate-images',
      'edit-images',
      'audio',
      'characters'
    ])
  })

  it.for([
    {
      useCase: 'generate-images',
      href: '/hub/models/?useCase=generate-images',
      catalogue: 'models',
      count: 2,
      still: '/painter.webp'
    },
    {
      useCase: 'edit-images',
      href: '/hub/models/?useCase=edit-images',
      catalogue: 'models',
      count: 1,
      still: '/relight.webp'
    },
    {
      useCase: 'audio',
      href: '/hub/models/?useCase=audio',
      catalogue: 'models',
      count: 1,
      still: undefined
    },
    {
      useCase: 'characters',
      href: '/hub/workflows/?useCase=characters',
      catalogue: 'workflows',
      count: 1,
      still: '/turnaround.webp'
    }
  ] as const)(
    'sends $useCase to the $catalogue catalogue with a still of its most popular item',
    (expected) => {
      const tile = tiles.find((entry) => entry.useCase === expected.useCase)
      expect(tile).toEqual(
        expected.still
          ? expected
          : {
              useCase: expected.useCase,
              href: expected.href,
              catalogue: expected.catalogue,
              count: expected.count
            }
      )
    }
  )

  it('shows nothing without items', () => {
    expect(useCaseTiles({ models: [], workflows: [] })).toEqual([])
  })
})
