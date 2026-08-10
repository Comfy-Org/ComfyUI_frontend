import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, reactive, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import {
  getCullingBounds,
  useViewportCulling
} from '@/composables/graph/useViewportCulling'
import type { Bounds, NodeId } from '@/renderer/core/layout/types'
import { boundsIntersect } from '@/renderer/core/layout/utils/layoutMath'

const camera = reactive({ x: 0, y: 0, z: 1 })

vi.mock('@/renderer/core/layout/transform/useTransformState', () => ({
  useTransformState: () => ({ camera })
}))

function nodeData(id: string): VueNodeData {
  return {
    id: id as NodeId,
    title: id,
    type: 'test',
    mode: 0,
    selected: false,
    executing: false
  }
}

const VIEWPORT = { width: 1000, height: 1000 }

/** Runs the culling composable inside a scope and exposes its reactive result. */
function setup(
  bounds: Record<string, Bounds | null>,
  pinned: Set<string> = new Set()
) {
  const nodes = ref(Object.keys(bounds).map(nodeData))
  const scope = effectScope()

  // Plain scan stands in for the spatial index; the index has its own tests.
  const queryNodesInBounds = (rect: Bounds) =>
    nodes.value
      .map((node) => node.id)
      .filter((id) => {
        const nodeBounds = bounds[id]
        return !nodeBounds || boundsIntersect(nodeBounds, rect)
      })

  const mountedNodeIds = scope.run(
    () =>
      useViewportCulling({
        nodes: computed(() => nodes.value),
        queryNodesInBounds,
        getViewportSize: () => VIEWPORT,
        isPinned: (id) => pinned.has(id)
      }).mountedNodeIds
  )!

  return { nodes, mountedNodeIds, scope }
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(camera, { x: 0, y: 0, z: 1 })
})

describe('getCullingBounds', () => {
  it('expands the viewport by the margin ratio in graph space', () => {
    expect(getCullingBounds({ x: 0, y: 0, z: 1 }, VIEWPORT, 0.5)).toEqual({
      x: -500,
      y: -500,
      width: 2000,
      height: 2000
    })
  })

  it('caps the margin in graph units when zoomed out', () => {
    // At z=0.05 the ratio alone would add 10000 units of margin per edge.
    const bounds = getCullingBounds({ x: 0, y: 0, z: 0.05 }, VIEWPORT, 0.5)

    expect(bounds.x).toBe(-2000)
    expect(bounds.width).toBe(VIEWPORT.width / 0.05 + 4000)
  })

  it('accounts for pan offset and zoom', () => {
    // At z=2 the viewport covers half as much graph space.
    expect(getCullingBounds({ x: -100, y: -50, z: 2 }, VIEWPORT, 0)).toEqual({
      x: 100,
      y: 50,
      width: 500,
      height: 500
    })
  })
})

describe('useViewportCulling', () => {
  it('mounts only nodes intersecting the expanded viewport', () => {
    const { mountedNodeIds } = setup({
      onscreen: { x: 0, y: 0, width: 100, height: 100 },
      // Inside the 0.5 margin band, so still mounted.
      margin: { x: 1200, y: 0, width: 100, height: 100 },
      offscreen: { x: 50_000, y: 0, width: 100, height: 100 }
    })

    expect(mountedNodeIds.value).toEqual(
      new Set(['onscreen', 'margin'] as NodeId[])
    )
  })

  it('keeps pinned nodes mounted even when far off screen', () => {
    const { mountedNodeIds } = setup(
      { dragged: { x: 50_000, y: 0, width: 100, height: 100 } },
      new Set(['dragged'])
    )

    expect(mountedNodeIds.value.has('dragged' as NodeId)).toBe(true)
  })

  it('mounts nodes that have no layout yet so they can measure themselves', () => {
    const { mountedNodeIds } = setup({ unmeasured: null })

    expect(mountedNodeIds.value.has('unmeasured' as NodeId)).toBe(true)
  })

  it('mounts entering nodes immediately but delays unmounting departing ones', async () => {
    const { mountedNodeIds } = setup({
      left: { x: -3000, y: 0, width: 100, height: 100 },
      right: { x: 1000, y: 0, width: 100, height: 100 }
    })

    expect(mountedNodeIds.value).toEqual(new Set(['right'] as NodeId[]))

    // Pan left so `left` enters and `right` leaves.
    camera.x = 3000
    await nextTick()

    // Entering node is mounted right away; departing node lingers.
    expect(mountedNodeIds.value).toEqual(new Set(['left', 'right'] as NodeId[]))

    await vi.advanceTimersByTimeAsync(300)
    expect(mountedNodeIds.value).toEqual(new Set(['left'] as NodeId[]))
  })

  it('does not accumulate nodes during a long continuous pan', async () => {
    // A row of nodes the viewport sweeps across without ever pausing.
    const NODE_COUNT = 60
    const bounds = Object.fromEntries(
      Array.from({ length: NODE_COUNT }, (_, i) => [
        `n${i}`,
        { x: i * 4000, y: 0, width: 100, height: 100 }
      ])
    )
    const { mountedNodeIds } = setup(bounds)

    for (let step = 0; step < NODE_COUNT; step++) {
      camera.x = -step * 4000
      await nextTick()
      // Stay under the unmount delay so the debounced prune never runs.
      await vi.advanceTimersByTimeAsync(120)
    }

    // Without eager pruning the mounted set would cover every node the
    // viewport swept over.
    expect(mountedNodeIds.value.size).toBeLessThan(NODE_COUNT / 3)
  })

  it('drops nodes removed from the graph', async () => {
    const { nodes, mountedNodeIds } = setup({
      a: { x: 0, y: 0, width: 100, height: 100 },
      b: { x: 0, y: 0, width: 100, height: 100 }
    })

    expect(mountedNodeIds.value.size).toBe(2)

    nodes.value = [nodeData('a')]
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(mountedNodeIds.value).toEqual(new Set(['a'] as NodeId[]))
  })
})
