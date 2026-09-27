import { describe, expect, it } from 'vitest'

import { submenuOffset } from './submenu-offset'

describe('submenuOffset', () => {
  it.for([
    ['a button at the right edge of a wide menu', 260, 0, 12, 272],
    ['a trigger that fills the menu', 0, 0, 12, 12],
    ['a narrower gap', 100, 0, 8, 108],
    // The panel is only at zero when the menu is against the left edge, and
    // the offset is the distance between the two, not the trigger's own.
    ['a menu that has moved with the viewport', 360, 100, 12, 272]
  ] as const)(
    'clears the panel for %s',
    ([, trigger, panel, gap, expected]) => {
      expect(submenuOffset({ left: trigger }, { left: panel }, gap)).toBe(
        expected
      )
    }
  )

  // Measured before the menu is in the DOM, or outside one entirely: the gap
  // alone is what the submenu had before any of this.
  it('falls back to the plain gap with no panel to measure', () => {
    expect(submenuOffset({ left: 260 }, undefined, 12)).toBe(12)
  })
})
