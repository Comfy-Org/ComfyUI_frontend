import { describe, expect, it } from 'vitest'

import publishedPages from '@/config/published-model-pages.json' with { type: 'json' }
import { getModelBySlug } from '@/config/models'
import {
  filterOpenWeightModels,
  OPEN_WEIGHT_MODELS,
  openWeightHref
} from './open-weight-models'

describe('OPEN_WEIGHT_MODELS', () => {
  it.for(OPEN_WEIGHT_MODELS.map((model) => [model.slug, model] as const))(
    '%s points at a published model page with its own artwork',
    ([, model]) => {
      expect(publishedPages).toContain(openWeightHref(model))
      const page = getModelBySlug(model.slug)
      expect(page?.canonicalSlug).toBeUndefined()
      expect(['diffusion_models', 'checkpoints']).toContain(page?.directory)
      expect(page?.thumbnailUrl).toBe(model.thumbnailUrl)
    }
  )

  it('lists each model once', () => {
    const slugs = OPEN_WEIGHT_MODELS.map((model) => model.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('lists the models people browse for', () => {
    expect(OPEN_WEIGHT_MODELS.map((model) => model.slug)).toEqual(
      expect.arrayContaining([
        'flux1-dev',
        'qwen-image-fp8-e4m3fn',
        'wan2-2-ti2v-5b-fp16',
        'hidream-i1-full-fp8',
        'sd-xl-base-1-0',
        'ltx-2-3-22b-dev'
      ])
    )
  })
})

describe('filterOpenWeightModels', () => {
  const kontext = 'flux1-dev-kontext-fp8-scaled'

  it.for([
    { filter: { query: 'kontext' }, slugs: [kontext] },
    {
      filter: { query: 'kontext', useCases: ['generate-images'] as const },
      slugs: []
    },
    { filter: { query: 'kontext', tab: 'edit' as const }, slugs: [kontext] },
    { filter: { query: 'kontext', tab: 'video' as const }, slugs: [] },
    {
      filter: { query: 'stable audio open' },
      slugs: ['stable-audio-open-1-0']
    }
  ])('narrows by $filter', ({ filter, slugs }) => {
    expect(
      filterOpenWeightModels(OPEN_WEIGHT_MODELS, filter).map(
        (model) => model.slug
      )
    ).toEqual(slugs)
  })

  it('finds a model by its provider', () => {
    const found = filterOpenWeightModels(OPEN_WEIGHT_MODELS, {
      query: ' LIGHTRICKS '
    })
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((model) => model.provider === 'Lightricks')).toBe(true)
  })

  it('keeps every match of a use case', () => {
    const editing = filterOpenWeightModels(OPEN_WEIGHT_MODELS, {
      useCases: ['edit-images'],
      downloads: true
    })
    expect(editing.map((model) => model.slug)).toContain(kontext)
    expect(editing.every((model) => model.useCase === 'edit-images')).toBe(true)
  })

  it('orders by name on request and by use otherwise', () => {
    const byName = filterOpenWeightModels(OPEN_WEIGHT_MODELS, {
      downloads: true,
      byName: true
    })
    expect(byName.map((model) => model.name)).toEqual(
      OPEN_WEIGHT_MODELS.map((model) => model.name).toSorted((a, b) =>
        a.localeCompare(b)
      )
    )
    expect(
      filterOpenWeightModels(OPEN_WEIGHT_MODELS, { downloads: true })
    ).toEqual(OPEN_WEIGHT_MODELS)
  })

  it.for([
    { filter: {}, count: 0 },
    { filter: { useCases: ['edit-images'] as const }, count: 0 },
    { filter: { query: 'kontext' }, count: 1 },
    { filter: { downloads: true }, count: OPEN_WEIGHT_MODELS.length },
    { filter: { tab: 'open' as const }, count: OPEN_WEIGHT_MODELS.length }
  ])(
    'lists $count under All for $filter until searched or asked for',
    ({ filter, count }) => {
      expect(filterOpenWeightModels(OPEN_WEIGHT_MODELS, filter)).toHaveLength(
        count
      )
    }
  )
})
