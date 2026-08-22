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

  it('keeps a node queryable while its geometry is invalid', () => {
    const index = new SpatialIndexManager<string>()
    const initial = { x: 0, y: 0, width: 100, height: 100 }
    const moved = { x: 1000, y: 1000, width: 100, height: 100 }

    index.insert('node', initial)
    index.update('node', { ...initial, width: Number.NaN })

    expect(index.query(moved)).toContain('node')

    index.update('node', moved)

    expect(index.query(initial)).not.toContain('node')
    expect(index.query(moved)).toContain('node')
  })

  it('batch updates out-of-range and invalid nodes without dropping them', () => {
    const index = new SpatialIndexManager<string>({
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    const initial = { x: 10, y: 10, width: 20, height: 20 }
    const outside = { x: 50_000, y: 50_000, width: 100, height: 100 }
    index.insert('invalid', initial)

    index.batchUpdate([
      {
        nodeId: 'invalid',
        bounds: { ...initial, x: Number.POSITIVE_INFINITY }
      },
      { nodeId: 'outside', bounds: outside }
    ])

    expect(index.query(outside)).toEqual(
      expect.arrayContaining(['invalid', 'outside'])
    )
    expect(index.size).toBe(2)

    index.clear()
    expect(index.size).toBe(0)
    expect(index.query(outside)).toEqual([])
  })
})
