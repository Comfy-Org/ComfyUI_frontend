import { describe, expect, it } from 'vitest'

import type { CompassCorners } from '@comfyorg/shared-frontend-utils/geometry'

import { RESIZE_HANDLES } from './resizeHandleConfig'

describe('RESIZE_HANDLES', () => {
  it('defines exactly one entry per CompassCorners member', () => {
    const expected = new Set<CompassCorners>(['NE', 'NW', 'SE', 'SW'])
    const actual = new Set(RESIZE_HANDLES.map((handle) => handle.corner))
    expect(actual).toEqual(expected)
    expect(RESIZE_HANDLES).toHaveLength(expected.size)
  })
})
