import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, reactive, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import {
  MOUNT_BATCH_PER_FRAME,
  getCullingBounds,
  useViewportCulling
} from '@/renderer/extensions/vueNodes/composables/useViewportCulling'
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

const activeScopes: ReturnType<typeof effectScope>[] = []

/** Runs the culling composable inside a scope and exposes its reactive result. */
function setup(
  bounds: Record<string, Bounds | null>,
  pinned: Set<NodeId> = new Set()
) {
  const nodes = ref(Object.keys(bounds).map(nodeData))
  const scope = effectScope()
  activeScopes.push(scope)

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
        minNodesForCulling: 0,
        getPinnedIds: () => pinned
      }).mountedNodeIds
  )!

  return { nodes, mountedNodeIds, scope }
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(camera, { x: 0, y: 0, z: 1 })
})

afterEach(() => {
  // Scopes hold watchers on the module-level shared camera; fake timers have
  // no automatic restore.
  for (const scope of activeScopes.splice(0)) scope.stop()
  vi.useRealTimers()
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

  it('retains a mounted pinned node when it leaves the viewport', async () => {
    const pinned = new Set<NodeId>()
    const { mountedNodeIds } = setup(
      { dragged: { x: 100, y: 0, width: 100, height: 100 } },
      pinned
    )
    expect(mountedNodeIds.value.has('dragged' as NodeId)).toBe(true)

    // Pin (select) it, then pan far away: it must survive the prune.
    pinned.add('dragged' as NodeId)
    camera.x = 50_000
    await nextTick()
    await vi.advanceTimersByTimeAsync(600)

    expect(mountedNodeIds.value.has('dragged' as NodeId)).toBe(true)
  })

  it('does not mount unmounted nodes just because they are pinned', async () => {
    // Select-all pins every node; admission on pin would mount the graph.
    const pinned = new Set<NodeId>(['far' as NodeId])
    const { mountedNodeIds } = setup(
      {
        near: { x: 0, y: 0, width: 100, height: 100 },
        far: { x: 50_000, y: 0, width: 100, height: 100 }
      },
      pinned
    )

    await vi.advanceTimersByTimeAsync(600)
    expect(mountedNodeIds.value.has('far' as NodeId)).toBe(false)
  })

  it('holds the current set while the viewport is unmeasurable', async () => {
    // Canvas absent or display:none must not default open and mount the graph.
    const nodes = ref([nodeData('a'), nodeData('b')])
    const scope = effectScope()
    activeScopes.push(scope)
    const mountedNodeIds = scope.run(
      () =>
        useViewportCulling({
          nodes: computed(() => nodes.value),
          queryNodesInBounds: () => ['a' as NodeId],
          getViewportSize: () => ({ width: 0, height: 0 }),
          minNodesForCulling: 0
        }).mountedNodeIds
    )!

    await vi.advanceTimersByTimeAsync(600)
    expect(mountedNodeIds.value.size).toBe(0)
  })

  /** 600 nodes parked outside the initial viewport, brought in by panning. */
  function offscreenGrid(count = 600) {
    return Object.fromEntries(
      Array.from({ length: count }, (_, i) => [
        `n${i}`,
        {
          x: 10_000 + (i % 30) * 40,
          y: Math.floor(i / 30) * 40,
          width: 30,
          height: 30
        }
      ])
    )
  }

  it('paces a camera-driven fill-in across frames', async () => {
    // Panning into a dense region is the case staging exists for: the nodes
    // were always there, and arriving over a few frames is imperceptible.
    const bounds = offscreenGrid()
    const { mountedNodeIds } = setup(bounds)
    expect(mountedNodeIds.value.size).toBe(0)

    camera.x = -10_000
    await nextTick()
    expect(mountedNodeIds.value.size).toBe(MOUNT_BATCH_PER_FRAME)

    await vi.advanceTimersByTimeAsync(3000)
    expect(mountedNodeIds.value.size).toBe(600)
  })

  it('mounts nodes newly added to the graph without pacing', async () => {
    // A paste is a direct user action awaiting feedback, and the set is
    // already bounded by the viewport. Pacing it is what makes a large paste
    // look like it is rendering one node at a time.
    const bounds = Object.fromEntries(
      Array.from({ length: 300 }, (_, i) => [
        `n${i}`,
        { x: (i % 20) * 40, y: Math.floor(i / 20) * 40, width: 30, height: 30 }
      ])
    )
    const { mountedNodeIds } = setup(bounds)

    expect(mountedNodeIds.value.size).toBe(300)
  })

  it('mounts every node when the graph is below the culling threshold', async () => {
    // Ordinary workflows keep today's behaviour and take none of culling's
    // interaction risk; culling only engages where it is actually needed.
    const nodes = ref([nodeData('a'), nodeData('b')])
    const scope = effectScope()
    activeScopes.push(scope)
    const mountedNodeIds = scope.run(
      () =>
        useViewportCulling({
          nodes: computed(() => nodes.value),
          // Would cull everything if the threshold did not short-circuit it.
          queryNodesInBounds: () => [],
          getViewportSize: () => VIEWPORT,
          minNodesForCulling: 10
        }).mountedNodeIds
    )!

    await vi.advanceTimersByTimeAsync(600)
    expect(mountedNodeIds.value).toEqual(new Set(['a', 'b'] as NodeId[]))
  })

  it('mounts nodes that have no layout yet so they can measure themselves', () => {
    const { mountedNodeIds } = setup({ unmeasured: null })

    expect(mountedNodeIds.value.has('unmeasured' as NodeId)).toBe(true)
  })

  it('holds every node mounted while culling is disabled', async () => {
    // The mounted set stays authoritative when the switch is off, rather than
    // converging to empty. A caller filtering rendered nodes against it would
    // otherwise blank the canvas the moment the switch is turned back on.
    const enabled = ref(false)
    const nodes = ref([nodeData('a'), nodeData('b')])
    const scope = effectScope()
    activeScopes.push(scope)
    const mountedNodeIds = scope.run(
      () =>
        useViewportCulling({
          nodes: computed(() => nodes.value),
          // Culls everything, so an active gate would leave the set empty.
          queryNodesInBounds: () => [],
          getViewportSize: () => VIEWPORT,
          minNodesForCulling: 0,
          isEnabled: () => enabled.value
        }).mountedNodeIds
    )!

    await vi.advanceTimersByTimeAsync(600)
    expect(mountedNodeIds.value).toEqual(new Set(['a', 'b'] as NodeId[]))

    enabled.value = true
    await vi.advanceTimersByTimeAsync(600)
    expect(mountedNodeIds.value.size).toBe(0)
  })

  it('keeps culling on when a node is deleted at the threshold', async () => {
    // The gate swaps the whole mounted set rather than its edge, so flipping
    // off at the boundary mounts everything that was culled in one frame -
    // and undo/redo across the boundary repeats it.
    const nodes = ref(Array.from({ length: 10 }, (_, i) => nodeData(`n${i}`)))
    const scope = effectScope()
    activeScopes.push(scope)
    const mountedNodeIds = scope.run(
      () =>
        useViewportCulling({
          nodes: computed(() => nodes.value),
          // Culls everything, so an active gate leaves the set empty and an
          // inactive one mounts all of them.
          queryNodesInBounds: () => [],
          getViewportSize: () => VIEWPORT,
          minNodesForCulling: 10
        }).mountedNodeIds
    )!

    await vi.advanceTimersByTimeAsync(600)
    expect(mountedNodeIds.value.size).toBe(0)

    nodes.value = nodes.value.slice(0, 9)
    await vi.advanceTimersByTimeAsync(600)

    expect(mountedNodeIds.value.size).toBe(0)
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

  it('does not keep mounting nodes the camera has already left behind', async () => {
    // A pan re-refreshes while the previous fill-in is still draining. The
    // queued ids were computed for the old position, so they must be replaced
    // rather than continuing to arrive alongside the new ones.
    const COUNT = 600
    const bounds = Object.fromEntries(
      Array.from({ length: COUNT }, (_, i) => [
        `n${i}`,
        { x: (i % 30) * 40, y: Math.floor(i / 30) * 40, width: 30, height: 30 }
      ])
    )
    const { mountedNodeIds } = setup(bounds)

    // Pan far away, past the margin, before the queue can drain.
    camera.x = -60_000
    await nextTick()
    await vi.advanceTimersByTimeAsync(150)
    const afterPan = mountedNodeIds.value.size

    // Nothing is in range now, so the stale queue must not keep filling in.
    await vi.advanceTimersByTimeAsync(2000)
    expect(mountedNodeIds.value.size).toBeLessThanOrEqual(afterPan)
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
