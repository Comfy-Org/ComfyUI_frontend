import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as VueUse from '@vueuse/core'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { UNASSIGNED_NODE_ID, toNodeId } from '@/types/nodeId'

type MockReroute = {
  id: string
  pos: [number, number]
  parentId?: string | null
  linkIds: Set<string>
}

type MockLink = {
  id: string
  origin_id: string
  origin_slot: number
  target_id: string
  target_slot: number
}

type MockGraph = {
  _nodes: LGraphNode[]
  reroutes: Map<string, MockReroute>
  _links: Map<string, MockLink>
  onNodeAdded?: (node: LGraphNode) => void
}

type MockCanvas = {
  graph?: MockGraph
  setDirty: ReturnType<typeof vi.fn>
}

const mockWheneverCallbacks = vi.hoisted(() => ({
  values: [] as Array<() => void>
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUse>()
  return {
    ...actual,
    createSharedComposable: <Args extends unknown[], Return>(
      fn: (...args: Args) => Return
    ) => fn,
    whenever: (_source: () => boolean, callback: () => void) => {
      mockWheneverCallbacks.values.push(callback)
      return vi.fn()
    }
  }
})

const mockUseGraphNodeManager = vi.hoisted(() => vi.fn())
vi.mock('@/composables/graph/useGraphNodeManager', () => ({
  useGraphNodeManager: mockUseGraphNodeManager
}))

const mockShouldRenderVueNodes = vi.hoisted(() => ({ value: false }))
vi.mock('@/composables/useVueFeatureFlags', () => ({
  useVueFeatureFlags: () => ({
    shouldRenderVueNodes: mockShouldRenderVueNodes
  })
}))

const mockCanvasStoreCanvas = vi.hoisted(() => ({
  value: undefined as MockCanvas | undefined
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: mockCanvasStoreCanvas.value
  })
}))

const mockCreateReroute = vi.hoisted(() => vi.fn())
const mockCreateLink = vi.hoisted(() => vi.fn())
vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: () => ({
    createReroute: mockCreateReroute,
    createLink: mockCreateLink
  })
}))

const mockInitializeFromLiteGraph = vi.hoisted(() => vi.fn())
const mockClearAllSlotLayouts = vi.hoisted(() => vi.fn())
vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    initializeFromLiteGraph: mockInitializeFromLiteGraph,
    clearAllSlotLayouts: mockClearAllSlotLayouts
  }
}))

const mockStartSync = vi.hoisted(() => vi.fn())
const mockStopSync = vi.hoisted(() => vi.fn())
vi.mock('@/renderer/core/layout/sync/useLayoutSync', () => ({
  useLayoutSync: () => ({
    startSync: mockStartSync,
    stopSync: mockStopSync
  })
}))

const mockComfyCanvas = vi.hoisted(() => ({
  value: undefined as MockCanvas | undefined
}))
vi.mock('@/scripts/app', () => ({
  app: {
    get canvas() {
      return mockComfyCanvas.value
    }
  }
}))

const mockManagerCleanup = vi.hoisted(() => vi.fn())

function createNode(
  id: number,
  overrides: Partial<LGraphNode> = {}
): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id: toNodeId(id),
    pos: [id * 10, id * 20],
    size: [100 + id, 200 + id],
    flags: { collapsed: false },
    arrange: vi.fn(),
    ...overrides
  })
}

function createGraph(overrides: Partial<MockGraph> = {}): MockGraph {
  return {
    _nodes: [],
    reroutes: new Map(),
    _links: new Map(),
    ...overrides
  }
}

async function loadLifecycle() {
  vi.resetModules()
  const { useVueNodeLifecycle } = await import('./useVueNodeLifecycle')
  return useVueNodeLifecycle()
}

