import { describe, expect, it } from 'vitest'

import { models } from './models'
import generatedModels from './workshop-models.generated.json'
import type { GeneratedField, WorkshopModel } from './workshop'
import {
  USE_CASES,
  countByFacet,
  countByUseCase,
  decodeGeneratedModels,
  catalogSearch,
  filterWorkshopModels,
  formatRuns,
  getWorkshopModel,
  mockRuns,
  parseCatalogSearch,
  isRouterModel,
  sortWorkshopModels,
  splitTask,
  capabilitiesFor,
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
    capabilities: [],
    runs: 12_000,
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
    capabilities: ['Upscale', 'Inpainting'],
    runs: 12_000,
    provider: 'Black Forest Labs',
    modality: 'image',
    task: 'image-to-image'
  },
  {
    slug: 'c',
    name: 'Mystery',
    workflowCount: 1,
    href: '/c',
    routerId: 'comfy/c',
    capabilities: [],
    runs: 12_000
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
    expect(filterWorkshopModels(fixture, { query: 'video' })).toEqual([
      fixture[0]
    ])
  })

  it('filters by use case and lists unplaced models only under all', () => {
    expect(
      filterWorkshopModels(fixture, { query: '', useCase: 'generate-videos' })
    ).toEqual([fixture[0]])
    expect(
      filterWorkshopModels(fixture, { query: '', useCase: 'all' })
    ).toEqual(fixture)
    expect(
      USE_CASES.flatMap((useCase) =>
        filterWorkshopModels(fixture, { query: '', useCase })
      )
    ).not.toContain(fixture[2])
  })

  it('combines query and use case', () => {
    expect(
      filterWorkshopModels(fixture, {
        query: 'flux',
        useCase: 'generate-videos'
      })
    ).toEqual([])
  })
})

describe('filterWorkshopModels facets', () => {
  it('filters by provider and by capability', () => {
    expect(
      filterWorkshopModels(fixture, { query: '', providers: ['Kling'] })
    ).toEqual([fixture[0]])
    expect(
      filterWorkshopModels(fixture, { query: '', capabilities: ['Upscale'] })
    ).toEqual([fixture[1]])
    expect(filterWorkshopModels(fixture, { query: 'inpaint' })).toEqual([
      fixture[1]
    ])
    expect(
      filterWorkshopModels(fixture, {
        query: '',
        useCase: 'generate-videos',
        capabilities: ['Upscale']
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
    expect(countByFacet(list, 'capabilities')).toEqual([
      { value: 'Inpainting', count: 2 },
      { value: 'Upscale', count: 2 }
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
  it('places a model by what it produces and leaves unknown ones unplaced', () => {
    expect(useCaseFor(fixture[0])).toBe('generate-videos')
    expect(useCaseFor(fixture[1])).toBe('edit-images')
    expect(
      useCaseFor({ ...fixture[1], modality: 'image', task: 'text-to-image' })
    ).toBe('generate-images')
    expect(useCaseFor({ ...fixture[0], task: 'image-to-video' })).toBe(
      'animate-images'
    )
    expect(useCaseFor({ ...fixture[0], task: 'video-to-video' })).toBe(
      'edit-videos'
    )
    expect(useCaseFor({ ...fixture[2], modality: 'video' })).toBe(
      'generate-videos'
    )
    expect(useCaseFor({ ...fixture[2], modality: '3d' })).toBe('3d')
    expect(useCaseFor(fixture[2])).toBeUndefined()
  })
})

describe('capabilitiesFor', () => {
  it('keeps the tags that describe a capability, merged and sorted', () => {
    const example = (tags: string[]) => ({
      name: 'x',
      title: 'x',
      description: '',
      tags,
      thumbnailUrl: '',
      values: {}
    })
    expect(
      capabilitiesFor([
        example(['API', 'Image Upscale', 'Image']),
        example(['Video Upscale', 'Lip Sync', 'Text to Video'])
      ])
    ).toEqual(['Lip sync', 'Upscale'])
    expect(capabilitiesFor([])).toEqual([])
  })
})

describe('countByUseCase', () => {
  it('counts every use case including all and other', () => {
    expect(countByUseCase(fixture)).toEqual({
      all: 3,
      'generate-images': 0,
      'edit-images': 1,
      'generate-videos': 1,
      'animate-images': 0,
      'edit-videos': 0,
      '3d': 0,
      audio: 0,
      text: 0
    })
  })
})

describe('workshopModels', () => {
  it('drops provider and API suffixes the registry put in the name', () => {
    const seedance = workshopModels.find((m) => m.provider === 'ByteDance')
    expect(seedance?.name).toBe('Seedance')
    expect(getWorkshopModel('flux-2-api')?.name).toBe('Flux 2')
    for (const model of workshopModels) {
      expect(model.name).not.toMatch(/\((API|Provider)\)$/)
      if (model.provider)
        expect(model.name).not.toContain(`(${model.provider})`)
    }
  })

  it('holds every partner node plus the releases the templates name', () => {
    const routerSlugs = models.filter(isRouterModel).map((m) => m.slug)
    const slugs = workshopModels.map((m) => m.slug)
    expect(slugs).toEqual(expect.arrayContaining(routerSlugs))
    expect(slugs.length).toBeGreaterThan(routerSlugs.length)
    expect(new Set(slugs).size).toBe(slugs.length)
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

describe('catalog deep links', () => {
  it('round-trips a filter through the query string', () => {
    const search = catalogSearch({
      useCase: 'edit-images',
      capabilities: ['Upscale', 'Image editing'],
      providers: ['Kling']
    })
    expect(parseCatalogSearch(search)).toEqual({
      query: '',
      useCase: 'edit-images',
      capabilities: ['Upscale', 'Image editing'],
      providers: ['Kling']
    })
  })

  it('ignores unknown use cases and yields no query string when empty', () => {
    expect(parseCatalogSearch('?useCase=nonsense').useCase).toBe('all')
    expect(catalogSearch({ useCase: 'all', capabilities: [] })).toBe('')
  })
})

describe('run counts', () => {
  it('is stable per model and grows with the workflow count', () => {
    expect(mockRuns('kling-o3', 2)).toBe(mockRuns('kling-o3', 2))
    expect(mockRuns('kling-o3', 5)).toBeGreaterThan(mockRuns('kling-o3', 2))
    expect(mockRuns('kling-o3', 2)).not.toBe(mockRuns('seedance-2', 2))
  })

  it('formats compactly in lowercase', () => {
    expect(formatRuns(89_000, 'en')).toBe('89k')
    expect(formatRuns(1_250_000, 'en')).toBe('1.3m')
  })
})
