import { describe, expect, it } from 'vitest'

import type { CompassCorners } from '@/lib/litegraph/src/interfaces'

import { RESIZE_HANDLES, hasNorthEdge, hasWestEdge } from './resizeHandleConfig'

describe('hasWestEdge', () => {
  it.each<[CompassCorners, boolean]>([
    ['NW', true],
    ['SW', true],
    ['NE', false],
    ['SE', false]
  ])('corner %s -> %s', (corner, expected) => {
    expect(hasWestEdge(corner)).toBe(expected)
  })
})

describe('hasNorthEdge', () => {
  it.each<[CompassCorners, boolean]>([
    ['NW', true],
    ['NE', true],
    ['SW', false],
    ['SE', false]
  ])('corner %s -> %s', (corner, expected) => {
    expect(hasNorthEdge(corner)).toBe(expected)
  })
})

describe('RESIZE_HANDLES', () => {
  it('defines exactly one entry per CompassCorners member', () => {
    const expected = new Set<CompassCorners>(['NE', 'NW', 'SE', 'SW'])
    const actual = new Set(RESIZE_HANDLES.map((handle) => handle.corner))
    expect(actual).toEqual(expected)
    expect(RESIZE_HANDLES).toHaveLength(expected.size)
  })
})
