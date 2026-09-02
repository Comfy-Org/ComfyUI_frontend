import { describe, expect, it } from 'vitest'

import { models } from './models'
import type { GeneratedField, WorkshopModel } from './workshop'
import {
  countByFacet,
  countByModality,
  decodeGeneratedModels,
  filterWorkshopModels,
  isRouterModel,
  sortWorkshopModels,
  splitTask,
  taskFor,
  workshopModels
} from './workshop'

const fixture: WorkshopModel[] = [
  {
    slug: 'a',
    name: 'Kling AI',
    workflowCount: 3,
    href: '/a',
    routerId: 'kling/a',
    provider: 'Kling',
    modality: 'video',
    task: 'text-to-video'
  },
  {
    slug: 'b',
    name: 'Flux',
    workflowCount: 2,
    href: '/b',
    routerId: 'bfl/b',
    provider: 'Black Forest Labs',
    modality: 'image',
    task: 'image-to-image'
  },
  {
    slug: 'c',
    name: 'Mystery',
    workflowCount: 1,
    href: '/c',
    routerId: 'comfy/c'
  }
]

describe('filterWorkshopModels', () => {
  it('matches name or provider, case-insensitively', () => {
    expect(filterWorkshopModels(fixture, { query: 'forest' })).toEqual([
      fixture[1]
    ])
    expect(filterWorkshopModels(fixture, { query: 'KLING' })).toEqual([
      fixture[0]
    ])
  })

  it('also matches the category and the task in words', () => {
    expect(filterWorkshopModels(fixture, { query: 'image to image' })).toEqual([
      fixture[1]
    ])
    expect(filterWorkshopModels(fixture, { query: 'video' })).toEqual([
      fixture[0]
    ])
  })

  it('filters by modality and treats missing modality as other', () => {
    expect(
      filterWorkshopModels(fixture, { query: '', modalities: ['video'] })
    ).toEqual([fixture[0]])
    expect(
      filterWorkshopModels(fixture, { query: '', modalities: ['other'] })
    ).toEqual([fixture[2]])
  })

  it('combines query and modality', () => {
    expect(
      filterWorkshopModels(fixture, { query: 'flux', modalities: ['video'] })
    ).toEqual([])
  })
})

describe('filterWorkshopModels facets', () => {
  it('filters by provider and by task', () => {
    expect(
      filterWorkshopModels(fixture, { query: '', providers: ['Kling'] })
    ).toEqual([fixture[0]])
    expect(
      filterWorkshopModels(fixture, { query: '', tasks: ['image-to-image'] })
    ).toEqual([fixture[1]])
    expect(
      filterWorkshopModels(fixture, {
        query: '',
        modalities: ['video'],
        tasks: ['image-to-image']
      })
    ).toEqual([])
  })
})

describe('sortWorkshopModels', () => {
  it('orders by popularity, name or price without mutating the input', () => {
    const priced = fixture.map((model, index) => ({
      ...model,
      creditsPerRun: index === 2 ? undefined : (index + 1) * 10
    }))
    const names = (list: WorkshopModel[]) => list.map((m) => m.name)
    expect(names(sortWorkshopModels(priced, 'popular'))).toEqual([
      'Kling AI',
      'Flux',
      'Mystery'
    ])
    expect(names(sortWorkshopModels(priced, 'name'))).toEqual([
      'Flux',
      'Kling AI',
      'Mystery'
    ])
    expect(names(sortWorkshopModels(priced, 'priceAsc'))).toEqual([
      'Kling AI',
      'Flux',
      'Mystery'
    ])
    expect(names(sortWorkshopModels(priced, 'priceDesc'))).toEqual([
      'Flux',
      'Kling AI',
      'Mystery'
    ])
    expect(names(priced)).toEqual(['Kling AI', 'Flux', 'Mystery'])
  })
})

describe('countByFacet', () => {
  it('counts each value, skips models without one, most common first', () => {
    const list = [...fixture, { ...fixture[1], slug: 'd' }]
    expect(countByFacet(list, 'provider')).toEqual([
      { value: 'Black Forest Labs', count: 2 },
      { value: 'Kling', count: 1 }
    ])
    expect(countByFacet(list, 'task')).toEqual([
      { value: 'image-to-image', count: 2 },
      { value: 'text-to-video', count: 1 }
    ])
  })
})

describe('taskFor', () => {
  const upload = (required: boolean): GeneratedField => ({
    kind: 'file',
    name: 'image',
    label: 'Image',
    accept: 'image',
    required
  })

  it('uses a required upload as the input, text otherwise', () => {
    expect(taskFor([upload(true)], 'video')).toBe('image-to-video')
    expect(taskFor([upload(false)], 'video')).toBe('text-to-video')
    expect(taskFor([], undefined)).toBe('text-to-other')
  })

  it('splits only well-formed tasks', () => {
    expect(splitTask('image-to-video')).toEqual({
      input: 'image',
      output: 'video'
    })
    expect(splitTask('text-to-all')).toBeUndefined()
    expect(splitTask('nonsense')).toBeUndefined()
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
    expect(workshopModels.map((m) => m.slug)).toEqual(
      models.filter(isRouterModel).map((m) => m.slug)
    )
    expect(workshopModels.filter((m) => m.thumbnailUrl).length).toBeGreaterThan(
      40
    )
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

describe('decodeGeneratedModels', () => {
  it('keeps well-formed records and drops the rest', () => {
    const good = {
      fields: [{ kind: 'text', name: 'prompt', label: 'Prompt' }],
      defaults: {},
      examples: []
    }
    expect(
      decodeGeneratedModels({
        good,
        badFields: { ...good, fields: 'nope' },
        badKind: {
          ...good,
          fields: [{ kind: 'color', name: 'x', label: 'X' }]
        },
        missing: null
      })
    ).toEqual({ good })
    expect(decodeGeneratedModels('not a manifest')).toEqual({})
  })
})
