import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from './models-catalogue'
import { filterWorkshopModels } from './models-catalogue'
import { searchWorkshopModels } from './models-search'

const catalogue: WorkshopModel[] = [
  {
    slug: 'a',
    name: 'Veo 3',
    workflowCount: 1,
    href: '/a',
    routerId: 'google/a',
    capabilities: [],
    provider: 'Google',
    modality: 'video',
    task: 'text-to-video'
  },
  {
    slug: 'b',
    name: 'Kling Image to Video',
    workflowCount: 1,
    href: '/b',
    routerId: 'kling/b',
    capabilities: [],
    provider: 'Kling',
    modality: 'video',
    task: 'image-to-video'
  },
  {
    slug: 'c',
    name: 'FLUX.1 Kontext Pro',
    workflowCount: 1,
    href: '/c',
    routerId: 'bfl/c',
    capabilities: ['Inpainting'],
    provider: 'Black Forest Labs',
    modality: 'image',
    task: 'image-to-image'
  },
  {
    slug: 'd',
    name: 'Seedance 2.5',
    workflowCount: 1,
    href: '/d',
    routerId: 'bytedance/d',
    capabilities: [],
    provider: 'ByteDance',
    modality: 'video',
    task: 'text-to-video'
  },
  {
    slug: 'e',
    name: 'Turntable Loop',
    workflowCount: 1,
    href: '/hub/workflows/e/',
    type: 'CLOUD',
    workflowId: 'wf-e',
    models: ['Hunyuan Video'],
    author: 'Comfy Org',
    category: 'product',
    capabilities: []
  }
]

const slugs = (models: readonly WorkshopModel[]) =>
  models.map((model) => model.slug)

describe('searchWorkshopModels', () => {
  it.for([
    { query: 'i2v', expected: ['b'] },
    { query: 'image kling', expected: ['b'] },
    { query: 'kontxt', expected: ['c'] },
    { query: 'inpainitng', expected: ['c'] },
    { query: 'forrest', expected: ['c'] },
    { query: 'textt', expected: ['a', 'd'] },
    { query: 'genrate', expected: ['a', 'd'] },
    { query: 'hunyan', expected: ['e'] },
    { query: 'comfu', expected: ['e'] },
    { query: 'prodct', expected: ['e'] },
    { query: 'zzzz', expected: [] }
  ])('"$query" finds $expected', ({ query, expected }) => {
    expect(slugs(searchWorkshopModels(catalogue, { query }))).toEqual(expected)
  })

  it.for(['dance', 'ux', 'ling', 'table', '2.5'])(
    'still finds everything the substring match found for "%s"',
    (query) => {
      const substring = slugs(filterWorkshopModels(catalogue, { query }))
      expect(substring.length).toBeGreaterThan(0)
      expect(slugs(searchWorkshopModels(catalogue, { query }))).toEqual(
        expect.arrayContaining(substring)
      )
    }
  )

  it('applies facets to the matches and keeps the order it is given', () => {
    expect(
      slugs(
        searchWorkshopModels([...catalogue].reverse(), {
          query: 'video',
          providers: ['Kling', 'ByteDance']
        })
      )
    ).toEqual(['d', 'b'])
  })

  it('filters by facets alone when the query is blank', () => {
    const filter = { query: '   ', providers: ['Kling'] }
    expect(searchWorkshopModels(catalogue, filter)).toEqual(
      filterWorkshopModels(catalogue, filter)
    )
  })
})
