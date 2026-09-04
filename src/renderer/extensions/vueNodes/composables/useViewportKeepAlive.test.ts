import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, reactive, ref } from 'vue'

import type { Bounds, NodeId } from '@/renderer/core/layout/types'
import {
  getKeepAliveBounds,
  useViewportKeepAlive
} from '@/renderer/extensions/vueNodes/composables/useViewportKeepAlive'
import { registerNodeTypeCullingOptOut } from '@/services/vueNodeCullingService'
import { toNodeId } from '@/types/nodeId'

const camera = reactive({ x: 0, y: 0, z: 1 })

vi.mock('@/renderer/core/layout/transform/useTransformState', () => ({
  useTransformState: () => ({ camera })
}))

const activeScopes: ReturnType<typeof effectScope>[] = []

function nodeData(id: string, type = 'test') {
  return {
    id: toNodeId(id),
    type
  }
}

function setup(bounds: Record<string, Bounds | null>) {
  const nodes = ref(Object.keys(bounds).map((id) => nodeData(id)))
  const pinned = ref<ReadonlySet<NodeId>>(new Set())
  const geometryVersion = ref(0)
  const scope = effectScope()
  activeScopes.push(scope)

  const activeNodeIds = scope.run(
    () =>
      useViewportKeepAlive({
        nodeIds: computed(() => nodes.value.map((node) => node.id)),
        getNodeType: (nodeId) =>
          nodes.value.find((node) => node.id === nodeId)?.type,
        pinnedNodeIds: computed(() => pinned.value),
        getNodeBounds: (nodeId) => bounds[nodeId],
        getViewportSize: () => ({ width: 1000, height: 1000 }),
        getGeometryVersion: () => geometryVersion.value
      }).activeNodeIds
  )!

  return { activeNodeIds, geometryVersion, nodes, pinned }
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(camera, { x: 0, y: 0, z: 1 })
})

afterEach(() => {
  for (const scope of activeScopes.splice(0)) scope.stop()
})

describe('getKeepAliveBounds', () => {
  it('uses a capped graph-space buffer around the viewport', () => {
    expect(
      getKeepAliveBounds(camera, { width: 1000, height: 1000 })
    ).toMatchObject({ x: -500, y: -500, width: 2000 })

    expect(
      getKeepAliveBounds({ x: 0, y: 0, z: 0.05 }, { width: 1000, height: 1000 })
    ).toMatchObject({ x: -2000, width: 24_000 })
  })
})

