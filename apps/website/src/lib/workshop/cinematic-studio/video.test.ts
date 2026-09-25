import { describe, expect, it } from 'vitest'

import {
  prepareModelRouterRender,
  resolveModelRouterRender
} from '../../../config/router-render'
import { getAuthoredRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import {
  cinematicVideoDescriptor,
  cinematicVideoForm,
  videoResolutionsForAspect
} from './video'

const textSlug = 'byteplus--seedance-2-5-text-to-video--generate-videos'
const frameSlug = 'byteplus--seedance-2-5-first-last-frame--animate-images'
const wanSlugs = [
  'wan--text-to-video--generate-videos',
  'wan--image-to-video--animate-images',
  'wan--text-to-video-2.7--generate-videos',
  'wan--image-to-video-2.7--animate-images',
  'wan--text-to-video-3.0--generate-videos',
  'wan--image-to-video-3.0--animate-images',
  'wan--text-to-video-3.0-prime--generate-videos',
  'wan--image-to-video-3.0-prime--animate-images'
]
const ltxSlug = 'ltx--text-to-video-v2--generate-videos'
const klingSlug = 'kling--v3--generate-videos'
const klingOmniSlug = 'kling--omni-pro-text-to-video--generate-videos'
const ltxFastSlug = 'ltx--ltx-2-5-fast--generate-videos'
const originalDemoSlugs = [
  'byteplus--seedance-2-text-to-video--generate-videos',
  'byteplus--seedance-2-image-to-video--animate-images',
  'byteplus--seedance-2-fast-text-to-video--generate-videos',
  'byteplus--seedance-2-fast-first-last-frame--animate-images',
  'xai--grok-imagine-video-1.5--generate-videos',
  'xai--grok-imagine-video-1.5--animate-images'
]

function modelFor(slug: string) {
  const model = getAuthoredRouterWorkshopModelDetail(slug)
  if (!model?.execution) throw new Error(`Missing bundled contract: ${slug}`)
  return { ...model, execution: model.execution }
}

describe('cinematic video Router contract', () => {
  it.for([
    textSlug,
    frameSlug,
    ...wanSlugs,
    ltxSlug,
    ltxFastSlug,
    klingSlug,
    klingOmniSlug,
    ...originalDemoSlugs
  ])(
    'prepares %s with the same Router request path and no catalogue media',
    async (slug) => {
      const model = modelFor(slug)
      const descriptor = cinematicVideoDescriptor(model.execution)
      if (!descriptor) throw new Error(`Missing video settings: ${slug}`)
      const firstFrame = new File(['frame'], 'frame.png', { type: 'image/png' })
      const form = cinematicVideoForm(
        model,
        'A slow dolly through a forest',
        descriptor.aspects[0] ?? '16:9',
        {
          durationSeconds: descriptor.defaultDuration,
          resolution: descriptor.defaultResolution,
          generateAudio: false,
          ...(descriptor.firstFrame === 'required' ? { firstFrame } : {}),
          ...(descriptor.seed ? { seed: 42 } : {})
        }
      )
      const prepared = await prepareModelRouterRender(
        model,
        {},
        {
          form,
          uploadFile: async () => 'https://uploads.example.com/user-frame.png'
        }
      )
      expect(prepared.expectedKind).toBe('video')
      expect(JSON.stringify(prepared.body)).toContain(
        'A slow dolly through a forest'
      )
      expect(JSON.stringify(prepared.body)).not.toContain('cdn.jsdelivr.net')
      expect(JSON.stringify(prepared.body)).not.toContain('media.comfy.org')
      if (descriptor.firstFrame === 'required')
        expect(JSON.stringify(prepared.body)).toContain(
          'https://uploads.example.com/user-frame.png'
        )
      if (slug.startsWith('wan--')) {
        expect(prepared.body).toMatchObject({
          parameters: { duration: 5, seed: 42 }
        })
        expect(descriptor.generateAudio).toBe(false)
        expect(descriptor.lastFrame).toBe(false)
      }
      if (slug === ltxSlug)
        expect(prepared.body).toMatchObject({
          duration: 5,
          resolution: '1280x720',
          generate_audio: false,
          fps: 25
        })
    }
  )

  it.for(['std', 'pro'])(
    'sends Kling quality %s, native string duration and audio through the shared Router form',
    async (quality) => {
      const model = modelFor(klingSlug)
      const form = cinematicVideoForm(model, 'A train approaches.', '9:16', {
        durationSeconds: 7,
        resolution: quality,
        generateAudio: true
      })
      const prepared = await prepareModelRouterRender(model, {}, { form })
      expect(prepared.body).toMatchObject({
        prompt: 'A train approaches.',
        aspect_ratio: '9:16',
        duration: '7',
        mode: quality,
        sound: 'on'
      })
      expect(prepared.body).not.toHaveProperty('resolution')
      expect(prepared.body).not.toHaveProperty('image')
    }
  )

  it('keeps Kling O3 on its authored single-shot text route', async () => {
    const model = modelFor(klingOmniSlug)
    const form = cinematicVideoForm(model, 'A train approaches.', '16:9', {
      durationSeconds: 6,
      resolution: '1080p',
      generateAudio: false
    })
    const prepared = await prepareModelRouterRender(model, {}, { form })
    expect(prepared.expectedKind).toBe('video')
    expect(prepared.body).toMatchObject({
      prompt: 'A train approaches.',
      duration: '6'
    })
    expect(() =>
      cinematicVideoForm(model, 'A train approaches.', '16:9', {
        durationSeconds: 6,
        resolution: '1080p',
        generateAudio: false,
        firstFrame: new File(['frame'], 'frame.png', { type: 'image/png' })
      })
    ).toThrow('validation')
  })

  it('uses the LTX Pro resolution matrix without advertising Fast-only sizes', () => {
    const model = modelFor(ltxSlug)
    const descriptor = cinematicVideoDescriptor(model.execution)
    expect(descriptor).toMatchObject({
      resolutions: ['1280x720', '720x1280', '1920x1080', '1080x1920'],
      aspects: ['16:9', '9:16'],
      firstFrame: 'unsupported',
      generateAudio: true
    })
    expect(descriptor?.seed).toBeUndefined()
    if (!descriptor) throw new Error('Missing LTX descriptor')
    expect(videoResolutionsForAspect(descriptor, '9:16')).toEqual([
      '720x1280',
      '1080x1920'
    ])
    expect(
      cinematicVideoForm(model, 'Move slowly', '9:16', {
        durationSeconds: 5,
        resolution: '1920x1080',
        generateAudio: true
      }).values.resolution
    ).toBe('1080x1920')
    expect(() =>
      cinematicVideoForm(model, 'Move slowly', '16:9', {
        durationSeconds: 5,
        resolution: '3840x2160',
        generateAudio: true
      })
    ).toThrow('validation')
  })

  it.for(wanSlugs)('derives Wan capability limits for %s', (slug) => {
    const descriptor = cinematicVideoDescriptor(modelFor(slug).execution)
    const version3 = slug.includes('3.0')
    const version27 = slug.includes('2.7')
    expect(descriptor?.durations).toEqual(
      version3
        ? Array.from({ length: 29 }, (_, i) => i + 2)
        : version27
          ? Array.from({ length: 14 }, (_, i) => i + 2)
          : [5, 10, 15]
    )
    expect(descriptor?.seed).toEqual({ minimum: 0, maximum: 2147483647 })
    if (slug !== 'wan--text-to-video--generate-videos')
      expect(descriptor?.aspects).toEqual([])
  })

  it('rejects unsupported frame, duration and seed requests rather than silently changing them', () => {
    const model = modelFor(ltxSlug)
    const settings = {
      durationSeconds: 5,
      resolution: '1280x720',
      generateAudio: true
    }
    expect(() =>
      cinematicVideoForm(model, 'Move slowly', '16:9', { ...settings, seed: 1 })
    ).toThrow('validation')
    expect(() =>
      cinematicVideoForm(model, 'Move slowly', '16:9', {
        ...settings,
        durationSeconds: 7
      })
    ).toThrow('validation')
    expect(() =>
      cinematicVideoForm(model, 'Move slowly', '16:9', {
        ...settings,
        firstFrame: new File(['frame'], 'frame.png', { type: 'image/png' })
      })
    ).toThrow('validation')
  })

  it.for(wanSlugs.filter((slug) => slug.includes('--image-to-video')))(
    'requires an uploaded first frame for %s',
    (slug) => {
      const model = modelFor(slug)
      expect(() =>
        cinematicVideoForm(model, 'Move slowly', '16:9', {
          durationSeconds: 5,
          resolution: '720P',
          generateAudio: false
        })
      ).toThrow('validation')
      expect(() =>
        cinematicVideoForm(model, 'Move slowly', '16:9', {
          durationSeconds: 5,
          resolution: '720P',
          generateAudio: false,
          seed: -1
        })
      ).toThrow('validation')
    }
  )

  it('does not misrepresent reference-video input as a starting frame', () => {
    const model = modelFor('wan--reference-video-2.7--animate-images')
    expect(cinematicVideoDescriptor(model.execution)).toBeUndefined()
  })
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
