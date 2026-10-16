import { describe, expect, it } from 'vitest'

import {
  getImageFilenameFromUrl,
  isHdrImageFilename,
  toFullResolutionUrl
} from './hdrFormatUtil'

describe('isHdrImageFilename', () => {
  it('detects exr and hdr regardless of case', () => {
    expect(isHdrImageFilename('render.exr')).toBe(true)
    expect(isHdrImageFilename('RENDER.EXR')).toBe(true)
    expect(isHdrImageFilename('env.hdr')).toBe(true)
  })

  it('rejects non-hdr formats and empty input', () => {
    expect(isHdrImageFilename('image.png')).toBe(false)
    expect(isHdrImageFilename('image.webp')).toBe(false)
    expect(isHdrImageFilename(undefined)).toBe(false)
    expect(isHdrImageFilename('')).toBe(false)
  })
})

describe('getImageFilenameFromUrl', () => {
  it('reads the filename query parameter from a view url', () => {
    expect(
      getImageFilenameFromUrl('/api/view?filename=out.exr&type=output')
    ).toBe('out.exr')
  })

  it('falls back to the last path segment', () => {
    expect(getImageFilenameFromUrl('https://x.test/files/out.hdr')).toBe(
      'out.hdr'
    )
  })

  it('returns undefined for empty input', () => {
    expect(getImageFilenameFromUrl('')).toBeUndefined()
  })
})

describe('toFullResolutionUrl', () => {
  it('strips the preview parameter', () => {
    expect(
      toFullResolutionUrl('/api/view?filename=out.exr&preview=webp;75&rand=1')
    ).toBe('/api/view?filename=out.exr&rand=1')
  })

  it('leaves urls without a preview parameter untouched', () => {
    expect(toFullResolutionUrl('/api/view?filename=out.exr')).toBe(
      '/api/view?filename=out.exr'
    )
  })

  it('preserves absolute http urls while stripping preview', () => {
    expect(
      toFullResolutionUrl('https://x.test/api/view?filename=out.exr&preview=w')
    ).toBe('https://x.test/api/view?filename=out.exr')
  })
})
