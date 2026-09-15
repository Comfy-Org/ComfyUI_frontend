import { describe, expect, it } from 'vitest'

import {
  customerVideoForStory,
  customerVideoPath,
  customerVideoStories,
  formatDuration,
  getCustomerVideoStory,
  isoDuration,
  otherCustomerVideoStories
} from './customerVideos'

describe('customerVideoStories', () => {
  it('has no duplicate slugs', () => {
    const slugs = customerVideoStories.map((story) => story.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('declares an https media URL for every video, poster, and caption', () => {
    for (const story of customerVideoStories) {
      expect(story.videoSrc).toMatch(/^https:\/\//)
      expect(story.poster).toMatch(/^https:\/\//)
      expect(story.captions.length).toBeGreaterThan(0)
      for (const caption of story.captions) {
        expect(caption.src).toMatch(/^https:\/\//)
      }
    }
  })

  it('does not assert a fabricated duration or upload date', () => {
    for (const story of customerVideoStories) {
      expect(story.durationSeconds).toBeUndefined()
      expect(story.uploadDate).toBeUndefined()
    }
  })
})

describe('getCustomerVideoStory', () => {
  it('returns the matching story', () => {
    expect(getCustomerVideoStory('black-math').company).toBe('Black Math')
  })

  it('throws for an unknown slug', () => {
    // @ts-expect-error deliberately invalid slug
    expect(() => getCustomerVideoStory('not-a-story')).toThrow()
  })
})

describe('customerVideoPath', () => {
  it('builds the watch-page path from a slug', () => {
    expect(customerVideoPath('black-math')).toBe('/customers/videos/black-math')
  })
})

describe('otherCustomerVideoStories', () => {
  it('excludes the given story and includes the rest', () => {
    const others = otherCustomerVideoStories('black-math')
    expect(others.some((story) => story.slug === 'black-math')).toBe(false)
    expect(others.length).toBe(customerVideoStories.length - 1)
  })
})

describe('customerVideoForStory', () => {
  it('finds the video for a written story that has one', () => {
    expect(customerVideoForStory('svedka-silverside')?.slug).toBe(
      'silverside-ai'
    )
  })

  it('returns undefined for a written story with no matching video', () => {
    expect(customerVideoForStory('moment-factory')).toBeUndefined()
  })
})

describe('isoDuration', () => {
  it('formats whole minutes and seconds as PT#M#S', () => {
    expect(isoDuration(272)).toBe('PT4M32S')
    expect(isoDuration(60)).toBe('PT1M0S')
  })

  it('returns undefined when the duration is unverified', () => {
    expect(isoDuration(undefined)).toBeUndefined()
    expect(isoDuration(0)).toBeUndefined()
    expect(isoDuration(-5)).toBeUndefined()
  })
})

describe('formatDuration', () => {
  it('formats as m:ss with a zero-padded seconds field', () => {
    expect(formatDuration(272)).toBe('4:32')
    expect(formatDuration(65)).toBe('1:05')
  })

  it('returns undefined when the duration is unverified', () => {
    expect(formatDuration(undefined)).toBeUndefined()
  })
})
