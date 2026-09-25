import { describe, expect, it, vi } from 'vitest'

import { workshopContract } from '../../../config/workshop-contract-catalog'
import { prepareModelRouterRender } from '../../../config/router-render'
import { getAuthoredRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import {
  cinematicStudioHref,
  cinematicImageForm,
  runnableCinematicModels
} from './models'

const SEEDREAM = 'byteplus--seedream-4-5--generate-images'
const FLUX = 'bfl--flux-2-pro--generate-images'
const execution = workshopContract('bfl/flux-2-pro')

describe('runnableCinematicModels', () => {
  it('exposes only bundled reference-capable routes with their actual capacity', () => {
    const models = runnableCinematicModels(getAuthoredRouterWorkshopModelDetail)
    expect(
      models
        .filter((model) => model.referenceMax)
        .map(({ slug, referenceModelSlug, referenceMax }) => ({
          slug,
          referenceModelSlug,
          referenceMax
        }))
    ).toEqual([
      {
        slug: SEEDREAM,
        referenceModelSlug: 'byteplus--seedream-4-5--edit-images',
        referenceMax: 10
      },
      {
        slug: 'vertexai--gemini-3-pro-image--generate-images',
        referenceModelSlug: 'vertexai--gemini-3-pro-image--edit-images',
        referenceMax: 4
      },
      { slug: FLUX, referenceModelSlug: FLUX, referenceMax: 9 },
      {
        slug: 'qwen--qwen-image-3.0-pro-text-to-image--generate-images',
        referenceModelSlug: 'qwen--qwen-image-3.0-pro-image-edit--edit-images',
        referenceMax: 3
      },
      {
        slug: 'byteplus--seedream-5-pro--generate-images',
        referenceModelSlug: 'byteplus--seedream-5-pro--edit-images',
        referenceMax: 10
      },
      {
        slug: 'bfl--flux-2-max--generate-images',
        referenceModelSlug: 'bfl--flux-2-max--generate-images',
        referenceMax: 9
      },
      {
        slug: 'vertexai--gemini-nano-banana-2--generate-images',
        referenceModelSlug: 'vertexai--gemini-nano-banana-2--edit-images',
        referenceMax: 4
      },
      {
        slug: 'qwen--qwen-image-3.0-text-to-image--generate-images',
        referenceModelSlug: 'qwen--qwen-image-3.0-image-edit--edit-images',
        referenceMax: 3
      }
    ])
  })
  it('appends verified video routes while preserving the default image model', () => {
    const models = runnableCinematicModels(getAuthoredRouterWorkshopModelDetail)
    expect(models[0].slug).toBe(SEEDREAM)
    expect(
      models
        .filter((model) => model.mode === 'video')
        .map((model) => ({
          slug: model.slug,
          firstFrame: model.video?.firstFrame
        }))
    ).toEqual([
      {
        slug: 'byteplus--seedance-2-5-text-to-video--generate-videos',
        firstFrame: 'unsupported'
      },
      {
        slug: 'byteplus--seedance-2-5-first-last-frame--animate-images',
        firstFrame: 'required'
      },
      ...[
        'wan--text-to-video--generate-videos',
        'wan--image-to-video--animate-images',
        'wan--text-to-video-2.7--generate-videos',
        'wan--image-to-video-2.7--animate-images',
        'wan--text-to-video-3.0--generate-videos',
        'wan--image-to-video-3.0--animate-images',
        'wan--text-to-video-3.0-prime--generate-videos',
        'wan--image-to-video-3.0-prime--animate-images',
        'ltx--text-to-video-v2--generate-videos',
        'ltx--ltx-2-5-fast--generate-videos',
        'kling--v3--generate-videos',
        'kling--omni-pro-text-to-video--generate-videos'
      ].map((slug) => ({
        slug,
        firstFrame: slug.includes('--image-to-video')
          ? 'required'
          : 'unsupported'
      })),
      ...[
        'byteplus--seedance-2-text-to-video--generate-videos',
        'byteplus--seedance-2-image-to-video--animate-images',
        'byteplus--seedance-2-fast-text-to-video--generate-videos',
        'byteplus--seedance-2-fast-first-last-frame--animate-images',
        'xai--grok-imagine-video-1.5--generate-videos',
        'xai--grok-imagine-video-1.5--animate-images'
      ].map((slug) => ({
        slug,
        firstFrame: slug.endsWith('animate-images') ? 'required' : 'unsupported'
      }))
    ])
  })
  it.for([
    'byteplus--seedream-5-pro--generate-images',
    'bfl--flux-2-max--generate-images',
    'vertexai--gemini-nano-banana-2--generate-images',
    'qwen--qwen-image-3.0-text-to-image--generate-images',
    'openai--gpt-image-2--generate-images',
    'openai--gpt-image-2.5-flare--generate-images',
    'openai--gpt-image-2.5-sunburst--generate-images',
    'xai--grok-imagine-image-2.0--generate-images',
    'recraft--v4.1-text-to-image--generate-images'
  ])(
    'prepares original demo image route %s through generic Router parameters',
    async (slug) => {
      const fetch = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('Unexpected network request'))
      const model = getAuthoredRouterWorkshopModelDetail(slug)
      if (!model) throw new Error('Missing authored route')
      expect(
        runnableCinematicModels(getAuthoredRouterWorkshopModelDetail).some(
          (entry) => entry.slug === slug
        )
      ).toBe(true)
      const selected = runnableCinematicModels(
        getAuthoredRouterWorkshopModelDetail
      ).find((entry) => entry.slug === slug)!
      const prepared = await prepareModelRouterRender(
        model,
        {},
        {
          form: cinematicImageForm(model, {
            prompt: 'A cinema still',
            aspect: selected.imageAspects?.[0] ?? '16:9',
            resolutionPixels: 2048
          })
        }
      )
      expect(prepared.expectedKind).toBe('image')
      expect(JSON.stringify(prepared.body)).toContain('A cinema still')
      expect(JSON.stringify(prepared.body)).not.toMatch(
        /media.comfy.org|cdn.jsdelivr.net/
      )
      expect(fetch).not.toHaveBeenCalled()
    }
  )
  it('keeps fixed image sizes and supported ratios faithful to the bundled contracts', async () => {
    const models = runnableCinematicModels(getAuthoredRouterWorkshopModelDetail)
    const gpt = models.find(
      (model) => model.slug === 'openai--gpt-image-2--generate-images'
    )!
    expect(gpt.imageAspects).toEqual(['16:9', '1:1', '9:16', '3:2', '2:3'])
    const recraft = models.find(
      (model) => model.slug === 'recraft--v4.1-text-to-image--generate-images'
    )!
    expect(recraft.imageAspects).toEqual(['1:1'])
    const model = getAuthoredRouterWorkshopModelDetail(gpt.slug)!
    const prepared = await prepareModelRouterRender(
      model,
      {},
      {
        form: cinematicImageForm(model, {
          prompt: 'Portrait',
          aspect: '2:3',
          resolutionPixels: 2048
        })
      }
    )
    expect(prepared.body.size).toBe('1024x1536')
    expect(gpt.referenceMax).toBeUndefined()
    expect(() =>
      cinematicImageForm(model, {
        prompt: 'Portrait',
        aspect: '4:3',
        resolutionPixels: 2048
      })
    ).toThrow('validation')
    expect(() =>
      cinematicImageForm(model, {
        prompt: 'Portrait',
        aspect: '1:1',
        resolutionPixels: 2048,
        references: [new File(['image'], 'frame.png', { type: 'image/png' })]
      })
    ).toThrow('validation')
  })
  it('lists only studio models that can run, with their logos', () => {
    const models = runnableCinematicModels((slug) => {
      if (slug === SEEDREAM)
        return { slug, name: 'Seedream 4.5', provider: 'ByteDance', execution }
      if (slug === FLUX)
        return {
          slug,
          name: 'FLUX.2 Pro',
          provider: 'BFL',
          execution,
          incompleteReason: 'missing-input-schema'
        }
      return undefined
    })

    expect(models).toEqual([
      {
        slug: SEEDREAM,
        name: 'Seedream 4.5',
        provider: 'ByteDance',
        logo: '/icons/ai-models/bytedance.svg',
        seed: { step: 1 },
        imageAspects: [
          '21:9',
          '16:9',
          '4:3',
          '1:1',
          '9:16',
          '3:2',
          '2:3',
          '3:4'
        ]
      }
    ])
  })
  it('derives image seed support and exact bounds from Router form fields', () => {
    const models = runnableCinematicModels(getAuthoredRouterWorkshopModelDetail)
    expect(models.find((model) => model.slug === SEEDREAM)?.seed).toEqual({
      minimum: -1,
      maximum: 2147483647,
      step: 1
    })
    expect(models.find((model) => model.slug === FLUX)?.seed).toEqual({
      step: 1
    })
    expect(
      models.find(
        (model) =>
          model.slug === 'vertexai--gemini-3-pro-image--generate-images'
      )?.seed
    ).toBeUndefined()
    expect(
      models.find(
        (model) => model.slug === 'krea--krea-2-large--generate-images'
      )?.seed
    ).toEqual({ step: 'any' })
    expect(
      models.find(
        (model) => model.slug === 'wan--text-to-video-3.0--generate-videos'
      )?.seed
    ).toEqual({ minimum: 0, maximum: 2147483647, step: 1 })
  })
})

describe('cinematicStudioHref', () => {
  it('links a supported model to the studio with it preselected', () => {
    expect(
      cinematicStudioHref(
        'bfl--flux-2-pro--generate-images',
        '/cinematic-studio'
      )
    ).toBe('/cinematic-studio?model=bfl--flux-2-pro--generate-images')
  })

  it('does not link a model the studio cannot run', () => {
    expect(cinematicStudioHref('kling-ai', '/cinematic-studio')).toBeUndefined()
  })
})
