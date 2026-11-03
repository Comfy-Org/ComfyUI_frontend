import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { computed, effectScope, reactive, ref } from 'vue'

import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { NodeId } from '@/renderer/core/layout/types'
import type { Bounds } from '@comfyorg/shared-frontend-utils/geometry'
import {
  getKeepAliveBounds,
  useViewportKeepAlive
} from '@/renderer/extensions/vueNodes/composables/useViewportKeepAlive'
import { registerNodeTypeCullingOptOut } from '@/services/vueNodeCullingService'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

const camera = reactive({ x: 0, y: 0, z: 1 })

vi.mock<unknown>(
  import('@/renderer/core/layout/transform/useTransformState'),
  () => ({ useTransformState: () => ({ camera }) })
)

const activeScopes: ReturnType<typeof effectScope>[] = []

function nodeData(id: string, type = 'test'): Pick<NodeState, 'id' | 'type'> {
  return {
    id: toNodeId(id),
    type
  }
}

function setup(bounds: Record<string, Bounds | null>) {
  const nodes = ref(Object.keys(bounds).map((id) => nodeData(id)))
  const pinned = ref<ReadonlySet<NodeId>>(new Set())
  const enabled = ref(true)
  const geometryVersion = ref(0)
  const scope = effectScope()
  activeScopes.push(scope)

  const activeNodeIds = scope.run(
    () =>
      useViewportKeepAlive({
        nodes: computed(() => nodes.value),
        pinnedNodeIds: computed(() => pinned.value),
        isEnabled: () => enabled.value,
        getNodeBounds: (nodeId) => bounds[nodeId],
        getViewportSize: () => ({ width: 1000, height: 1000 }),
        getGeometryVersion: () => geometryVersion.value
      }).activeNodeIds
  )!

  return { activeNodeIds, enabled, geometryVersion, nodes, pinned }
}

beforeEach(() => {
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

  it('releases accumulated viewport nodes when graph-wide pins clear', async () => {
    const bounds = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [
        `node-${index}`,
        { x: index * 2000, y: 0, width: 100, height: 100 }
      ])
    )
    const { activeNodeIds, pinned } = setup(bounds)
    expect(activeNodeIds.value).toEqual(new Set(['node-0']))

    pinned.value = new Set(Object.keys(bounds).map(toNodeId))
    camera.x = -2000
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value).toEqual(new Set(['node-0', 'node-1']))

    camera.x = -4000
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value).toEqual(new Set(['node-0', 'node-1', 'node-2']))

    pinned.value = new Set()
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value).toEqual(new Set(['node-2']))
  })

  it('keeps a registered node type attached wherever it is', async () => {
    const bounds = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [
        `node-${index}`,
        { x: index === 0 ? 0 : 50_000, y: 0, width: 100, height: 100 }
      ])
    )
    const { activeNodeIds, nodes } = setup(bounds)
    const nodeTypes = new Map([
      [toNodeId('node-1'), 'canvas-widget'],
      [toNodeId('node-2'), 'editor-widget']
    ])
    nodes.value = nodes.value.map((node) => ({
      ...node,
      type: nodeTypes.get(node.id) ?? node.type
    }))

    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value).toEqual(new Set(['node-0']))

    const release = registerNodeTypeCullingOptOut('canvas-widget')
    onTestFinished(release)
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value).toEqual(new Set(['node-0', 'node-1']))

    release()
    const releaseEditor = registerNodeTypeCullingOptOut('editor-widget')
    onTestFinished(releaseEditor)
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value).toEqual(new Set(['node-0', 'node-2']))

    releaseEditor()
    await vi.advanceTimersByTimeAsync(150)
    expect(activeNodeIds.value).toEqual(new Set(['node-0']))
  })

  it('attaches every node while disabled, and recomputes when re-enabled', async () => {
    const bounds = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [
        `node-${index}`,
        { x: index === 0 ? 0 : 50_000, y: 0, width: 100, height: 100 }
      ])
    )
    const { activeNodeIds, enabled } = setup(bounds)
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
