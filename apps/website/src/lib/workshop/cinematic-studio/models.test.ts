import { describe, expect, it } from 'vitest'

import { workshopContract } from '../../../config/workshop-contract-catalog'
import { getAuthoredRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { cinematicStudioHref, runnableCinematicModels } from './models'

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
      { slug: FLUX, referenceModelSlug: FLUX, referenceMax: 9 }
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
        'ltx--text-to-video-v2--generate-videos'
      ].map((slug) => ({
        slug,
        firstFrame: slug.includes('--image-to-video')
          ? 'required'
          : 'unsupported'
      }))
    ])
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
        seed: { step: 1 }
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
