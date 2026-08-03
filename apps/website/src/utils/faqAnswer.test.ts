import { describe, expect, it } from 'vitest'

import { faqAnswerPlainText, parseFaqAnswer } from './faqAnswer'

describe('parseFaqAnswer', () => {
  it('keeps a plain answer as a single text part', () => {
    expect(parseFaqAnswer('Up to 2K, and 5 to 15 seconds.')).toEqual([
      { type: 'text', value: 'Up to 2K, and 5 to 15 seconds.' }
    ])
  })

  it('links a bare URL and drops the sentence punctuation after it', () => {
    const parts = parseFaqAnswer('See https://docs.comfy.org/tutorials.')
    expect(parts).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'https://docs.comfy.org/tutorials' },
      { type: 'text', value: '.' }
    ])
  })

  it('uses the markdown label as the anchor text', () => {
    const parts = parseFaqAnswer(
      'Read [the launch post](https://blog.comfy.org/p/minimax-h3) for details.'
    )
    expect(parts).toEqual([
      { type: 'text', value: 'Read ' },
      {
        type: 'link',
        value: 'https://blog.comfy.org/p/minimax-h3',
        label: 'the launch post'
      },
      { type: 'text', value: ' for details.' }
    ])
  })

  it('does not double-link the URL inside a markdown link', () => {
    const parts = parseFaqAnswer('[docs](https://docs.comfy.org/tutorials)')
    expect(parts.filter((part) => part.type === 'link')).toHaveLength(1)
  })

  it('handles several links in one answer', () => {
    const parts = parseFaqAnswer(
      'Start in [the docs](https://docs.comfy.org/a), then https://blog.comfy.org/b'
    )
    expect(parts.filter((part) => part.type === 'link')).toEqual([
      { type: 'link', value: 'https://docs.comfy.org/a', label: 'the docs' },
      { type: 'link', value: 'https://blog.comfy.org/b' }
    ])
  })
})

describe('faqAnswerPlainText', () => {
  it('flattens link markup to the anchor text for structured data', () => {
    expect(
      faqAnswerPlainText(
        'Read [the launch post](https://blog.comfy.org/p/minimax-h3) for details.'
      )
    ).toBe('Read the launch post for details.')
  })

  it('leaves a bare URL in place', () => {
    expect(faqAnswerPlainText('See https://docs.comfy.org/a')).toBe(
      'See https://docs.comfy.org/a'
    )
  })
})
