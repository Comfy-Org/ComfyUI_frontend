import { describe, expect, it } from 'vitest'

import { getAuthoredRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { runnableCinematicVideoModels } from './models'
import {
  durationRange,
  resolutionLabel,
  topResolution,
  videoCapabilities
} from './video'

function capabilities(slug: string) {
  const execution = getAuthoredRouterWorkshopModelDetail(slug)?.execution
  if (!execution) throw new Error(`Missing ${slug}`)
  return videoCapabilities(execution)
}

describe('videoCapabilities', () => {
  it('reads lengths, resolutions, frames and sound from the contract', () => {
    const seedance = capabilities(
      'byteplus--seedance-2-text-to-video--generate-videos'
    )
    expect(durationRange(seedance)).toBe('4–15s')
    expect(seedance.defaultDuration).toBe(5)
    expect(topResolution(seedance)).toBe('4K')
    expect(seedance.aspects).toContain('21:9')
    expect(seedance.audioField).toBe('generate_audio')
    expect(seedance.firstFrame).toBeUndefined()
  })

  it('finds a starting and an ending frame on image-to-video operations', () => {
    const lastFrame = capabilities(
      'byteplus--seedance-2-5-first-last-frame--animate-images'
    )
    expect(lastFrame.firstFrame).toBe('first_frame')
    expect(lastFrame.firstFrameRequired).toBe(true)
    expect(lastFrame.lastFrame).toBe(true)
    expect(
      capabilities('wan--image-to-video-3.0--animate-images').lastFrame
    ).toBe(false)
  })

  it('knows an edit operation needs a source video and has no length', () => {
    const edit = capabilities('byteplus--seedance-2-5-edit-video--edit-videos')
    expect(edit.sourceVideo).toBe(true)
    expect(edit.durations).toEqual([])
    expect(durationRange(edit)).toBeUndefined()
  })

  it('offers no frame choice to a model that picks its own shape', () => {
    expect(
      capabilities('wan--text-to-video-3.0--generate-videos').aspects
    ).toEqual([])
  })
})

describe('resolutionLabel', () => {
  it('reads every provider spelling the same way', () => {
    expect(['hd', 'fhd', '1080P', '4k'].map(resolutionLabel)).toEqual([
      '720p',
      '1080p',
      '1080p',
      '4K'
    ])
  })
})

describe('runnableCinematicVideoModels', () => {
  const models = runnableCinematicVideoModels(
    getAuthoredRouterWorkshopModelDetail
  )

  it('lists the video models in the studio order', () => {
    expect(models.map((model) => model.name)).toEqual([
      'Seedance 2.5',
      'Seedance 2.5 Edit',
      'Seedance 2.0',
      'Wan 3.0',
      'FLUX.3 Video',
      'Gemini Omni Flash 1.1',
      'Grok Imagine 1.5',
      'Kling 3.0',
      'Seedance 2.0 Fast',
      'Seedance 2.0 Mini'
    ])
    expect(models.every((model) => model.mode === 'video')).toBe(true)
  })

  it('pairs each model with the operation that starts from an image', () => {
    const bySlug = Object.fromEntries(
      models.map((model) => [model.name, model.firstFrameSlug])
    )
    expect(bySlug['Seedance 2.0']).toBe(
      'byteplus--seedance-2-image-to-video--animate-images'
    )
    expect(bySlug['Seedance 2.0 Mini']).toBe(
      'byteplus--seedance-2-mini-text-to-video--generate-videos'
    )
    expect(bySlug['Seedance 2.5 Edit']).toBeUndefined()
  })
})
