import { describe, expect, it } from 'vitest'

import type { Bounds, NodeId } from '@/renderer/core/layout/types'
import { SpatialIndexManager } from '@/renderer/core/spatial/SpatialIndex'

const id = (value: string) => value as NodeId

function box(x: number, y: number, size = 100): Bounds {
  return { x, y, width: size, height: size }
}

describe('SpatialIndexManager', () => {
  it('indexes entries outside the initial root bounds', () => {
    const index = new SpatialIndexManager<NodeId>()
    const distant = id('distant')

    index.insert(distant, box(250_000, -80_000))

    expect(index.query(box(249_900, -80_100, 500))).toEqual([distant])
    expect(index.size).toBe(1)
  })

  it('keeps an entry indexed when an update crosses the root boundary', () => {
    const index = new SpatialIndexManager<NodeId>()
    const moving = id('moving')

    index.insert(moving, box(0, 0))
    index.update(moving, box(40_000, 40_000))

    expect(index.query(box(0, 0, 500))).toEqual([])
    expect(index.query(box(39_900, 39_900, 500))).toEqual([moving])
  })

  it('reports unindexable entries conservatively', () => {
    const index = new SpatialIndexManager<NodeId>()
    const broken = id('broken')

    index.insert(broken, {
      x: Number.NaN,
      y: 0,
      width: 100,
      height: 100
    })

    expect(index.query(box(50_000, 50_000))).toContain(broken)
    expect(index.size).toBe(1)
  })

  it('retains every update when a batch expands the root', () => {
    const index = new SpatialIndexManager<NodeId>()
    const left = id('left')
    const right = id('right')

    index.insert(left, box(0, 0))
    index.insert(right, box(100, 100))
    index.batchUpdate([
      { nodeId: left, bounds: box(-50_000, 0) },
      { nodeId: right, bounds: box(50_000, 0) }
    ])

    expect(index.query(box(-50_100, -100, 500))).toEqual([left])
    expect(index.query(box(49_900, -100, 500))).toEqual([right])
    expect(index.size).toBe(2)
  })
})
