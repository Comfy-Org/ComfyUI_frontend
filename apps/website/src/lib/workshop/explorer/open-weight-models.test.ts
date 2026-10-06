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
    '%s points at a published supported-models page with its own artwork',
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
})

describe('filterOpenWeightModels', () => {
  it.for([
    { filter: {}, slugs: OPEN_WEIGHT_MODELS.map((model) => model.slug) },
    {
      filter: { useCases: ['edit-images'] as const },
      slugs: ['flux1-dev-kontext-fp8-scaled', 'qwen-image-edit-2511-bf16']
    },
    { filter: { query: ' LIGHTRICKS ' }, slugs: ['ltx-2-3-22b-dev'] },
    {
      filter: { query: 'animate images' },
      slugs: ['wan2-2-i2v-high-noise-14b-fp8-scaled']
    },
    {
      filter: { query: 'flux', useCases: ['edit-images'] as const },
      slugs: ['flux1-dev-kontext-fp8-scaled']
    }
  ])('narrows by $filter', ({ filter, slugs }) => {
    expect(
      filterOpenWeightModels(OPEN_WEIGHT_MODELS, filter).map(
        (model) => model.slug
      )
    ).toEqual(slugs)
  })
})
