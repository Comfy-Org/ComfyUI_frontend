import { describe, expect, it } from 'vitest'

import { models } from './models'
import generatedModels from './workshop-models.generated.json'
import type { GeneratedField, WorkshopModel } from './workshop'
import {
  countByFacet,
  countByUseCase,
  decodeGeneratedModels,
  filterWorkshopModels,
  isRouterModel,
  sortWorkshopModels,
  splitTask,
  taskFor,
  useCaseFor,
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

  it('also matches the use case in words', () => {
    expect(filterWorkshopModels(fixture, { query: 'create videos' })).toEqual([
      fixture[0]
    ])
  })

  it('filters by use case and treats unknown models as other', () => {
    expect(
      filterWorkshopModels(fixture, { query: '', useCase: 'create-videos' })
    ).toEqual([fixture[0]])
    expect(
      filterWorkshopModels(fixture, { query: '', useCase: 'other' })
    ).toEqual([fixture[2]])
  })

  it('combines query and use case', () => {
    expect(
      filterWorkshopModels(fixture, { query: 'flux', useCase: 'create-videos' })
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
        useCase: 'create-videos',
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
    expect(splitTask('image-to-video-to-audio')).toBeUndefined()
  })
})

describe('useCaseFor', () => {
  const withTask = (task: WorkshopModel['task']): WorkshopModel => ({
    ...fixture[2],
    task
  })

  it('splits creating from editing by whether the input matches the output', () => {
    expect(useCaseFor(withTask('text-to-image'))).toBe('create-images')
    expect(useCaseFor(withTask('image-to-image'))).toBe('edit-images')
    expect(useCaseFor(withTask('image-to-video'))).toBe('create-videos')
    expect(useCaseFor(withTask('video-to-video'))).toBe('edit-videos')
    expect(useCaseFor(withTask('image-to-3d'))).toBe('create-3d')
    expect(useCaseFor(withTask('video-to-audio'))).toBe('audio')
    expect(useCaseFor(withTask('text-to-text'))).toBe('text')
  })

  it('falls back to the modality when the task is unknown', () => {
    expect(useCaseFor({ ...fixture[2], modality: 'audio' })).toBe('audio')
    expect(useCaseFor(fixture[2])).toBe('other')
  })
})

describe('countByUseCase', () => {
  it('counts every use case including all and other', () => {
    expect(countByUseCase(fixture)).toMatchObject({
      all: 3,
      'create-videos': 1,
      'edit-images': 1,
      'create-images': 0,
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
    const prompt = {
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      multiline: true,
      required: true
    }
    const example = {
      name: 'demo',
      title: 'Demo',
      description: '',
      tags: ['video'],
      thumbnailUrl: 'https://example.com/demo.webp',
      values: { prompt: 'a capybara', steps: 20, hd: true }
    }
    const good = {
      fields: [prompt],
      defaults: { prompt: 'hello' },
      examples: [example]
    }
    expect(
      decodeGeneratedModels({
        good,
        badFields: { ...good, fields: 'nope' },
        badKind: {
          ...good,
          fields: [{ kind: 'color', name: 'x', label: 'X' }]
        },
        halfNumber: {
          ...good,
          fields: [{ kind: 'number', name: 'steps', label: 'Steps', min: 1 }]
        },
        badDefaults: { ...good, defaults: { seed: null } },
        badExample: { ...good, examples: [{ name: 'x' }] },
        missing: null
      })
    ).toEqual({ good })
    expect(decodeGeneratedModels('not a manifest')).toEqual({})
  })

  it('accepts every record the generator wrote', () => {
    expect(Object.keys(decodeGeneratedModels(generatedModels))).toEqual(
      Object.keys(generatedModels)
    )
  })
})
