import { describe, expect, it } from 'vitest'

import { SpatialIndexManager } from '@/renderer/core/spatial/SpatialIndex'

describe('SpatialIndexManager', () => {
  it('returns entries that lie outside the initial index bounds', () => {
    const index = new SpatialIndexManager<string>({
      x: -10_000,
      y: -10_000,
      width: 20_000,
      height: 20_000
    })
    const bounds = { x: 50_000, y: 50_000, width: 200, height: 100 }

    index.insert('outside', bounds)

    expect(index.query(bounds)).toContain('outside')
  })
})
