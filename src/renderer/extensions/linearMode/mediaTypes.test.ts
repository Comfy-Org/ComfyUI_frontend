import { describe, expect, it } from 'vitest'

import { getMediaType } from '@/renderer/extensions/linearMode/mediaTypes'
import { makeResultItem } from '@/renderer/extensions/linearMode/__fixtures__/testResultItemFactory'

describe('getMediaType', () => {
  it('returns empty string for undefined output', () => {
    expect(getMediaType()).toBe('')
  })

  it('prioritises video suffix over mediaType', () => {
    expect(
      getMediaType(
        makeResultItem({ filename: 'clip.mp4', mediaType: 'images' })
      )
    ).toBe('video')
  })

  it('prioritises image suffix over mediaType', () => {
    expect(
      getMediaType(
        makeResultItem({ filename: 'photo.png', mediaType: 'video' })
      )
    ).toBe('images')
  })

  it.for([
    { mediaType: 'image_compare', expected: 'image_compare' },
    { mediaType: 'audio', expected: 'audio' },
    { mediaType: '3d', expected: '3d' }
  ])(
    'falls back to raw mediaType for $mediaType',
    ({ mediaType, expected }) => {
      expect(getMediaType(makeResultItem({ mediaType }))).toBe(expected)
    }
  )
})
