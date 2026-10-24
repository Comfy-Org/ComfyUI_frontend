import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import type { NodeId, NodeLayout } from '@/renderer/core/layout/types'
import type { NodeState } from '@/types/nodeState'
import type { UUID } from '@/utils/uuid'

const mockIsNodeInViewport = vi.fn()
const mockGetNodeLayout = vi.fn()

vi.mock('@/renderer/core/layout/transform/useTransformState', () => ({
  useTransformState: () => ({
    isNodeInViewport: mockIsNodeInViewport,
    camera: { x: 0, y: 0, z: 1 }
  })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getNodeLayout: (...args: unknown[]) => mockGetNodeLayout(...args),
    get nodeGeometryVersion() {
      return mockGeometryVersion.value
    }
  }
}))

const mockGeometryVersion = ref(0)

// Must import after mock setup
const { useViewportCulling } =
  await import('@/composables/graph/useViewportCulling')

const ROOT_GRAPH_ID = 'root-graph' as UUID

function makeNode(id: string): NodeState {
  return {
    id: id as NodeId,
    graphId: ROOT_GRAPH_ID as unknown as NodeState['graphId'],
    title: `Node ${id}`,
    type: 'test',
    mode: 0,
    flags: {},
    inputs: [],
    outputs: [],
    properties: {}
  }
}

let layoutCounter = 0

function makeLayout(x: number, y: number, w = 200, h = 100): NodeLayout {
  return {
    id: `layout-${layoutCounter++}` as NodeId,
    position: { x, y },
    size: { width: w, height: h },
    bounds: { x, y, width: w, height: h },
    zIndex: 0,
    visible: true
  }
}

/** Wires the getNodeLayout mock to look up layouts from a plain id->layout map. */
function useLayouts(layouts: Map<string, NodeLayout>) {
  mockGetNodeLayout.mockImplementation((_graphId: UUID, nodeId: NodeId) =>
    layouts.get(nodeId as unknown as string)
  )
}

