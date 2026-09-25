import { describe, expect, it } from 'vitest'

import { resolveModelRouterRender } from '../../../config/router-render'
import { getAuthoredRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { cinematicVideoDescriptor, cinematicVideoForm } from './video'

const textSlug = 'byteplus--seedance-2-5-text-to-video--generate-videos'
const frameSlug = 'byteplus--seedance-2-5-first-last-frame--animate-images'

function modelFor(slug: string) {
  const model = getAuthoredRouterWorkshopModelDetail(slug)
  if (!model?.execution) throw new Error(`Missing bundled contract: ${slug}`)
  return { ...model, execution: model.execution }
}

describe('cinematic video Router contract', () => {
  it.for([
    { slug: textSlug, firstFrame: 'unsupported', lastFrame: false },
    { slug: frameSlug, firstFrame: 'required', lastFrame: true }
  ])(
    'derives supported settings for $slug',
    ({ slug, firstFrame, lastFrame }) => {
      const descriptor = cinematicVideoDescriptor(modelFor(slug).execution)
      expect(descriptor).toMatchObject({
        resolutions: ['480p', '720p', '1080p'],
        defaultDuration: 5,
        defaultResolution: '720p',
        firstFrame,
        lastFrame,
        generateAudio: true
      })
      expect(descriptor?.durations).toEqual(
        Array.from({ length: 27 }, (_, index) => index + 4)
      )
    }
  )

  it.for([textSlug, frameSlug])(
    'resolves actual video settings for %s without seeded example media',
    (slug) => {
      const model = modelFor(slug)
      const firstFrame = new File(['frame'], 'frame.png', { type: 'image/png' })
      const form = cinematicVideoForm(
        model,
        'A slow dolly through a forest',
        '16:9',
        {
          durationSeconds: 8,
          resolution: '1080p',
          generateAudio: false,
          ...(slug === frameSlug ? { firstFrame } : {})
        }
      )
      const resolved = resolveModelRouterRender(model, {}, { form })
      expect(resolved.expectedKind).toBe('video')
      expect(resolved.values).toMatchObject({
        prompt: 'A slow dolly through a forest',
        duration: 8,
        resolution: '1080p',
        generate_audio: false,
        ratio: '16:9'
      })
      expect(resolved.values.last_frame_url).toBeFalsy()
      if (slug === frameSlug)
        expect(resolved.values.first_frame_url).toMatchObject({
          file: firstFrame
        })
    }
  )

  it('requires the user first frame instead of silently using a catalogue example', () => {
    const model = modelFor(frameSlug)
    expect(() =>
      cinematicVideoForm(model, 'A slow dolly', '16:9', {
        durationSeconds: 5,
        resolution: '720p',
        generateAudio: true
      })
    ).toThrow('validation')
  })
})
