import { describe, expect, it } from 'vitest'

import { highlightQuery } from './highlightQuery'

describe('highlightQuery', () => {
  it('should return one plain-text part when query is empty', () => {
    expect(highlightQuery('Hello World', '')).toEqual([
      { text: 'Hello World', highlighted: false }
    ])
  })

  it('should mark matching text for highlighting', () => {
    expect(highlightQuery('Hello World', 'World')).toEqual([
      { text: 'Hello ', highlighted: false },
      { text: 'World', highlighted: true }
    ])
  })

  it('should be case-insensitive', () => {
    expect(highlightQuery('Hello World', 'hello')).toEqual([
      { text: 'Hello', highlighted: true },
      { text: ' World', highlighted: false }
    ])
  })

  it('should preserve markup as text parts', () => {
    expect(highlightQuery('<script>alert("xss")</script>', 'alert')).toEqual([
      { text: '<script>', highlighted: false },
      { text: 'alert', highlighted: true },
      { text: '("xss")</script>', highlighted: false }
    ])
  })

  it('should escape special regex characters in query', () => {
    expect(highlightQuery('price is $10.00', '$10')).toEqual([
      { text: 'price is ', highlighted: false },
      { text: '$10', highlighted: true },
      { text: '.00', highlighted: false }
    ])
  })

  it('should highlight multiple occurrences', () => {
    expect(highlightQuery('foo bar foo', 'foo')).toEqual([
      { text: 'foo', highlighted: true },
      { text: ' bar ', highlighted: false },
      { text: 'foo', highlighted: true }
    ])
  })

  it('should highlight cross-word matches', () => {
    expect(highlightQuery('convert image to mask', 'geto')).toEqual([
      { text: 'convert ima', highlighted: false },
      { text: 'ge to', highlighted: true },
      { text: ' mask', highlighted: false }
    ])
  })

  it('should not match across line breaks', () => {
    expect(highlightQuery('ge\nto', 'geto')).toEqual([
      { text: 'ge\nto', highlighted: false }
    ])
  })

  it('should not match across tabs', () => {
    expect(highlightQuery('ge\tto', 'geto')).toEqual([
      { text: 'ge\tto', highlighted: false }
    ])
  })

  it('should not match across multiple spaces', () => {
    expect(highlightQuery('ge  to', 'geto')).toEqual([
      { text: 'ge  to', highlighted: false }
    ])
  })
})
