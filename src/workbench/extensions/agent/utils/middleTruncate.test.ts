import { describe, expect, it } from 'vitest'

import { middleTruncate, middleTruncateWithRanges } from './middleTruncate'

describe('middleTruncate', () => {
  it('returns short text unchanged', () => {
    expect(middleTruncate('Portrait v2', 18)).toBe('Portrait v2')
    expect(middleTruncate('x'.repeat(18), 18)).toBe('x'.repeat(18))
  })

  it('puts the ellipsis in the middle and fits the budget', () => {
    const out = middleTruncate('Portrait upscale final (copy 2)', 18)
    expect(out).toHaveLength(18)
    expect(out.startsWith('Portrait')).toBe(true)
    expect(out.endsWith('(copy 2)')).toBe(true)
    expect(out.indexOf('…')).toBeGreaterThan(0)
    expect(out.indexOf('…')).toBeLessThan(out.length - 1)
  })

  it('keeps more of the tail than the head (versions live in the suffix)', () => {
    const out = middleTruncate('abcdefghijklmnopqrstuvwxyz', 10)
    const [head, tail] = out.split('…')
    expect(tail.length).toBeGreaterThanOrEqual(head.length)
  })

  it.for([
    [0, ''],
    [1, '…'],
    [2, '…f']
  ] as const)('handles a tiny budget of %i', ([max, expected]) => {
    expect(middleTruncate('abcdef', max)).toBe(expected)
  })
})

describe('middleTruncateWithRanges', () => {
  const text = 'abcdefghijklmnopqrstuvwxyz0123456789'

  function shown(range: { start: number; end: number }, max = 12) {
    const out = middleTruncateWithRanges(text, max, [range])
    expect(out.text.length).toBeLessThanOrEqual(max)
    return out
  }

  it('maps ranges into the truncated text', () => {
    const out = shown({ start: 0, end: 3 })
    expect(out.visible).toBe(true)
    expect(out.ranges.map((r) => out.text.slice(r.start, r.end))).toEqual([
      'abc'
    ])
  })

  it.for([
    ['head', { start: 8, end: 10 }, 'ij'],
    ['middle', { start: 15, end: 18 }, 'pqr'],
    ['tail', { start: 30, end: 34 }, '4567']
  ] as const)(
    'shifts the window so a match near the %s stays visible',
    ([, range, expected]) => {
      const out = shown(range)
      expect(out.visible).toBe(true)
      expect(out.ranges).toHaveLength(1)
      expect(out.text.slice(out.ranges[0].start, out.ranges[0].end)).toBe(
        expected
      )
    }
  )

  it('keeps the ellipsis in the middle when the match is in the head or tail', () => {
    const out = shown({ start: 8, end: 10 })
    expect(out.text.startsWith('abcdefghij')).toBe(true)
    expect(out.text.endsWith('9')).toBe(true)
  })

  it('reports not visible when the text is cut inside the match', () => {
    const out = middleTruncateWithRanges(text, 6, [{ start: 10, end: 30 }])
    expect(out.visible).toBe(false)
  })

  it('returns text and ranges unchanged when it already fits', () => {
    const out = middleTruncateWithRanges('short', 18, [{ start: 1, end: 3 }])
    expect(out).toEqual({
      text: 'short',
      ranges: [{ start: 1, end: 3 }],
      visible: true
    })
  })

  it('is visible vacuously with no ranges', () => {
    expect(middleTruncateWithRanges(text, 8, []).visible).toBe(true)
  })
})