describe('useViewportKeepAlive', () => {
  it('keeps every node active below the large-graph threshold', () => {
    const { activeNodeIds } = setup({
      near: { x: 0, y: 0, width: 100, height: 100 },
      far: { x: 50_000, y: 0, width: 100, height: 100 }
    })

    expect(activeNodeIds.value).toEqual(new Set(['near', 'far']))
  })

  it('keeps only buffered, unknown, and invalid nodes active in large graphs', () => {
    const bounds = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [
        `node-${index}`,
        { x: 50_000, y: 0, width: 100, height: 100 }
      ])
    ) as Record<string, Bounds | null>
    bounds['node-0'] = { x: 0, y: 0, width: 100, height: 100 }
    bounds['node-1'] = null
    bounds['node-2'] = { x: Number.NaN, y: 0, width: 100, height: 100 }

    const { activeNodeIds } = setup(bounds)

    expect(activeNodeIds.value).toEqual(new Set(['node-0', 'node-1', 'node-2']))
  })

  it('retains active pins without admitting offscreen pins', async () => {
    const bounds = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [
        `node-${index}`,
        {
          x: index === 0 ? 0 : 50_000,
          y: 0,
          width: 100,
          height: 100
        }
      ])
    )
    const { activeNodeIds, pinned } = setup(bounds)
    pinned.value = new Set([toNodeId('node-0'), toNodeId('node-1')])
    camera.x = 50_000

    await vi.advanceTimersByTimeAsync(150)

    expect(activeNodeIds.value).toEqual(new Set(['node-0']))
  })

  it('does not accumulate swept-over nodes under a graph-sized pin', async () => {
    // Retention re-adds a node only while it is pinned AND already attached.
    // The set is rebuilt from the viewport each refresh, so a node that left
    // the viewport is retained for exactly as long as its pin holds and no
    // longer. This is the property that lets pins be graph-sized without
    // silently disabling the feature; the pin composable additionally keeps
    // every pin bounded (no selection pin) so this path is never graph-sized
    // in practice.
    const COUNT = 150
    const bounds = Object.fromEntries(
      Array.from({ length: COUNT }, (_, index) => [
        `node-${index}`,
        { x: index * 400, y: 0, width: 100, height: 100 }
      ])
    )
    const { activeNodeIds, pinned } = setup(bounds)
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value.size).toBeLessThan(COUNT / 4)

    // Pin everything that is currently attached, then sweep the camera across
    // the whole graph with the pin held.
    pinned.value = new Set(Object.keys(bounds).map(toNodeId))
    for (let x = 0; x <= COUNT * 400; x += 2000) {
      camera.x = -x
      await vi.advanceTimersByTimeAsync(150)
    }

    // Retention chains: every node the viewport touched was attached while
    // pinned, so it stays. That is the documented cost of a graph-sized pin -
    // which is exactly why selection is not one. Assert the shape rather than
    // pretend otherwise, and pin the release below.
    expect(activeNodeIds.value.size).toBe(COUNT)

    // Clear the pin: the set must collapse back to the viewport.
    pinned.value = new Set()
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value.size).toBeLessThan(COUNT / 4)
  })

  it('releases a retained node once its pin clears', async () => {
    const bounds = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [
        `node-${index}`,
        { x: index * 400, y: 0, width: 100, height: 100 }
      ])
    )
    const { activeNodeIds, pinned } = setup(bounds)
    await vi.advanceTimersByTimeAsync(150)

    pinned.value = new Set(Object.keys(bounds).map(toNodeId))
    camera.x = -40_000
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value.has(toNodeId('node-0'))).toBe(true)

    pinned.value = new Set()
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value.has(toNodeId('node-0'))).toBe(false)
  })

  it('keeps a registered node type attached wherever it is', async () => {
    // Admission, unlike the pins: an extension registers a type whose widgets
    // hold state that detaching destroys - a canvas context, an uncontrolled
    // editor - and every node of that type stays attached regardless of the
    // viewport. Bounded by the registrant, so safe to admit.
    const bounds = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [
        `node-${index}`,
        { x: index === 0 ? 0 : 50_000, y: 0, width: 100, height: 100 }
      ])
    )
    const nodes = ref(
      Object.keys(bounds).map((id, index) =>
        nodeData(id, index === 1 ? 'canvas-widget' : 'test')
      )
    )
    const pinned = ref<ReadonlySet<NodeId>>(new Set())
    const scope = effectScope()
    activeScopes.push(scope)
    const activeNodeIds = scope.run(
      () =>
        useViewportKeepAlive({
          nodeIds: computed(() => nodes.value.map((node) => node.id)),
          getNodeType: (nodeId) =>
            nodes.value.find((node) => node.id === nodeId)?.type,
          pinnedNodeIds: computed(() => pinned.value),
          getNodeBounds: (nodeId) => bounds[nodeId],
          getViewportSize: () => ({ width: 1000, height: 1000 }),
          getGeometryVersion: () => 0
        }).activeNodeIds
    )!

    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value.has(toNodeId('node-1'))).toBe(false)

    // Registration alone must attach it - an extension registers at load and
    // cannot rely on the user panning afterwards.
    const release = registerNodeTypeCullingOptOut('canvas-widget')
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value.has(toNodeId('node-1'))).toBe(true)

    release()
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value.has(toNodeId('node-1'))).toBe(false)
  })

  it('attaches every node while disabled, and recomputes when re-enabled', async () => {
    // Both directions matter. Off must mean "everything attached", not
    // "whatever was last computed" - a stale detached set would leave nodes
    // missing with the feature nominally off. And on must recompute at once:
    // read inside plain callbacks alone the flag is not a dependency, so the
    // set would sit at all-attached until the user happened to pan.
    const bounds = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [
        `node-${index}`,
        { x: index === 0 ? 0 : 50_000, y: 0, width: 100, height: 100 }
      ])
    )
    const enabled = ref(true)
    const nodes = ref(Object.keys(bounds).map((id) => nodeData(id)))
    const scope = effectScope()
    activeScopes.push(scope)
    const activeNodeIds = scope.run(
      () =>
        useViewportKeepAlive({
          nodeIds: computed(() => nodes.value.map((node) => node.id)),
          getNodeType: (nodeId) =>
            nodes.value.find((node) => node.id === nodeId)?.type,
          pinnedNodeIds: computed(() => new Set<NodeId>()),
          isEnabled: () => enabled.value,
          getNodeBounds: (nodeId) => bounds[nodeId],
          getViewportSize: () => ({ width: 1000, height: 1000 }),
          getGeometryVersion: () => 0
        }).activeNodeIds
    )!
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value.size).toBe(1)

    enabled.value = false
    await vi.advanceTimersByTimeAsync(0)
    expect(activeNodeIds.value.size).toBe(150)

    enabled.value = true
    await vi.advanceTimersByTimeAsync(0)
    expect(activeNodeIds.value.size).toBe(1)
  })

  it('refreshes after canonical node geometry changes', async () => {
    const bounds = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [
        `node-${index}`,
        { x: 50_000, y: 0, width: 100, height: 100 }
      ])
    )
    const { activeNodeIds, geometryVersion } = setup(bounds)
    bounds['node-0'] = { x: 0, y: 0, width: 100, height: 100 }
    geometryVersion.value++

    await vi.advanceTimersByTimeAsync(150)

    expect(activeNodeIds.value).toEqual(new Set(['node-0']))
  })
})
