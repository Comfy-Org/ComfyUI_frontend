import { describe, expect, it } from 'vitest'

import { describesCapability } from './model-tags'

describe('describesCapability', () => {
  it.for([
    ['FLUX 2 Max Text-to-Image', 'Black Forest Labs', 'bfl', false],
    ['FLUX 2 Max Text-to-Image', 'Black Forest Labs', 'flux-2', false],
    ['FLUX 2 Max Text-to-Image', 'Black Forest Labs', 'premium', true],
    ['FLUX 2 Max Text-to-Image', 'Black Forest Labs', 'text-to-image', true],
    ['Veo 3 Image-to-Video', 'Google', 'image-to-video', true],
    ['Nano Banana Pro Image Edit', 'Google', 'gemini', false],
    ['Nano Banana Pro Image Edit', 'Google', 'google', false],
    ['Recraft V4.1 Text-to-Vector', 'Recraft', 'V4.1', false],
    ['Grok Imagine Video 1.5 Text-to-Video', 'xAI', '1.5', false],
    ['GPT Image 2 Text-to-Image', 'OpenAI', 'gpt-image', false],
    ['GPT Image 2 Text-to-Image', 'OpenAI', 'image-to-image', true],
    ['Seedream 4.0 Text-to-Image', 'ByteDance', 'image-to-image', true],
    ['Seedream 5.0 Pro Text-to-Image', 'ByteDance', 'seedream-5-pro', false],
    ['Seedance 2.0 Mini Text-to-Video', 'ByteDance', 'seedance-2-mini', false],
    ['Wan 2.7 Text-to-Video', 'Wan', 'wan2.7', false],
    ['Wan 2.6 Text-to-Video', 'Wan', 'wan2.5', true],
    ['Runway Gen-4 Turbo Image-to-Video', 'Runway', 'gen4', false],
    ['Hunyuan3D Part', 'Tencent', 'hunyuan3d', false],
    ['Hunyuan3D Part', 'Tencent', '3d', true],
    ['Hyper3D Rodin Gen-2', 'Rodin', '3d', true],
    ['Seedream 4.0 Text-to-Image', 'ByteDance', '写实', true]
  ] as const)('on %s (%s), shows %s: %s', ([name, provider, tag, shown]) => {
    expect(describesCapability(tag, { name, provider })).toBe(shown)
  })
})
