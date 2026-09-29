import { describe, expect, it } from 'vitest'

import { SIDE_PANEL_SIZE } from '@/constants/splitterConstants'

import { savedSidebarPercent } from './splitterWidthUtil'

describe(savedSidebarPercent, () => {
  it.for([
    { state: '[30,70]', location: 'left', expected: 30 },
    { state: '[70,30]', location: 'right', expected: 30 },
    { state: '[25,50,25]', location: 'right', expected: 25 },
    { state: null, location: 'left', expected: SIDE_PANEL_SIZE },
    { state: 'not json', location: 'left', expected: SIDE_PANEL_SIZE },
    { state: '{"a":1}', location: 'left', expected: SIDE_PANEL_SIZE },
    { state: '[]', location: 'left', expected: SIDE_PANEL_SIZE },
    { state: '["30",70]', location: 'left', expected: SIDE_PANEL_SIZE },
    { state: '[0,100]', location: 'left', expected: SIDE_PANEL_SIZE },
    { state: '[100,0]', location: 'left', expected: SIDE_PANEL_SIZE }
  ] as const)(
    'reads $state for a $location sidebar as $expected',
    ({ state, location, expected }) => {
      expect(savedSidebarPercent(state, location)).toBe(expected)
    }
  )
})
