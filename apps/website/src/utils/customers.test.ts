import { describe, expect, it } from 'vitest'

import { customerStorySchema } from '../content/customers.schema'
import {
  filterAndSortCustomerCards,
  nextStory,
  sortStories,
  storySlug,
  toCardProps
} from './customers'

const validFrontmatter = {
  title:
    'How Series Entertainment Rebuilt Game and Video Production with ComfyUI',
  category: 'GAME & VIDEO PRODUCTION',
  description: 'Scaling emotional storytelling across 100,000+ assets.',
  cover:
    'https://media.comfy.org/website/customers/series-entertainment/cover.webp',
  order: 0,
  dateAdded: '2026-07-01',
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
      cover: validFrontmatter.cover,
      description: validFrontmatter.description,
      dateAdded: validFrontmatter.dateAdded
    })
  })
})

describe('filterAndSortCustomerCards', () => {
  it.for([
    { field: 'title', query: 'projection', titles: ['Projection mapping'] },
    { field: 'category', query: 'public art', titles: ['Projection mapping'] },
    { field: 'company', query: 'black math', titles: ['Studio film'] },
    { field: 'description', query: 'material', titles: ['Studio film'] },
    {
      field: 'spaced company',
      query: ' Black \t Math ',
      titles: ['Studio film']
    }
  ] as const)('matches the $field', ({ query, titles }) => {
    const cards = [
      {
        title: 'Projection mapping',
        category: 'PUBLIC ART',
        description: 'Domes and facades.',
        date: '2026-07-01'
      },
      {
        title: 'Studio film',
        category: 'CASE STUDY',
        description: 'Material generation.',
        company: 'Black Math',
        date: '2026-07-01'
      }
    ]

    const results = filterAndSortCustomerCards(
      cards,
      query,
      'latest',
      (card) => card.date
    )

    expect(results.map((card) => card.title)).toEqual(titles)
  })

  it.for([
    { sort: 'latest', titles: ['new', 'tie-a', 'tie-b', 'old'] },
    { sort: 'oldest', titles: ['old', 'tie-a', 'tie-b', 'new'] }
  ] as const)(
    'preserves curated order for tied dates when sorting $sort',
    ({ sort, titles }) => {
      const cards = [
        { title: 'tie-a', date: '2026-07-01' },
        { title: 'new', date: '2026-10-02' },
        { title: 'tie-b', date: '2026-07-01' },
        { title: 'old', date: '2026-04-23' }
      ].map((card) => ({ ...card, category: 'STORY', description: '' }))
      const original = [...cards]

      const results = filterAndSortCustomerCards(
        cards,
        '',
        sort,
        (card) => card.date
      )

      expect(results.map((card) => card.title)).toEqual(titles)
      expect(cards).toEqual(original)
    }
  )
})
