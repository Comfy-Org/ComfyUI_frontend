import { describe, expect, it } from 'vitest'

import {
  inferBaseModelFromText,
  refineBaseModelLabels
} from './baseModelInference'

describe('inferBaseModelFromText', () => {
  it.for<{ name: string; expected: string | null }>([
    {
      name: 'flux1-disney_renaissance_style.safetensors',
      expected: 'Flux.1 dev'
    },
    { name: 'flux1-arcane_style.safetensors', expected: 'Flux.1 dev' },
    { name: 'flux2-klein-9b-some-thing.safetensors', expected: 'Flux.2 Klein' },
    { name: 'zimage-oldschool_hud_graphics.safetensors', expected: 'Z-Image' },
    { name: 'ZImageTurbo', expected: 'Z-Image' },
    { name: 'Z-Image', expected: 'Z-Image' },
    { name: 'wan22-14b-t2v-instagirl.zip', expected: 'Wan 2.2' },
    { name: 'wan2.2-something.safetensors', expected: 'Wan 2.2' },
    { name: 'wan2.1-x.safetensors', expected: 'Wan 2.1' },
    { name: 'ltx2-squish.safetensors', expected: 'LTX 2' },
    { name: 'qwen-realcomic.zip', expected: 'Qwen' },
    {
      name: 'Qwen-Image-Edit-2511_Consistency.safetensors',
      expected: 'Qwen Image Edit'
    },
    { name: 'pony-50s_noir_movie.safetensors', expected: 'Pony' },
    {
      name: 'illustrious-retro_sci_fi_90_s_anime_style.safetensors',
      expected: 'Illustrious'
    },
    {
      name: 'hidream_o1_image_dev_fp8_scaled.safetensors',
      expected: 'HiDream O1'
    },
    { name: 'hidream-i1-bf16.safetensors', expected: 'HiDream I1' },
    { name: 'Chroma1-HD-fp8mixed.safetensors', expected: 'Chroma1 HD' },
    {
      name: 'chroma-radiance-x0.safetensors',
      expected: 'Chroma1 Radiance'
    },
    { name: 'something-unrelated.bin', expected: null }
  ])('infers $name -> $expected', ({ name, expected }) => {
    expect(inferBaseModelFromText(name)).toBe(expected)
  })
})

describe('refineBaseModelLabels', () => {
  it('promotes a generic family-root label to a versioned variant from filename', () => {
    expect(
      refineBaseModelLabels(
        ['LTX Video'],
        ['LTX_2.3_Crisp_Enhance_Style.safetensors']
      )
    ).toEqual(['LTX 2.3'])
  })

  it('replaces a non-canonical metadata label with the canonical inferred one', () => {
    expect(
      refineBaseModelLabels(['LTXV2'], ['ltxv23-dispatch_style.safetensors'])
    ).toEqual(['LTX 2.3'])
  })

  it('replaces a non-canonical "Flux.2 Klein 9B" with the canonical "Flux.2 Klein"', () => {
    expect(
      refineBaseModelLabels(
        ['Flux.2 Klein 9B'],
        ['flux-2-klein-9b-something.safetensors']
      )
    ).toEqual(['Flux.2 Klein'])
  })

  it('keeps a specific label when filename only matches the family root', () => {
    expect(
      refineBaseModelLabels(['LTX 2.3'], ['something-ltx-tagged.safetensors'])
    ).toEqual(['LTX 2.3'])
  })

  it('does not touch labels from a different family', () => {
    expect(
      refineBaseModelLabels(['SDXL'], ['ltx_2.3_lora.safetensors'])
    ).toEqual(['SDXL'])
  })

  it('returns empty when input is empty', () => {
    expect(refineBaseModelLabels([], ['anything.safetensors'])).toEqual([])
  })
})
