import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import {
  getHdrPreviewUrl,
  getImageFileUrl,
  getImageFilenameFromUrl,
  isHdrImageFilename,
  isHdrImageUrl,
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

describe('isHdrImageUrl edge cases', () => {
  it('returns false for undefined', () => {
    expect(isHdrImageUrl(undefined)).toBe(false)
  })
})

describe('isHdrImageUrl', () => {
  it('detects hdr outputs from view urls', () => {
    expect(isHdrImageUrl('/api/view?filename=scene.exr&type=output')).toBe(true)
    expect(isHdrImageUrl('/api/view?filename=scene.png&type=output')).toBe(
      false
    )
  })
})

describe('getHdrPreviewUrl', () => {
  it.for([
    {
      url: '/api/view?filename=scene.exr&preview_id=p1',
      expected: '/api/assets/p1/content?disposition=inline'
    },
    {
      url: '/api/view?filename=scene.HDR&preview_id=p1',
      expected: '/api/assets/p1/content?disposition=inline'
    },
    { url: '/api/view?filename=scene.exr', expected: undefined },
    { url: '/api/view?filename=scene.png&preview_id=p1', expected: undefined },
    { url: undefined, expected: undefined }
  ])('maps $url to $expected', ({ url, expected }) => {
    expect(getHdrPreviewUrl(url)).toBe(expected)
  })
})

describe('getImageFileUrl', () => {
  function image(src: string, fileUrl?: string) {
    return fromPartial<HTMLImageElement>({
      src,
      baseURI: window.location.origin,
      dataset: fileUrl ? { fileUrl } : {}
    })
  }

  it.for([
    {
      name: 'the shown image',
      img: () => image('/api/view?filename=a.png&preview=webp'),
      expected: '/api/view?filename=a.png'
    },
    {
      name: 'the file behind a stored preview',
      img: () =>
        image(
          '/api/assets/p1/content?disposition=inline',
          '/api/view?filename=a.exr&preview=webp'
        ),
      expected: '/api/view?filename=a.exr'
    }
  ])('resolves $name without the preview format', ({ img, expected }) => {
    const url = getImageFileUrl(img())
    expect(`${url.pathname}${url.search}`).toBe(expected)
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
