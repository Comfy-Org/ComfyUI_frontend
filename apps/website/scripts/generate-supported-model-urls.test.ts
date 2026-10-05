import { describe, expect, it } from 'vitest'

import { compileSupportedModelUrls } from './generate-supported-model-urls'

const hubPages = [
  { newSlug: 'wan-2-7-image-to-video', name: 'Wan 2.7 Image-to-Video' },
  { newSlug: 'wan-2-7-video-edit', name: 'Wan 2.7 Video Edit' },
  { newSlug: 'wan-2-7-text-to-video', name: 'Wan 2.7 Text-to-Video' },
  { newSlug: 'seedance-2-0-text-to-video', name: 'Seedance 2.0 Text-to-Video' },
  {
    newSlug: 'seedance-2-0-fast-text-to-video',
    name: 'Seedance 2.0 Fast Text-to-Video'
  },
  {
    newSlug: 'kling-2-6-pro-text-to-video-with-audio',
    name: 'Kling 2.6 Pro Text-to-Video with Audio'
  },
  {
    newSlug: 'elevenlabs-text-to-dialogue',
    name: 'ElevenLabs Text-to-Dialogue'
  },
  { newSlug: 'nano-banana-image-edit', name: 'Nano Banana Image Edit' },
  { newSlug: 'nano-banana-text-to-image', name: 'Nano Banana Text-to-Image' }
]
const providers = ['ElevenLabs', 'Kling']

const hubSlugFor = (displayName: string) =>
  compileSupportedModelUrls(
    [{ slug: 'page', displayName }],
    hubPages,
    providers
  )[0][1]

describe('compileSupportedModelUrls', () => {
  it.for([
    ['Wan 2.7', 'wan-2-7-text-to-video'],
    ['Nano Banana', 'nano-banana-text-to-image'],
    ['Seedance 2.0', 'seedance-2-0-text-to-video'],
    ['Seedance 2', 'seedance-2-0-text-to-video'],
    ['Kling 2.6', undefined],
    ['ElevenLabs', undefined],
    ['Wan', undefined],
    ['Wan 2.7 Turbo', undefined],
    ['wan2.7-vae-bf16', undefined]
  ] as const)('sends "%s" to %s', ([displayName, hubSlug]) => {
    expect(hubSlugFor(displayName)).toBe(hubSlug)
  })

  it('resolves an alias through its canonical page', () => {
    expect(
      compileSupportedModelUrls(
        [
          { slug: 'wan-27', canonicalSlug: 'wan2-7', displayName: 'Wan 27' },
          { slug: 'wan2-7', displayName: 'Wan 2.7' }
        ],
        hubPages,
        providers
      )
    ).toEqual([
      ['wan-27', 'wan-2-7-text-to-video'],
      ['wan2-7', 'wan-2-7-text-to-video']
    ])
  })

  it('keeps frozen rows and slugs no longer in the data', () => {
    expect(
      compileSupportedModelUrls(
        [{ slug: 'wan2-7', displayName: 'Wan 2.7' }],
        hubPages,
        providers,
        [['wan2-7'], ['retired-page']]
      )
    ).toEqual([['retired-page'], ['wan2-7']])
  })
})
