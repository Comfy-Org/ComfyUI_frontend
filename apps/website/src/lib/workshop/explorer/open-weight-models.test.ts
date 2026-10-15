import { describe, expect, it } from 'vitest'

import publishedPages from '@/config/published-model-pages.json' with { type: 'json' }
import { getModelBySlug } from '@/config/models'
import { getRoutes } from '@/config/routes'
import { OPEN_WEIGHT_MODELS } from './open-weight-models'

describe('OPEN_WEIGHT_MODELS', () => {
  it.for(OPEN_WEIGHT_MODELS.map((model) => [model.slug, model] as const))(
    '%s points at a published model page with its own artwork',
    ([, model]) => {
      expect(publishedPages).toContain(`${getRoutes().models}${model.slug}/`)
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
