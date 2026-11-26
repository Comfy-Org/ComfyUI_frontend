import { describe, expect, it } from 'vitest'

import { fence, truncate, truncateHeadAndTail } from './reportTextUtil'

function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    const isHighSurrogate = code >= 0xd800 && code <= 0xdbff
    const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff
    if (isHighSurrogate) {
      const next = text.charCodeAt(i + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true
    } else if (isLowSurrogate) {
      const prev = text.charCodeAt(i - 1)
      if (!(prev >= 0xd800 && prev <= 0xdbff)) return true
    }
  }
  return false
}

describe('fence', () => {
  it('picks the minimum 3-backtick delimiter when the body has no backticks', () => {
    const result = fence('json', '{"a":1}')

    expect(result.startsWith('```json\n')).toBe(true)
    expect(result.endsWith('\n```')).toBe(true)
  })

  it('picks a 4+ backtick delimiter when the body contains a run of 3 backticks', () => {
    const body = 'before\n```\nembedded fence\n```\nafter'
    const result = fence('text', body)

    const lines = result.split('\n')
    const openingDelimiter = lines[0].replace('text', '')
    const closingDelimiter = lines[lines.length - 1]

    expect(openingDelimiter.length).toBeGreaterThanOrEqual(4)
    expect(openingDelimiter).toBe(closingDelimiter)
    // The fence must not be closeable by the embedded run of backticks.
    expect(openingDelimiter.length).toBeGreaterThan(3)
  })

  it('scales the delimiter beyond the longest embedded run', () => {
    const body = 'oops `````` five backticks is actually six here'
    const result = fence('text', body)
    const openingDelimiter = result.split('\n')[0].replace('text', '')

    // Longest run in body is 6 backticks, so delimiter must be at least 7.
    expect(openingDelimiter.length).toBeGreaterThanOrEqual(7)
  })
})

describe('truncate', () => {
  it('returns text unchanged when under the max length', () => {
    expect(truncate('short', 100)).toBe('short')
  })

  it('keeps the tail and trims the head when over the max length', () => {
    const text = 'a'.repeat(50) + 'TAIL'
    const result = truncate(text, 10)

    expect(result).toContain('TAIL')
    expect(result).toContain('earlier characters trimmed')
  })

  it('never splits a surrogate pair at the cut boundary', () => {
    // Emoji (surrogate pair) placed so a naive slice at a fixed offset
    // would land inside the pair.
    const emoji = '😀' // U+1F600, encoded as a surrogate pair in UTF-16
    const text = 'x'.repeat(9) + emoji + 'y'.repeat(20)

    // Choose max so the naive cut point (text.length - max) lands on the
    // low surrogate of the emoji (index 10).
    const max = text.length - 10
    const result = truncate(text, max)

    expect(hasLoneSurrogate(result)).toBe(false)
  })
})

describe('truncateHeadAndTail', () => {
  it('returns text unchanged when under the max length', () => {
    expect(truncateHeadAndTail('short', 100)).toBe('short')
  })

  it('keeps head and tail with a marker in the middle when over the max length', () => {
    const text = 'HEAD'.repeat(100) + 'MIDDLE'.repeat(1000) + 'TAIL'.repeat(100)
    const result = truncateHeadAndTail(text, 500)

    expect(result).toContain('[report truncated to 500 characters]')
    expect(result.startsWith('HEAD')).toBe(true)
    expect(result.endsWith('TAIL')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(500)
  })

  it('never splits a surrogate pair at either cut boundary', () => {
    const emoji = '😀'
    // Build a long string where emojis sit right around both the head and
    // tail cut points for a small maxLength.
    const filler = 'z'.repeat(2000)
    const text = filler + emoji + filler + emoji + filler

    const result = truncateHeadAndTail(text, 400)

    expect(hasLoneSurrogate(result)).toBe(false)
  })
})
