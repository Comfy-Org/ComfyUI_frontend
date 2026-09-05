import { describe, expect, it } from 'vitest'

import { postSlug, sortPostsByDateDesc, toCardProps } from './engineeringBlog'

function entry(id: string, date: string) {
  return {
    id,
    data: {
      title: `Title for ${id}`,
      description: `Description for ${id}`,
      author: 'Kishore',
      date: new Date(date),
      heroDiagram: 'architecture' as const
    }
  }
}

describe('postSlug', () => {
  it('strips the locale prefix from an id', () => {
    expect(postSlug('en/crdts-from-scratch')).toBe('crdts-from-scratch')
  })

  it('returns the id unchanged when there is no locale prefix', () => {
    expect(postSlug('crdts-from-scratch')).toBe('crdts-from-scratch')
  })
})

describe('sortPostsByDateDesc', () => {
  it('orders posts from newest to oldest', () => {
    const posts = [
      entry('en/oldest', '2026-01-01'),
      entry('en/newest', '2026-08-22'),
      entry('en/middle', '2026-05-01')
    ]

    expect(sortPostsByDateDesc(posts).map((post) => post.id)).toEqual([
      'en/newest',
      'en/middle',
      'en/oldest'
    ])
  })

  it('does not mutate the input array', () => {
    const posts = [entry('en/a', '2026-01-01'), entry('en/b', '2026-08-22')]
    const original = [...posts]

    sortPostsByDateDesc(posts)

    expect(posts).toEqual(original)
  })
})

describe('toCardProps', () => {
  it('maps a collection entry to card props with the locale-stripped slug', () => {
    const post = entry('en/crdts-from-scratch', '2026-08-22')

    expect(toCardProps(post)).toEqual({
      slug: 'crdts-from-scratch',
      title: post.data.title,
      description: post.data.description,
      author: post.data.author,
      date: post.data.date,
      heroDiagram: post.data.heroDiagram
    })
  })
})