describe('useViewportCulling', () => {
  const isTransforming = ref(false)
  const viewport = { width: 1000, height: 600 }
  const rootGraphId = computed<UUID | undefined>(() => ROOT_GRAPH_ID)

  beforeEach(() => {
    vi.useFakeTimers()
    isTransforming.value = false
    mockGeometryVersion.value = 0
    mockIsNodeInViewport.mockReturnValue(true)
    mockGetNodeLayout.mockReturnValue(undefined)
  })

  it('mounts all nodes when all are visible', () => {
    const nodes = [makeNode('1'), makeNode('2'), makeNode('3')]
    useLayouts(
      new Map([
        ['1', makeLayout(100, 100)],
        ['2', makeLayout(300, 100)],
        ['3', makeLayout(500, 100)]
      ])
    )

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => nodes),
      rootGraphId,
      getViewportSize: () => viewport,
      isTransforming
    })

    expect(mountedNodeIds.value.size).toBe(3)
    expect(mountedNodeIds.value.has('1')).toBe(true)
    expect(mountedNodeIds.value.has('2')).toBe(true)
    expect(mountedNodeIds.value.has('3')).toBe(true)
  })

  it('culls nodes outside the viewport after debounce', async () => {
    const nodes = [makeNode('1'), makeNode('2')]
    useLayouts(
      new Map([
        ['1', makeLayout(100, 100)],
        ['2', makeLayout(5000, 5000)]
      ])
    )

    mockIsNodeInViewport.mockImplementation(
      (pos: [number, number]) => pos[0] < 2000 && pos[1] < 2000
    )

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => nodes),
      rootGraphId,
      getViewportSize: () => viewport,
      isTransforming
    })

    // Node 2 is outside viewport, but hasn't been pruned yet on
    // initial mount since it was never in the set to begin with
    // and computeVisibleNodeIds runs immediately
    expect(mountedNodeIds.value.has('1')).toBe(true)
    expect(mountedNodeIds.value.has('2')).toBe(false)
  })

  it('mounts nodes without layout data', () => {
    const nodes = [makeNode('1'), makeNode('2')]
    useLayouts(
      new Map([
        ['1', makeLayout(100, 100)]
        // Node '2' has no layout
      ])
    )

    mockIsNodeInViewport.mockReturnValue(true)

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => nodes),
      rootGraphId,
      getViewportSize: () => viewport,
      isTransforming
    })

    expect(mountedNodeIds.value.has('1')).toBe(true)
    expect(mountedNodeIds.value.has('2')).toBe(true)
  })

  it('mounts all nodes when viewport size is zero', () => {
    const nodes = [makeNode('1'), makeNode('2')]
    useLayouts(
      new Map([
        ['1', makeLayout(100, 100)],
        ['2', makeLayout(5000, 5000)]
      ])
    )

    mockIsNodeInViewport.mockReturnValue(false)

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => nodes),
      rootGraphId,
      getViewportSize: () => ({ width: 0, height: 0 }),
      isTransforming
    })

    expect(mountedNodeIds.value.size).toBe(2)
  })

  it('delays unmounting nodes that leave the viewport', async () => {
    const nodes = [makeNode('1'), makeNode('2')]
    const layouts = new Map([
      ['1', makeLayout(100, 100)],
      ['2', makeLayout(300, 100)]
    ])
    useLayouts(layouts)

    mockIsNodeInViewport.mockReturnValue(true)

    const rawNodes = ref(nodes)

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => rawNodes.value),
      rootGraphId,
      getViewportSize: () => viewport,
      isTransforming
    })

    expect(mountedNodeIds.value.size).toBe(2)

    // Node 2 leaves viewport
    mockIsNodeInViewport.mockImplementation(
      (pos: [number, number]) => pos[0] < 200
    )

    // Trigger a refresh by bumping the geometry version
    mockGeometryVersion.value++
    await nextTick()

    // Node 2 should still be mounted (debounce hasn't fired)
    expect(mountedNodeIds.value.has('2')).toBe(true)

    // After debounce delay, node 2 should be unmounted
    await vi.advanceTimersByTimeAsync(300)

    expect(mountedNodeIds.value.has('1')).toBe(true)
    expect(mountedNodeIds.value.has('2')).toBe(false)
  })

  it('immediately mounts nodes entering the viewport', async () => {
    const nodes = [makeNode('1'), makeNode('2')]
    const layouts = new Map([
      ['1', makeLayout(100, 100)],
      ['2', makeLayout(5000, 5000)]
    ])
    useLayouts(layouts)

    mockIsNodeInViewport.mockImplementation(
      (pos: [number, number]) => pos[0] < 2000
    )

    const rawNodes = ref(nodes)

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => rawNodes.value),
      rootGraphId,
      getViewportSize: () => viewport,
      isTransforming
    })

    expect(mountedNodeIds.value.has('2')).toBe(false)

    // Node 2 enters viewport
    mockIsNodeInViewport.mockReturnValue(true)
    mockGeometryVersion.value++
    await nextTick()

    // Should be immediately mounted without waiting for debounce
    expect(mountedNodeIds.value.has('2')).toBe(true)
  })

  it('handles new nodes being added to the graph', async () => {
    const nodes = ref([makeNode('1')])
    const layouts = new Map([['1', makeLayout(100, 100)]])
    useLayouts(layouts)

    mockIsNodeInViewport.mockReturnValue(true)

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => nodes.value),
      rootGraphId,
      getViewportSize: () => viewport,
      isTransforming
    })

    expect(mountedNodeIds.value.size).toBe(1)

    // Add a new node
    nodes.value = [...nodes.value, makeNode('2')]
    layouts.set('2', makeLayout(200, 200))
    await nextTick()

    expect(mountedNodeIds.value.has('2')).toBe(true)
  })
})