describe('useVueNodeLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWheneverCallbacks.values = []
    mockShouldRenderVueNodes.value = false
    mockCanvasStoreCanvas.value = undefined
    mockComfyCanvas.value = undefined
    mockManagerCleanup.mockReset()
    mockUseGraphNodeManager.mockReset()
    mockUseGraphNodeManager.mockReturnValue({ cleanup: mockManagerCleanup })
  })

  it('initializes the node manager from the active graph', async () => {
    const node = createNode(1)
    const graph = createGraph({
      _nodes: [node],
      reroutes: new Map([
        [
          'reroute-1',
          {
            id: 'reroute-1',
            pos: [12, 34],
            parentId: null,
            linkIds: new Set(['link-1'])
          }
        ]
      ]),
      _links: new Map([
        [
          'link-1',
          {
            id: 'link-1',
            origin_id: toNodeId(1),
            origin_slot: 0,
            target_id: toNodeId(2),
            target_slot: 1
          }
        ],
        [
          'link-2',
          {
            id: 'link-2',
            origin_id: UNASSIGNED_NODE_ID,
            origin_slot: 0,
            target_id: toNodeId(2),
            target_slot: 1
          }
        ],
        [
          'link-3',
          {
            id: 'link-3',
            origin_id: toNodeId(1),
            origin_slot: 0,
            target_id: UNASSIGNED_NODE_ID,
            target_slot: 1
          }
        ]
      ])
    })
    const canvas = { graph, setDirty: vi.fn() }
    mockComfyCanvas.value = canvas
    mockCanvasStoreCanvas.value = canvas
    mockShouldRenderVueNodes.value = true

    const lifecycle = await loadLifecycle()

    expect(mockUseGraphNodeManager).toHaveBeenCalledWith(graph)
    expect(lifecycle.nodeManager.value).toEqual({
      cleanup: mockManagerCleanup
    })
    expect(mockInitializeFromLiteGraph).toHaveBeenCalledWith([
      {
        id: toNodeId(1),
        pos: [10, 20],
        size: [101, 201]
      }
    ])
    expect(mockCreateReroute).toHaveBeenCalledWith(
      'reroute-1',
      { x: 12, y: 34 },
      undefined,
      ['link-1']
    )
    expect(mockCreateLink).toHaveBeenCalledOnce()
    expect(mockCreateLink).toHaveBeenCalledWith(
      'link-1',
      toNodeId(1),
      0,
      toNodeId(2),
      1
    )
    expect(mockStartSync).toHaveBeenCalledWith(canvas)
  })

  it('does not initialize without an active graph', async () => {
    mockShouldRenderVueNodes.value = true
    const lifecycle = await loadLifecycle()

    lifecycle.initializeNodeManager()

    expect(mockUseGraphNodeManager).not.toHaveBeenCalled()
    expect(mockStartSync).not.toHaveBeenCalled()
  })

  it('stops sync and tolerates manager cleanup errors', async () => {
    mockManagerCleanup.mockImplementation(() => {
      throw new Error('cleanup failed')
    })
    mockComfyCanvas.value = {
      graph: createGraph(),
      setDirty: vi.fn()
    }
    mockShouldRenderVueNodes.value = true
    const lifecycle = await loadLifecycle()

    expect(() => lifecycle.disposeNodeManagerAndSyncs()).not.toThrow()

    expect(mockStopSync).toHaveBeenCalled()
    expect(lifecycle.nodeManager.value).toBeNull()
  })

  it('arranges legacy nodes when the Vue node mode is disabled', async () => {
    const arrangeVisible = vi.fn()
    const arrangeThrowing = vi.fn(() => {
      throw new Error('not ready')
    })
    const graph = createGraph({
      _nodes: [
        createNode(1, { arrange: arrangeVisible }),
        createNode(2, { flags: { collapsed: true }, arrange: vi.fn() }),
        createNode(3, { arrange: arrangeThrowing })
      ]
    })
    const canvas = { graph, setDirty: vi.fn() }
    mockComfyCanvas.value = canvas
    mockShouldRenderVueNodes.value = true
    await loadLifecycle()

    mockWheneverCallbacks.values[0]()

    expect(arrangeVisible).toHaveBeenCalled()
    expect(arrangeThrowing).toHaveBeenCalled()
    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('marks the canvas dirty when disabling without a graph', async () => {
    const canvas = { setDirty: vi.fn() }
    mockComfyCanvas.value = canvas
    await loadLifecycle()

    mockWheneverCallbacks.values[0]()

    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('initializes on the first node added to an empty graph', async () => {
    mockShouldRenderVueNodes.value = true
    const originalOnNodeAdded = vi.fn()
    const graph = createGraph({ onNodeAdded: originalOnNodeAdded })
    const canvas = { graph, setDirty: vi.fn() }
    const node = createNode(1)
    const lifecycle = await loadLifecycle()
    mockComfyCanvas.value = canvas

    lifecycle.setupEmptyGraphListener()
    graph.onNodeAdded?.(node)

    expect(mockUseGraphNodeManager).toHaveBeenCalledWith(graph)
    expect(graph.onNodeAdded).toBe(originalOnNodeAdded)
    expect(originalOnNodeAdded).toHaveBeenCalledWith(node)
  })

  it('does not replace onNodeAdded when the empty-graph guard fails', async () => {
    const originalOnNodeAdded = vi.fn()
    const graph = createGraph({
      _nodes: [createNode(1)],
      onNodeAdded: originalOnNodeAdded
    })
    mockComfyCanvas.value = { graph, setDirty: vi.fn() }
    mockShouldRenderVueNodes.value = true
    const lifecycle = await loadLifecycle()

    lifecycle.setupEmptyGraphListener()

    expect(graph.onNodeAdded).toBe(originalOnNodeAdded)
  })

  it('cleans up the node manager on unmount', async () => {
    mockComfyCanvas.value = {
      graph: createGraph(),
      setDirty: vi.fn()
    }
    mockShouldRenderVueNodes.value = true
    const lifecycle = await loadLifecycle()

    lifecycle.cleanup()
    lifecycle.cleanup()

    expect(mockManagerCleanup).toHaveBeenCalledOnce()
    expect(lifecycle.nodeManager.value).toBeNull()
  })
})
