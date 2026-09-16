import { describe, expect, it } from 'vitest'

import { dropPositionFor, reorderDropIndex } from './layerPanelDnd'

describe('dropPositionFor', () => {
  it('splits the row at the midpoint', () => {
    expect(dropPositionFor(0.2)).toBe('above')
    expect(dropPositionFor(0.8)).toBe('below')
    expect(dropPositionFor(0.5)).toBe('below')
  })
})

describe('reorderDropIndex', () => {
  const ids = ['a', 'b', 'c']

  it('above a layer lands directly over it in z-order', () => {
    expect(reorderDropIndex(ids, 'b', 'above', 0)).toBe(2)
  })

  it('below a layer lands directly under it', () => {
    expect(reorderDropIndex(ids, 'b', 'below', 0)).toBe(1)
  })

  it('offsets past a background layer', () => {
    expect(reorderDropIndex(ids, 'a', 'below', 1)).toBe(1)
    expect(reorderDropIndex(ids, 'c', 'above', 1)).toBe(4)
  })

  it('returns null for an unknown target', () => {
    expect(reorderDropIndex(ids, 'x', 'above', 0)).toBeNull()
  })
})
