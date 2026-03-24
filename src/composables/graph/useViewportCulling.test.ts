import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { NodeId, NodeLayout } from '@/renderer/core/layout/types'

const mockIsNodeInViewport = vi.fn()

vi.mock('@/renderer/core/layout/transform/useTransformState', () => ({
  useTransformState: () => ({
    isNodeInViewport: mockIsNodeInViewport,
    camera: { x: 0, y: 0, z: 1 }
  })
}))

// Must import after mock setup
const { useViewportCulling } =
  await import('@/composables/graph/useViewportCulling')

function makeNode(id: string): VueNodeData {
  return {
    id: id as NodeId,
    title: `Node ${id}`,
    type: 'test',
    mode: 0,
    executing: false,
    selected: false
  }
}

let layoutCounter = 0

function makeLayout(x: number, y: number, w = 200, h = 100): NodeLayout {
  return {
    id: `layout-${layoutCounter++}`,
    position: { x, y },
    size: { width: w, height: h },
    bounds: { x, y, width: w, height: h },
    zIndex: 0,
    visible: true
  }
}

describe('useViewportCulling', () => {
  const isTransforming = ref(false)
  const viewport = { width: 1000, height: 600 }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    isTransforming.value = false
    mockIsNodeInViewport.mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mounts all nodes when all are visible', () => {
    const nodes = [makeNode('1'), makeNode('2'), makeNode('3')]
    const layouts = new Map<NodeId, NodeLayout>([
      ['1', makeLayout(100, 100)],
      ['2', makeLayout(300, 100)],
      ['3', makeLayout(500, 100)]
    ])

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => nodes),
      nodeLayouts: computed(() => layouts),
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
    const layouts = new Map<NodeId, NodeLayout>([
      ['1', makeLayout(100, 100)],
      ['2', makeLayout(5000, 5000)]
    ])

    mockIsNodeInViewport.mockImplementation(
      (pos: [number, number]) => pos[0] < 2000 && pos[1] < 2000
    )

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => nodes),
      nodeLayouts: computed(() => layouts),
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
    const layouts = new Map<NodeId, NodeLayout>([
      ['1', makeLayout(100, 100)]
      // Node '2' has no layout
    ])

    mockIsNodeInViewport.mockReturnValue(true)

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => nodes),
      nodeLayouts: computed(() => layouts),
      getViewportSize: () => viewport,
      isTransforming
    })

    expect(mountedNodeIds.value.has('1')).toBe(true)
    expect(mountedNodeIds.value.has('2')).toBe(true)
  })

  it('mounts all nodes when viewport size is zero', () => {
    const nodes = [makeNode('1'), makeNode('2')]
    const layouts = new Map<NodeId, NodeLayout>([
      ['1', makeLayout(100, 100)],
      ['2', makeLayout(5000, 5000)]
    ])

    mockIsNodeInViewport.mockReturnValue(false)

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => nodes),
      nodeLayouts: computed(() => layouts),
      getViewportSize: () => ({ width: 0, height: 0 }),
      isTransforming
    })

    expect(mountedNodeIds.value.size).toBe(2)
  })

  it('delays unmounting nodes that leave the viewport', async () => {
    const nodes = [makeNode('1'), makeNode('2')]
    const layouts = new Map<NodeId, NodeLayout>([
      ['1', makeLayout(100, 100)],
      ['2', makeLayout(300, 100)]
    ])

    mockIsNodeInViewport.mockReturnValue(true)

    const rawNodes = ref(nodes)
    const nodeLayouts = ref(layouts)

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => rawNodes.value),
      nodeLayouts: computed(() => nodeLayouts.value),
      getViewportSize: () => viewport,
      isTransforming
    })

    expect(mountedNodeIds.value.size).toBe(2)

    // Node 2 leaves viewport
    mockIsNodeInViewport.mockImplementation(
      (pos: [number, number]) => pos[0] < 200
    )

    // Trigger a refresh by updating layouts
    nodeLayouts.value = new Map(layouts)
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
    const layouts = new Map<NodeId, NodeLayout>([
      ['1', makeLayout(100, 100)],
      ['2', makeLayout(5000, 5000)]
    ])

    mockIsNodeInViewport.mockImplementation(
      (pos: [number, number]) => pos[0] < 2000
    )

    const rawNodes = ref(nodes)
    const nodeLayouts = ref(layouts)

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => rawNodes.value),
      nodeLayouts: computed(() => nodeLayouts.value),
      getViewportSize: () => viewport,
      isTransforming
    })

    expect(mountedNodeIds.value.has('2')).toBe(false)

    // Node 2 enters viewport
    mockIsNodeInViewport.mockReturnValue(true)
    nodeLayouts.value = new Map(layouts)
    await nextTick()

    // Should be immediately mounted without waiting for debounce
    expect(mountedNodeIds.value.has('2')).toBe(true)
  })

  it('handles new nodes being added to the graph', async () => {
    const nodes = ref([makeNode('1')])
    const layouts = ref(
      new Map<NodeId, NodeLayout>([['1', makeLayout(100, 100)]])
    )

    mockIsNodeInViewport.mockReturnValue(true)

    const { mountedNodeIds } = useViewportCulling({
      rawNodes: computed(() => nodes.value),
      nodeLayouts: computed(() => layouts.value),
      getViewportSize: () => viewport,
      isTransforming
    })

    expect(mountedNodeIds.value.size).toBe(1)

    // Add a new node
    nodes.value = [...nodes.value, makeNode('2')]
    layouts.value = new Map([...layouts.value, ['2', makeLayout(200, 200)]])
    await nextTick()

    expect(mountedNodeIds.value.has('2')).toBe(true)
  })
})
