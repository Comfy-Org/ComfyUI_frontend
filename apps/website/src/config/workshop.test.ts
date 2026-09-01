import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from './workshop'
import {
  countByModality,
  filterWorkshopModels,
  isRouterModel,
  workshopModels
} from './workshop'

const fixture: WorkshopModel[] = [
  {
    slug: 'a',
    name: 'Kling AI',
    workflowCount: 3,
    href: '/a',
    provider: 'Kling',
    modality: 'video'
  },
  {
    slug: 'b',
    name: 'Flux',
    workflowCount: 2,
    href: '/b',
    provider: 'Black Forest Labs',
    modality: 'image'
  },
  { slug: 'c', name: 'Mystery', workflowCount: 1, href: '/c' }
]

describe('filterWorkshopModels', () => {
  it('matches name or provider, case-insensitively', () => {
    expect(
      filterWorkshopModels(fixture, { query: 'forest', modality: 'all' })
    ).toEqual([fixture[1]])
    expect(
      filterWorkshopModels(fixture, { query: 'KLING', modality: 'all' })
    ).toEqual([fixture[0]])
  })

  it('filters by modality and treats missing modality as other', () => {
    expect(
      filterWorkshopModels(fixture, { query: '', modality: 'video' })
    ).toEqual([fixture[0]])
    expect(
      filterWorkshopModels(fixture, { query: '', modality: 'other' })
    ).toEqual([fixture[2]])
  })

  it('combines query and modality', () => {
    expect(
      filterWorkshopModels(fixture, { query: 'flux', modality: 'video' })
    ).toEqual([])
  })
})

describe('countByModality', () => {
  it('counts every filter bucket including all and other', () => {
    expect(countByModality(fixture)).toMatchObject({
      all: 3,
      video: 1,
      image: 1,
      audio: 0,
      other: 1
    })
  })
})

describe('workshopModels', () => {
  it('only contains canonical partner-node models', () => {
    expect(workshopModels.length).toBeGreaterThan(0)
    expect(
      isRouterModel({
        slug: 'x',
        name: 'x',
        displayName: 'x',
        directory: 'partner_nodes',
        canonicalSlug: 'y',
        huggingFaceUrl: '',
        featured: false,
        workflowCount: 0
      })
    ).toBe(false)
  })
})
