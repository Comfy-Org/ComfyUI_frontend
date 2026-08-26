import { describe, expect, it } from 'vitest'

import {
  categoryChapters,
  filterByCategory,
  learningCategories,
  learningTutorials,
  recommendedFor,
  youtubeEmbedUrl
} from './learningTutorials'

const firstVfx = filterByCategory('vfx')[0]
const secondVfx = filterByCategory('vfx')[1]

describe('episode numbering', () => {
  it('is unique within every category', () => {
    for (const category of learningCategories) {
      const episodes = filterByCategory(category).map((item) => item.episode)
      expect(new Set(episodes).size).toBe(episodes.length)
    }
  })

  it('starts at 1 in every populated category', () => {
    for (const category of learningCategories) {
      const episodes = filterByCategory(category).map((item) => item.episode)
      if (episodes.length) expect(Math.min(...episodes)).toBe(1)
    }
  })
})

describe('categoryChapters', () => {
  it('lists same-category siblings excluding the tutorial itself', () => {
    const chapters = categoryChapters(firstVfx)
    expect(chapters).toHaveLength(filterByCategory('vfx').length - 1)
    expect(chapters).not.toContainEqual(firstVfx)
    expect(chapters.every((item) => item.category === 'vfx')).toBe(true)
  })

  it('sorts by episode number', () => {
    const episodes = categoryChapters(firstVfx).map((item) => item.episode)
    expect(episodes).toEqual([...episodes].sort((a, b) => a - b))
    expect(categoryChapters(firstVfx)[0]).toEqual(secondVfx)
  })
})

describe('video source', () => {
  it('plays via exactly one of videoSrc or youtubeId', () => {
    for (const tutorial of learningTutorials) {
      expect(Boolean(tutorial.videoSrc) !== Boolean(tutorial.youtubeId)).toBe(
        true
      )
    }
  })

  it('builds a privacy-friendly nocookie embed URL from an id', () => {
    expect(youtubeEmbedUrl('abc123')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123?autoplay=1&mute=1&rel=0'
    )
  })
})

describe('basics CTA', () => {
  it('sends basics tutorials to cloud signup with a Try for Free label', () => {
    const basics = filterByCategory('basics')
    expect(basics.length).toBeGreaterThan(0)
    for (const tutorial of basics) {
      expect(tutorial.href).toMatch(
        /^https:\/\/cloud\.comfy\.org\/\?.*utm_campaign=free_tier.*utm_content=learning_basics_/
      )
      expect(tutorial.newTab).toBe(true)
      expect(tutorial.ctaLabelKey).toBe('cta.tryForFree')
    }
  })
})

describe('recommendedFor', () => {
  it('only recommends tutorials from other categories', () => {
    const recommended = recommendedFor(firstVfx)
    expect(recommended.length).toBeGreaterThan(0)
    expect(recommended.every((item) => item.category !== 'vfx')).toBe(true)
  })

  it('respects the limit', () => {
    expect(recommendedFor(firstVfx, 3)).toHaveLength(3)
    expect(recommendedFor(firstVfx, 1)).toHaveLength(1)
    expect(recommendedFor(firstVfx, learningTutorials.length).length).toBe(
      learningTutorials.length - filterByCategory('vfx').length
    )
  })
})
