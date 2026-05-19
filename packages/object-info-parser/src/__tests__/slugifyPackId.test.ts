import { describe, expect, it } from 'vitest'

import { slugifyPackId } from '../helpers/slugifyPackId'

describe('slugifyPackId', () => {
  it.for([
    ['comfyui-impact-pack', 'comfyui-impact-pack'],
    ['ComfyUI-Crystools', 'comfyui-crystools'],
    ['comfyui_impact_pack', 'comfyui-impact-pack'],
    ['ComfyUI_QwenVL', 'comfyui-qwenvl'],
    ['basic_data_handling', 'basic-data-handling'],
    ['ComfyUI_Step1X-Edit', 'comfyui-step1x-edit'],
    ['HunyuanVideo_Foley', 'hunyuanvideo-foley']
  ])('slugifies %s -> %s', ([input, expected]) => {
    expect(slugifyPackId(input)).toBe(expected)
  })

  it('collapses runs of hyphens introduced by adjacent separators', () => {
    expect(slugifyPackId('a__b')).toBe('a-b')
    expect(slugifyPackId('a-_b')).toBe('a-b')
    expect(slugifyPackId('a___-_b')).toBe('a-b')
  })

  it('strips leading and trailing separators', () => {
    expect(slugifyPackId('_pack_')).toBe('pack')
    expect(slugifyPackId('-pack-')).toBe('pack')
    expect(slugifyPackId('__a__')).toBe('a')
  })

  it('produces URL-slug-safe output for every registry id observed today', () => {
    const samples = [
      'ComfyUI-AniPortrait',
      'comfyui_aniportrait',
      'ComfyUI-API-Manager',
      'ComfyUI_API_Manager',
      'comfy-oiio',
      'comfy_oiio',
      'ComfyUI-FlashVSR_Ultra_Fast',
      'comfyui-frame-interpolation',
      'Qwen3_TTS',
      'qwen3-tts'
    ]
    for (const sample of samples) {
      expect(slugifyPackId(sample)).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('returns the input unchanged when already a clean slug', () => {
    expect(slugifyPackId('comfyui-impact-pack')).toBe('comfyui-impact-pack')
    expect(slugifyPackId('rgthree-comfy')).toBe('rgthree-comfy')
  })
})
