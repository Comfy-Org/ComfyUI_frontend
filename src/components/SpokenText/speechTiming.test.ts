import { describe, expect, it } from 'vitest'

import {
  WORD_STAGGER_MS,
  speechTiming,
  splitWords,
  talkTokens,
  wordRevealStaggerMs
} from './speechTiming'

describe('splitWords', () => {
  it.for([
    { text: 'Hello Jo,', words: ['Hello', 'Jo,'] },
    { text: '  spaced   out \n text ', words: ['spaced', 'out', 'text'] },
    { text: '', words: [] }
  ])('splits "$text" into words', ({ text, words }) => {
    expect(splitWords(text)).toEqual(words)
  })
})

describe('talkTokens', () => {
  it('preserves whitespace and newlines between staggered words', () => {
    expect(talkTokens('keep\n\nthis  spacing', 0, 35)).toEqual([
      { text: 'keep', delayMs: 0 },
      { text: '\n\n' },
      { text: 'this', delayMs: 35 },
      { text: '  ' },
      { text: 'spacing', delayMs: 70 }
    ])
  })
})

describe('wordRevealStaggerMs', () => {
  it.for([
    { wordCount: 1, expected: WORD_STAGGER_MS },
    { wordCount: 25, expected: WORD_STAGGER_MS },
    { wordCount: 36, expected: 25 }
  ])('staggers $wordCount words by $expected ms', ({ wordCount, expected }) => {
    expect(wordRevealStaggerMs(wordCount)).toBe(expected)
  })
})

describe('speechTiming', () => {
  it('starts each part after the previous words and its pause', () => {
    expect(
      speechTiming([
        { text: 'Hello Jo,' },
        { text: 'Ask a question.', pauseBeforeMs: 250 },
        { text: 'Shows you first.', pauseBeforeMs: 150 }
      ])
    ).toEqual({
      starts: [0, 2 * WORD_STAGGER_MS + 250, 5 * WORD_STAGGER_MS + 400],
      next: 8 * WORD_STAGGER_MS + 400
    })
  })

  it('takes longer to say more words', () => {
    const short = speechTiming([{ text: 'Short.' }])
    const long = speechTiming([{ text: 'A much longer sentence to say.' }])

    expect(long.next).toBeGreaterThan(short.next)
  })

  it('starts at zero with nothing to say', () => {
    expect(speechTiming([])).toEqual({ starts: [], next: 0 })
  })
})
