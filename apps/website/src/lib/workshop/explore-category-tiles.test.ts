import { describe, expect, it } from 'vitest'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { categoryTiles } from './explore-category-tiles'

function workflow(
  slug: string,
  category: string,
  categoryOrder: number,
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
    category,
    categoryOrder,
    categoryLabel: { en: `${category} label`, 'zh-CN': `${category} 标签` },
    ...fields
  }
}

const still = (url: string) => ({ url, kind: 'image' as const })

const upscaling = [5, 4, 3, 2, 1].map((rank) =>
  workflow(`upscale-${rank}`, 'upscale', 4, {
    recommendedRank: rank,
    thumbnail: still(`/upscale-${rank}.webp`)
  })
)

const workflows = [
  ...upscaling,
  workflow('inpaint', 'image-to-image', 0, {
    recommendedRank: 1,
    thumbnail: { url: '/inpaint.mp4', kind: 'video', poster: '/inpaint.jpg' }
  }),
  workflow('outpaint', 'image-to-image', 0, {
    recommendedRank: 2,
    thumbnail: { url: '/outpaint.mp4', kind: 'video' }
  }),
  workflow('relight', 'image-to-image', 0, {
    recommendedRank: 3,
    thumbnail: still('/inpaint.jpg')
  }),
  workflow('turnaround', 'characters', 6)
]

describe('categoryTiles', () => {
  it('lists each category with a workflow, in sidebar order, linking to it', () => {
    expect(
      categoryTiles(workflows).map(({ id, label, count, href }) => ({
        id,
        label,
        count,
        href
      }))
    ).toEqual([
      {
        id: 'image-to-image',
        label: 'image-to-image label',
        count: 3,
        href: '/hub/workflows/?category=image-to-image'
      },
      {
        id: 'upscale',
        label: 'upscale label',
        count: 5,
        href: '/hub/workflows/?category=upscale'
      },
      {
        id: 'characters',
        label: 'characters label',
        count: 1,
        href: '/hub/workflows/?category=characters'
      }
    ])
  })

  it.for([
    {
      category: 'upscale',
      stills: [
        '/upscale-1.webp',
        '/upscale-2.webp',
        '/upscale-3.webp',
        '/upscale-4.webp'
      ]
    },
    { category: 'image-to-image', stills: ['/inpaint.jpg'] },
    { category: 'characters', stills: [] }
  ])(
    'shows up to four stills of $category, most recommended first, never repeated or invented',
    ({ category, stills }) => {
      expect(
        categoryTiles(workflows).find((tile) => tile.id === category)?.stills
      ).toEqual(stills)
    }
  )

  it('names the categories in Chinese on the Chinese page', () => {
    expect(categoryTiles(workflows, 'zh-CN').map((tile) => tile.label)).toEqual(
      ['image-to-image 标签', 'upscale 标签', 'characters 标签']
    )
  })

  it('shows nothing without workflows', () => {
    expect(categoryTiles([])).toEqual([])
  })
})
