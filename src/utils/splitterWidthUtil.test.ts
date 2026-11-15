import { describe, expect, it } from 'vitest'

import { savedPanelPercent } from './splitterWidthUtil'

describe(savedPanelPercent, () => {
  it.for([
    { state: '[30,70]', edge: 'first', expected: 30 },
    { state: '[70,30]', edge: 'last', expected: 30 },
    { state: '[25,50,25]', edge: 'last', expected: 25 },
    { state: '[30,90]', edge: 'first', expected: 25 },
    { state: null, edge: 'first', expected: null },
    { state: 'not json', edge: 'first', expected: null },
    { state: '{"a":1}', edge: 'first', expected: null },
    { state: '[]', edge: 'first', expected: null },
    { state: '["30",70]', edge: 'first', expected: null },
    { state: '[0,100]', edge: 'first', expected: null },
    { state: '[100,0]', edge: 'first', expected: null }
  ] as const)(
    'reads $state for the $edge panel as $expected',
    ({ state, edge, expected }) => {
      expect(savedPanelPercent(() => state, ['key'], edge)).toBe(expected)
    }
  )

  it('returns the first usable state among the keys', () => {
    const states: Record<string, string> = {
      broken: 'not json',
      'with-offside': '[35,45,20]',
      plain: '[25,75]'
    }

    expect(
      savedPanelPercent(
        (key) => states[key] ?? null,
        ['missing', 'broken', 'with-offside', 'plain'],
        'first'
      )
    ).toBe(35)
  })

  it('skips a key whose storage read throws', () => {
    const readState = (key: string) => {
      if (key === 'blocked') throw new DOMException('denied', 'SecurityError')
      return '[30,70]'
    }

    expect(savedPanelPercent(readState, ['blocked', 'plain'], 'first')).toBe(30)
  })
})
