import { describe, expect, it } from 'vitest'

import { customerStorySchema } from '../content/customers.schema'
import { nextStory, sortStories, storySlug, toCardProps } from './customers'

const validFrontmatter = {
  title:
    'How Series Entertainment Rebuilt Game and Video Production with ComfyUI',
  category: 'GAME & VIDEO PRODUCTION',
  description: 'Scaling emotional storytelling across 100,000+ assets.',
  cover:
    'https://media.comfy.org/website/customers/series-entertainment/cover.webp',
  order: 0,
  sections: [
    { id: 'intro', label: 'INTRO' },
    { id: 'the-problem', label: 'THE PROBLEM' }
  ]
}

describe('customerStorySchema', () => {
  it('accepts a complete, valid story frontmatter', () => {
    expect(customerStorySchema.safeParse(validFrontmatter).success).toBe(true)
  })

  it('accepts an optional external readMore url', () => {
    const result = customerStorySchema.safeParse({
      ...validFrontmatter,
      readMore: 'https://blog.comfy.org/p/example'
    })
    expect(result.success).toBe(true)
  })

  it('rejects frontmatter missing a required field', () => {
    const { title: _title, ...withoutTitle } = validFrontmatter
    expect(customerStorySchema.safeParse(withoutTitle).success).toBe(false)
  })

  it('rejects a cover that is not a url', () => {
    const result = customerStorySchema.safeParse({
      ...validFrontmatter,
      cover: 'cover.webp'
    })
    expect(result.success).toBe(false)
  })

  it('requires each section to declare an id and a label', () => {
    const result = customerStorySchema.safeParse({
      ...validFrontmatter,
      sections: [{ id: 'intro' }]
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown frontmatter keys so typos fail the build', () => {
    const result = customerStorySchema.safeParse({
      ...validFrontmatter,
      readMoreHref: 'https://blog.comfy.org/p/example'
    })
    expect(result.success).toBe(false)
  })
})

describe('storySlug', () => {
  it('drops the locale prefix from a collection id', () => {
    expect(storySlug('en/series-entertainment')).toBe('series-entertainment')
    expect(storySlug('zh-CN/groove-jones')).toBe('groove-jones')
  })
})

describe('sortStories', () => {
  it('orders stories by their order field ascending', () => {
    const stories = [
      { id: 'en/c', data: { order: 2 } },
      { id: 'en/a', data: { order: 0 } },
      { id: 'en/b', data: { order: 1 } }
    ]
    expect(sortStories(stories).map((s) => s.id)).toEqual([
      'en/a',
      'en/b',
      'en/c'
    ])
  })

  it('does not mutate the input array', () => {
    const stories = [
      { id: 'en/b', data: { order: 1 } },
      { id: 'en/a', data: { order: 0 } }
    ]
    sortStories(stories)
    expect(stories.map((s) => s.id)).toEqual(['en/b', 'en/a'])
  })
})

describe('nextStory', () => {
  const ordered = [
    { id: 'en/a', data: { order: 0 } },
    { id: 'en/b', data: { order: 1 } },
    { id: 'en/c', data: { order: 2 } }
  ]

  it('returns the following story', () => {
    expect(nextStory(ordered, 'a').id).toBe('en/b')
  })

  it('wraps around from the last story to the first', () => {
    expect(nextStory(ordered, 'c').id).toBe('en/a')
  })

  it('throws when no story matches the slug', () => {
    expect(() => nextStory(ordered, 'missing')).toThrow()
  })

  it('throws when the list is empty', () => {
    expect(() => nextStory([], 'a')).toThrow()
  })
})

describe('toCardProps', () => {
  it('maps a story entry to listing-card props', () => {
    const entry = { id: 'en/series-entertainment', data: validFrontmatter }
    expect(toCardProps(entry)).toEqual({
      slug: 'series-entertainment',
      title: validFrontmatter.title,
      category: validFrontmatter.category,
      cover: validFrontmatter.cover
    })
  })
})
