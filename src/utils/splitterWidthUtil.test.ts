import { describe, expect, it } from 'vitest'

import { savedSidebarPercent } from './splitterWidthUtil'

describe(savedSidebarPercent, () => {
  it.for([
    { state: '[30,70]', location: 'left', expected: 30 },
    { state: '[70,30]', location: 'right', expected: 30 },
    { state: '[25,50,25]', location: 'right', expected: 25 },
    { state: null, location: 'left', expected: null },
    { state: 'not json', location: 'left', expected: null },
    { state: '{"a":1}', location: 'left', expected: null },
    { state: '[]', location: 'left', expected: null },
    { state: '["30",70]', location: 'left', expected: null },
    { state: '[0,100]', location: 'left', expected: null },
    { state: '[100,0]', location: 'left', expected: null }
  ] as const)(
    'reads $state for a $location sidebar as $expected',
    ({ state, location, expected }) => {
      expect(savedSidebarPercent(() => state, ['key'], location)).toBe(expected)
    }
  )

  it('returns the first usable state among the keys', () => {
    const states: Record<string, string> = {
      broken: 'not json',
      'with-offside': '[35,45,20]',
      plain: '[25,75]'
    }

    expect(
      savedSidebarPercent(
        (key) => states[key] ?? null,
        ['missing', 'broken', 'with-offside', 'plain'],
        'left'
      )
    ).toBe(35)
  })

  it('skips a key whose storage read throws', () => {
    const readState = (key: string) => {
      if (key === 'blocked') throw new DOMException('denied', 'SecurityError')
      return '[30,70]'
    }

    expect(savedSidebarPercent(readState, ['blocked', 'plain'], 'left')).toBe(
      30
    )
  })
})
