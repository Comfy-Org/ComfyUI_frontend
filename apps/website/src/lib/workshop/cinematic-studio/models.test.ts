import { describe, expect, it } from 'vitest'

import { resolveModelRouterRender } from '../../../config/router-render'
import { workshopContract } from '../../../config/workshop-contract-catalog'
import { getAuthoredRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { cinematicStudioHref, runnableCinematicModels } from './models'

const SEEDREAM = 'byteplus--seedream-4-5--generate-images'
const FLUX = 'bfl--flux-2-pro--generate-images'
const execution = workshopContract('bfl/flux-2-pro')

describe('runnableCinematicModels', () => {
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

function holds(value: unknown, file: File): boolean {
  if (value === file) return true
  if (value instanceof Blob || value === null || typeof value !== 'object')
    return false
  return Object.values(value).some((item) => holds(item, file))
}

describe('reference operations', () => {
  const models = runnableCinematicModels(getAuthoredRouterWorkshopModelDetail)
  const cast = new File(['cast'], 'cast.png', { type: 'image/png' })
  const palette = new File(['palette'], 'palette.png', { type: 'image/png' })

  it.for(models.filter((model) => model.referenceSlug))(
    'sends the references of $name through the real parameter mapper',
    ({ referenceSlug }) => {
      const detail = referenceSlug
        ? getAuthoredRouterWorkshopModelDetail(referenceSlug)
        : undefined
      if (!detail) throw new Error(`Missing ${referenceSlug}`)

      const { values } = resolveModelRouterRender(detail, {
        prompt: 'A lighthouse at dusk',
        reference_images: [cast, palette]
      })

      expect(holds(values, cast)).toBe(true)
    }
  )

  it('offers no reference operation for a model that would drop them', () => {
    expect(
      models.filter((model) => !model.referenceSlug).map((model) => model.slug)
    ).toEqual(['krea--krea-2-large--generate-images'])
  })
})
