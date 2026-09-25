import { describe, expect, it } from 'vitest'

import { workshopContract } from '../../../config/workshop-contract-catalog'
import { getAuthoredRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { cinematicStudioHref, runnableCinematicModels } from './models'

const SEEDREAM = 'byteplus--seedream-4-5--generate-images'
const FLUX = 'bfl--flux-2-pro--generate-images'
const execution = workshopContract('bfl/flux-2-pro')

describe('runnableCinematicModels', () => {
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
      }
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
        logo: '/icons/ai-models/bytedance.svg'
      }
    ])
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
