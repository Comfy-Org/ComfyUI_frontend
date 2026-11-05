import { describe, expect, it } from 'vitest'

import { groupKind } from './kinds/group'
import { rasterKind } from './kinds/raster'
import { isDrawable, isGroup } from './node'

describe('node type guards', () => {
  it('isGroup only matches group nodes', () => {
    expect(isGroup(groupKind.create())).toBe(true)
    expect(isGroup(rasterKind.create())).toBe(false)
  })

  it('isDrawable covers scene nodes but not bare paths', () => {
    expect(isDrawable(rasterKind.create())).toBe(true)
    expect(isDrawable(groupKind.create())).toBe(true)
    expect(isDrawable({ ...rasterKind.create(), kind: 'path' })).toBe(false)
  })
})
