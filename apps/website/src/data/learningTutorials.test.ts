import { describe, expect, it } from 'vitest'

import {
  categoryChapters,
  episodeLabel,
  filterByCategory,
  learningCategories,
  learningTutorials,
  recommendedFor
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

describe('episodeLabel', () => {
  it('composes the localized episode label', () => {
    expect(episodeLabel(2, 'en')).toBe('Episode 2')
    expect(episodeLabel(2, 'zh-CN')).toBe('第 2 集')
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
