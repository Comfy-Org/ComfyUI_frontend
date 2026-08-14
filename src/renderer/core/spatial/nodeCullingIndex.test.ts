import { describe, expect, it } from 'vitest'

import type { Bounds, NodeId } from '@/renderer/core/layout/types'
import type { CullingIndexEntry } from '@/renderer/core/spatial/nodeCullingIndex'
import { createNodeCullingIndex } from '@/renderer/core/spatial/nodeCullingIndex'

const id = (value: string) => value as NodeId

function box(x: number, y: number, size = 100): Bounds {
  return { x, y, width: size, height: size }
}

/** Index over a mutable entry list with an explicitly controlled version. */
function setup(entries: CullingIndexEntry[]) {
  const state = { entries, version: 1, builds: 0 }

  const index = createNodeCullingIndex({
    getVersion: () => state.version,
    getEntries: () => {
      state.builds++
      return state.entries
    }
  })

  return { index, state }
}

describe('createNodeCullingIndex', () => {
  it('returns only nodes intersecting the query rect', () => {
    const { index } = setup([
      { id: id('near'), bounds: box(0, 0) },
      { id: id('far'), bounds: box(50_000, 50_000) }
    ])

    expect(index.query(box(-10, -10, 500))).toEqual([id('near')])
  })

  it('indexes nodes far outside the shared quadtree bounds', () => {
    // The shared QUADTREE_CONFIG root is a fixed +/-10000 box and silently
    // drops anything outside it, so the index must size its own root.
    const { index } = setup([
      { id: id('distant'), bounds: box(250_000, -80_000) }
    ])

    expect(index.query(box(249_900, -80_100, 500))).toEqual([id('distant')])
    expect(index.size).toBe(1)
  })

  it('still reports a node whose bounds cannot be indexed', () => {
    // A non-finite coordinate makes the computed root non-finite, so insert
    // fails; the node must fall back to always-reported rather than vanish.
    const { index } = setup([
      { id: id('valid'), bounds: box(0, 0) },
      {
        id: id('broken'),
        bounds: { x: Number.NaN, y: 0, width: 100, height: 100 }
      }
    ])

    expect(index.query(box(-10, -10, 500))).toContain(id('broken'))
  })

  it('always reports nodes that have no bounds yet', () => {
    const { index } = setup([
      { id: id('unmeasured'), bounds: null },
      { id: id('far'), bounds: box(50_000, 50_000) }
    ])

    expect(index.query(box(0, 0, 10))).toEqual([id('unmeasured')])
  })

  it('reuses the tree while the version is unchanged', () => {
    const { index, state } = setup([{ id: id('a'), bounds: box(0, 0) }])

    index.query(box(0, 0, 10))
    index.query(box(0, 0, 10))
    index.query(box(0, 0, 10))

    expect(state.builds).toBe(1)
  })

  it('rebuilds when the version changes', () => {
    const { index, state } = setup([{ id: id('a'), bounds: box(0, 0) }])

    expect(index.query(box(0, 0, 10))).toEqual([id('a')])

    state.entries = [{ id: id('a'), bounds: box(40_000, 40_000) }]
    state.version++

    expect(index.query(box(0, 0, 10))).toEqual([])
    expect(index.query(box(39_950, 39_950, 200))).toEqual([id('a')])
    expect(state.builds).toBe(2)
  })

  it('rebuilds when explicitly invalidated', () => {
    const { index, state } = setup([{ id: id('a'), bounds: box(0, 0) }])

    index.query(box(0, 0, 10))

    // Entry list changed without a version bump.
    state.entries = [
      { id: id('a'), bounds: box(0, 0) },
      { id: id('b'), bounds: box(10, 10) }
    ]
    index.invalidate()

    expect(index.query(box(0, 0, 200)).sort()).toEqual([id('a'), id('b')])
  })

  it('handles an empty graph', () => {
    const { index } = setup([])

    expect(index.query(box(0, 0, 100))).toEqual([])
    expect(index.size).toBe(0)
  })
})
