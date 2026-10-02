import { describe, expect, it } from 'vitest'

import { resolveModelRouterRender } from '../../../config/router-render'
import { workshopContract } from '../../../config/workshop-contract-catalog'
import { getAuthoredRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import type { CinematicModel } from './models'
import { runnableCinematicModels, videoShotBlock } from './models'

const SEEDREAM = 'byteplus--seedream-5-pro--generate-images'
const FLUX = 'bfl--flux-2-pro--generate-images'
const execution = workshopContract('bfl/flux-2-pro')

describe('runnableCinematicModels', () => {
  it('lists only studio models that can run, with their logos', () => {
    const models = runnableCinematicModels((slug) => {
      if (slug === SEEDREAM)
        return {
          slug,
          name: 'Seedream 5.0 Pro',
          provider: 'ByteDance',
          execution
        }
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
        name: 'Seedream 5.0 Pro',
        provider: 'ByteDance',
        logo: '/icons/ai-models/bytedance.svg',
        aspects: ['21:9', '16:9', '4:3', '3:2', '2:3', '1:1', '9:16']
      }
    ])
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
    ).toEqual([
      'krea--krea-2-large--generate-images',
      'openai--gpt-image-2--generate-images',
      'openai--gpt-image-2.5-flare--generate-images',
      'openai--gpt-image-2.5-sunburst--generate-images',
      'xai--grok-imagine-image-2.0--generate-images',
      'recraft--v4.1-text-to-image--generate-images'
    ])
  })
})

describe('videoShotBlock', () => {
  const inputs = {
    sourceVideo: false,
    firstFrame: false,
    firstSendable: false,
    lastFrame: false,
    lastSendable: false
  }
  const edit = {
    slug: 'edit',
    name: 'Edit',
    provider: '',
    logo: '',
    video: { sourceVideo: true }
  } as unknown as CinematicModel
  const clip = {
    slug: 'clip',
    name: 'Clip',
    provider: '',
    logo: '',
    firstFrameSlug: 'clip-i2v'
  } as CinematicModel

  it('asks for the video an edit model needs', () => {
    expect(videoShotBlock(edit, inputs)).toBe('cinematic.video.needSourceVideo')
    expect(
      videoShotBlock(edit, { ...inputs, sourceVideo: true })
    ).toBeUndefined()
  })

  it('refuses a starting frame on a model that cannot take one', () => {
    expect(
      videoShotBlock(
        { ...clip, firstFrameSlug: undefined },
        {
          ...inputs,
          firstFrame: true,
          firstSendable: true
        }
      )
    ).toBe('cinematic.video.noFirstFrame')
  })

  it('holds back a frame the page could not read for a model that needs it', () => {
    expect(videoShotBlock(clip, { ...inputs, firstFrame: true })).toBe(
      'cinematic.references.needsPicture'
    )
    expect(
      videoShotBlock(clip, {
        ...inputs,
        firstFrame: true,
        firstSendable: true,
        lastFrame: true
      })
    ).toBe('cinematic.references.needsPicture')
    expect(
      videoShotBlock(clip, { ...inputs, firstFrame: true, firstSendable: true })
    ).toBeUndefined()
  })
})
