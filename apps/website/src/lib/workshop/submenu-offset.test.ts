import { describe, expect, it } from 'vitest'

import { submenuOffset } from './submenu-offset'

describe('submenuOffset', () => {
  it.for([
    ['a button at the right edge of a wide menu', 260, 12, 272],
    ['a trigger that fills the menu', 0, 12, 12],
    ['a menu that has moved with the viewport', 100, 8, 108]
  ] as const)('clears the panel for %s', ([, inset, gap, expected]) => {
    expect(submenuOffset({ left: inset }, { left: 0 }, gap)).toBe(expected)
  })

  // Measured before the menu is in the DOM, or outside one entirely: the gap
  // alone is what the submenu had before any of this.
  it('falls back to the plain gap with no panel to measure', () => {
    expect(submenuOffset({ left: 260 }, undefined, 12)).toBe(12)
  })
})
