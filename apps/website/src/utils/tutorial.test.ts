import { describe, expect, it } from 'vitest'

import { getTutorialPosterSrc } from './tutorial'

describe('getTutorialPosterSrc', () => {
  it('returns the explicit poster URL when provided', () => {
    expect(
      getTutorialPosterSrc({
        order: 1,
        tags: [],
        title: 'T',
        videoSrc: 'https://example.com/v.mp4',
        poster: 'https://example.com/poster.jpg'
      })
    ).toBe('https://example.com/poster.jpg')
  })

  it('falls back to videoSrc#t=<posterTime> when poster is missing', () => {
    expect(
      getTutorialPosterSrc({
        order: 1,
        tags: [],
        title: 'T',
        videoSrc: 'https://example.com/v.mp4',
        posterTime: 7
      })
    ).toBe('https://example.com/v.mp4#t=7')
  })

  it('uses the default poster time when neither poster nor posterTime is set', () => {
    expect(
      getTutorialPosterSrc({
        order: 1,
        tags: [],
        title: 'T',
        videoSrc: 'https://example.com/v.mp4'
      })
    ).toBe('https://example.com/v.mp4#t=1')
  })
})
