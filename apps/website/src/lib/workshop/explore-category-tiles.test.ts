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

const workflows = [
  workflow('restore', 'upscale', 4, {
    recommendedRank: 2,
    thumbnail: { url: '/restore.webp', kind: 'image' }
  }),
  workflow('sharpen', 'upscale', 4, {
    recommendedRank: 1,
    thumbnail: { url: '/sharpen.mp4', kind: 'video', poster: '/sharpen.jpg' }
  }),
  workflow('inpaint', 'image-to-image', 0, {
    thumbnail: { url: '/inpaint.mp4', kind: 'video' }
  }),
  workflow('turnaround', 'characters', 6, {
    thumbnail: { url: '/turnaround.webp', kind: 'image' }
  })
]

describe('categoryTiles', () => {
  it('lists each category with a workflow, in sidebar order, linking to it with a still of its leading workflow', () => {
    expect(categoryTiles(workflows)).toEqual([
      {
        id: 'image-to-image',
        label: 'image-to-image label',
        count: 1,
        href: '/hub/workflows/?category=image-to-image'
      },
      {
        id: 'upscale',
        label: 'upscale label',
        count: 2,
        href: '/hub/workflows/?category=upscale',
        still: '/sharpen.jpg'
      },
      {
        id: 'characters',
        label: 'characters label',
        count: 1,
        href: '/hub/workflows/?category=characters',
        still: '/turnaround.webp'
      }
    ])
  })

  it('names the categories in Chinese on the Chinese page', () => {
    expect(categoryTiles(workflows, 'zh-CN').map((tile) => tile.label)).toEqual(
      ['image-to-image 标签', 'upscale 标签', 'characters 标签']
    )
  })

  it('shows nothing without workflows', () => {
    expect(categoryTiles([])).toEqual([])
  })
})
