import { describe, expect, it } from 'vitest'

import { getDragItemKey, getEdgeTriZone } from './useGroupDrop'

function mockElement(top: number, height: number): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      top,
      height,
      bottom: top + height,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: top,
      toJSON: () => ({})
    })
  } as unknown as HTMLElement
}

describe('getEdgeTriZone', () => {
  it('returns "before" for top third', () => {
    expect(getEdgeTriZone(mockElement(100, 90), 110)).toBe('before')
  })

  it('returns "center" for middle third', () => {
    expect(getEdgeTriZone(mockElement(100, 90), 145)).toBe('center')
  })

  it('returns "after" for bottom third', () => {
    expect(getEdgeTriZone(mockElement(100, 90), 180)).toBe('after')
  })

  it('returns "before" at exact top boundary', () => {
    expect(getEdgeTriZone(mockElement(100, 90), 100)).toBe('before')
  })

  it('returns "after" at exact bottom boundary', () => {
    expect(getEdgeTriZone(mockElement(100, 90), 190)).toBe('after')
  })
})

describe('getDragItemKey', () => {
  it('returns itemKey for group-item type', () => {
    expect(
      getDragItemKey({ type: 'group-item', itemKey: 'input:1:steps' })
    ).toBe('input:1:steps')
  })

  it('returns null for non-group-item type', () => {
    expect(
      getDragItemKey({ type: 'other', itemKey: 'input:1:steps' })
    ).toBeNull()
  })

  it('returns null when itemKey is not a string', () => {
    expect(getDragItemKey({ type: 'group-item', itemKey: 123 })).toBeNull()
  })

  it('returns null for empty data', () => {
    expect(getDragItemKey({})).toBeNull()
  })
})
