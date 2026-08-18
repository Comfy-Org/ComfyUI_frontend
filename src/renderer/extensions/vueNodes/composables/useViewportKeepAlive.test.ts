import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, reactive, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { Bounds, NodeId } from '@/renderer/core/layout/types'
import {
  getKeepAliveBounds,
  useViewportKeepAlive
} from '@/renderer/extensions/vueNodes/composables/useViewportKeepAlive'
import { toNodeId } from '@/types/nodeId'

const camera = reactive({ x: 0, y: 0, z: 1 })

vi.mock('@/renderer/core/layout/transform/useTransformState', () => ({
  useTransformState: () => ({ camera })
}))

const activeScopes: ReturnType<typeof effectScope>[] = []

function nodeData(id: string): VueNodeData {
  return {
    id: toNodeId(id),
    title: id,
    type: 'test',
    mode: 0,
    selected: false,
    executing: false
  }
}

function setup(bounds: Record<string, Bounds | null>) {
  const nodes = ref(Object.keys(bounds).map(nodeData))
  const pinned = ref<ReadonlySet<NodeId>>(new Set())
  const geometryListeners = new Set<() => void>()
  const scope = effectScope()
  activeScopes.push(scope)

  const activeNodeIds = scope.run(
    () =>
      useViewportKeepAlive({
        nodes: computed(() => nodes.value),
        pinnedNodeIds: computed(() => pinned.value),
        getNodeBounds: (nodeId) => bounds[nodeId],
        getViewportSize: () => ({ width: 1000, height: 1000 }),
        onNodeGeometryChange: (listener) => {
          geometryListeners.add(listener)
          return () => geometryListeners.delete(listener)
        }
      }).activeNodeIds
  )!

  return { activeNodeIds, geometryListeners, nodes, pinned }
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(camera, { x: 0, y: 0, z: 1 })
})

afterEach(() => {
  for (const scope of activeScopes.splice(0)) scope.stop()
  vi.useRealTimers()
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

  it('refreshes after canonical node geometry changes', async () => {
    const bounds = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [
        `node-${index}`,
        { x: 50_000, y: 0, width: 100, height: 100 }
      ])
    )
    const { activeNodeIds, geometryListeners } = setup(bounds)
    bounds['node-0'] = { x: 0, y: 0, width: 100, height: 100 }
    geometryListeners.forEach((listener) => listener())

    await vi.advanceTimersByTimeAsync(150)

    expect(activeNodeIds.value).toEqual(new Set(['node-0']))
  })
})
