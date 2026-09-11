import { describe, expect, it } from 'vitest'

import { bannerName } from './banner-name'

describe('bannerName', () => {
  it('drops a trailing task label however it is separated', () => {
    expect(bannerName('Recraft V4.1 Pro Text-to-Image', 'Text to Image')).toBe(
      'Recraft V4.1 Pro'
    )
    expect(bannerName('Seedance Text to Video', 'Text to Video')).toBe(
      'Seedance'
    )
  })

  it('requires the label to start at a word boundary', () => {
    expect(bannerName('Context-to-Image', 'Text to Image')).toBe(
      'Context-to-Image'
    )
  })

  it('leaves one-word modality labels alone', () => {
    expect(bannerName('Stable Audio', 'Audio')).toBe('Stable Audio')
    expect(bannerName('Tripo 3D', '3D')).toBe('Tripo 3D')
    expect(bannerName('Ideogram & Pruna P-Image', 'Image')).toBe(
      'Ideogram & Pruna P-Image'
    )
  })

  it('keeps the full name when stripping leaves almost nothing', () => {
    expect(bannerName('AI Text to Image', 'Text to Image')).toBe(
      'AI Text to Image'
    )
  })

  it('ignores a localized label that does not match the name', () => {
    expect(bannerName('Flux Text-to-Image', '文生图')).toBe(
      'Flux Text-to-Image'
    )
  })
})
