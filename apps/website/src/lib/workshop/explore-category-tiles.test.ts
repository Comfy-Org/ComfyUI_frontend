import { describe, expect, it } from 'vitest'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { categoryTiles } from './explore-category-tiles'

function workflow(
  slug: string,
  section: string,
  sectionOrder: number,
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
    category: `${slug}-type`,
    categoryOrder: 0,
    categoryLabel: { en: `${slug} type`, 'zh-CN': `${slug} 类型` },
    section,
    sectionOrder,
    sectionLabel: { en: `${section} label`, 'zh-CN': `${section} 标签` },
    ...fields
  }
}

const still = (url: string) => ({ url, kind: 'image' as const })

const upscaling = [5, 4, 3, 2, 1].map((rank) =>
  workflow(`upscale-${rank}`, 'upscale', 3, {
    recommendedRank: rank,
    thumbnail: still(`/upscale-${rank}.webp`)
  })
)

const workflows = [
  ...upscaling,
  workflow('inpaint', 'cleanup', 4, {
    recommendedRank: 1,
    thumbnail: { url: '/inpaint.mp4', kind: 'video', poster: '/inpaint.jpg' }
  }),
  workflow('outpaint', 'cleanup', 4, {
    recommendedRank: 2,
    thumbnail: { url: '/outpaint.mp4', kind: 'video' }
  }),
  workflow('relight', 'cleanup', 4, {
    recommendedRank: 3,
    thumbnail: still('/inpaint.jpg')
  }),
  workflow('turnaround', 'characters', 1),
  workflow('unsectioned', '', 0, { section: undefined })
]

describe('categoryTiles', () => {
  it('lists each use-case section with a workflow, in its order, linking to its anchor on Workflows', () => {
    expect(
      categoryTiles(workflows).map(({ id, label, count, href }) => ({
        id,
        label,
        count,
        href
      }))
    ).toEqual([
      {
        id: 'characters',
        label: 'characters label',
        count: 1,
        href: '/hub/workflows/#section-characters'
      },
      {
        id: 'upscale',
        label: 'upscale label',
        count: 5,
        href: '/hub/workflows/#section-upscale'
      },
      {
        id: 'cleanup',
        label: 'cleanup label',
        count: 3,
        href: '/hub/workflows/#section-cleanup'
      }
    ])
  })

  it.for([
    {
      section: 'upscale',
      stills: [
        '/upscale-1.webp',
        '/upscale-2.webp',
        '/upscale-3.webp',
        '/upscale-4.webp'
      ]
    },
    { section: 'cleanup', stills: ['/inpaint.jpg'] },
    { section: 'characters', stills: [] }
  ])(
    'shows up to four stills of $section, most recommended first, never repeated or invented',
    ({ section, stills }) => {
      expect(
        categoryTiles(workflows).find((tile) => tile.id === section)?.stills
      ).toEqual(stills)
    }
  )

  it('names the sections in Chinese on the Chinese page', () => {
    expect(categoryTiles(workflows, 'zh-CN').map((tile) => tile.label)).toEqual(
      ['characters 标签', 'upscale 标签', 'cleanup 标签']
    )
  })

  it('shows nothing without workflows', () => {
    expect(categoryTiles([])).toEqual([])
  })
})
