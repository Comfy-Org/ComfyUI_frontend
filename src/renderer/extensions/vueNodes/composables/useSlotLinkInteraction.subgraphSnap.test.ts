import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  capturedHandlers,
  mockDs,
  mockSetDirty,
  mockLinkConnector,
  mockAdapter,
  mockGraph,
  inputNode,
  outputNode,
  isSubgraphMock
} = vi.hoisted(() => {
  const inputNode = {
    isPointerOver: false,
    onPointerMove: vi.fn(),
    getSlotInPosition: vi.fn()
  }
  const outputNode = {
    isPointerOver: false,
    onPointerMove: vi.fn(),
    getSlotInPosition: vi.fn()
  }
  const mockLinkConnector = {
    isConnecting: false,
    state: { snapLinksPos: null as [number, number] | null },
    events: {}
  }
  return {
    capturedHandlers: {} as Record<string, (...args: unknown[]) => void>,
    mockDs: { offset: [0, 0] as [number, number], scale: 1 },
    mockSetDirty: vi.fn(),
    mockLinkConnector,
    mockAdapter: {
      beginFromOutput: vi.fn(),
      beginFromInput: vi.fn(),
      reset: vi.fn(),
      renderLinks: [] as unknown[],
      linkConnector: mockLinkConnector,
      isInputValidDrop: vi.fn(() => false),
      isOutputValidDrop: vi.fn(() => false),
      dropOnCanvas: vi.fn()
    },
    mockGraph: {
      inputNode,
      outputNode,
      getNodeById: () => ({
        id: 'node1',
        inputs: [],
        outputs: [{ name: 'out', type: '*', links: [], _floatingLinks: null }]
      }),
      getLink: () => null,
      getReroute: () => null
    },
    inputNode,
    outputNode,
    isSubgraphMock: vi.fn((_graph?: unknown) => true)
  }
})

vi.mock('@/utils/typeGuardUtil', () => ({
  isSubgraph: (graph: unknown) => isSubgraphMock(graph)
}))

vi.mock('@/renderer/core/canvas/useAutoPan', () => ({
  AutoPanController: class {
    updatePointer = vi.fn()
    start = vi.fn()
    stop = vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      ds: mockDs,
      graph: mockGraph,
      linkConnector: mockLinkConnector,
      canvas: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          right: 800,
          bottom: 600,
          width: 800,
          height: 600
        })
      },
      setDirty: mockSetDirty
    }
  }
}))

vi.mock('@/renderer/core/canvas/links/linkConnectorAdapter', () => ({
  createLinkConnectorAdapter: () => mockAdapter
}))

vi.mock('@/renderer/core/canvas/links/slotLinkDragUIState', () => {
  const pointer = { client: { x: 0, y: 0 }, canvas: { x: 0, y: 0 } }
  return {
    useSlotLinkDragUIState: () => ({
      state: {
        active: false,
        pointerId: null,
        source: null,
        pointer,
        candidate: null,
        compatible: new Map()
      },
      beginDrag: vi.fn(),
      endDrag: vi.fn(),
      updatePointerPosition: (
        cx: number,
        cy: number,
        canX: number,
        canY: number
      ) => {
        pointer.client.x = cx
        pointer.client.y = cy
        pointer.canvas.x = canX
        pointer.canvas.y = canY
      },
      setCandidate: vi.fn(),
      setCompatibleForKey: vi.fn(),
      clearCompatible: vi.fn()
    })
  }
})

vi.mock('@/composables/element/useCanvasPositionConversion', () => ({
  useSharedCanvasPositionConversion: () => ({
    clientPosToCanvasPos: (pos: [number, number]): [number, number] => [
      pos[0],
      pos[1]
    ]
  })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getSlotLayout: () => ({
      nodeId: 'node1',
      index: 0,
      type: 'output',
      position: { x: 100, y: 200 }
    }),
    getAllSlotKeys: () => [],
    getRerouteLayout: () => null,
    queryRerouteAtPoint: () => null
  }
}))

vi.mock('@/renderer/core/layout/slots/slotIdentifier', () => ({
  getSlotKey: (...args: unknown[]) => args.join('-')
}))

vi.mock('@/renderer/core/canvas/interaction/canvasPointerEvent', () => ({
  toCanvasPointerEvent: (e: PointerEvent) => e,
  clearCanvasPointerHistory: vi.fn()
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/slotLinkDragContext',
  () => ({
    createSlotLinkDragContext: () => ({
      pendingPointerMove: null,
      lastPointerEventTarget: null,
      lastPointerTargetSlotKey: null,
      lastPointerTargetNodeId: null,
      lastHoverSlotKey: null,
      lastHoverNodeId: null,
      lastCandidateKey: null,
      reset: vi.fn(),
      dispose: vi.fn()
    })
  })
)

vi.mock('@/renderer/extensions/vueNodes/utils/eventUtils', () => ({
  augmentToCanvasPointerEvent: vi.fn()
}))

vi.mock('@/renderer/core/canvas/links/linkDropOrchestrator', () => ({
  resolveSlotTargetCandidate: () => null,
  resolveNodeSurfaceSlotCandidate: () => null
}))

vi.mock('@vueuse/core', () => ({
  useEventListener: (event: string, handler: (...args: unknown[]) => void) => {
    capturedHandlers[event] = handler
    return vi.fn()
  },
  tryOnScopeDispose: () => {}
}))

vi.mock('@/lib/litegraph/src/LLink', () => ({
  LLink: { getReroutes: () => [] }
}))

vi.mock('@/lib/litegraph/src/types/globalEnums', () => ({
  LinkDirection: { LEFT: 0, RIGHT: 1, NONE: -1 }
}))

// Run RAF batches synchronously so a pointermove immediately processes a frame.
vi.mock('@/utils/rafBatch', () => ({
  createRafBatch: (fn: () => void) => ({
    schedule: fn,
    cancel: () => {},
    flush: fn
  })
}))

import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'

function pointerEvent(clientX: number, clientY: number): PointerEvent {
  return fromPartial<PointerEvent>({
    clientX,
    clientY,
    button: 0,
    pointerId: 1,
    target: document.createElement('div'),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  })
}

function startDrag() {
  const { onPointerDown } = useSlotLinkInteraction({
    nodeId: 'node1',
    index: 0,
    type: 'output'
  })
  onPointerDown(pointerEvent(400, 300))
}

describe('useSlotLinkInteraction subgraph IO snap', () => {
  beforeEach(() => {
    for (const k of Object.keys(capturedHandlers)) delete capturedHandlers[k]
    mockDs.offset = [0, 0]
    mockDs.scale = 1
    mockSetDirty.mockClear()
    mockLinkConnector.state.snapLinksPos = null
    isSubgraphMock.mockReturnValue(true)
    for (const node of [inputNode, outputNode]) {
      node.isPointerOver = false
      node.onPointerMove.mockReset()
      node.getSlotInPosition.mockReset()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('snaps to a hovered subgraph IO slot position', () => {
    inputNode.onPointerMove.mockImplementation(() => {
      inputNode.isPointerOver = true
    })
    inputNode.getSlotInPosition.mockReturnValue({
      isPointerOver: true,
      pos: [123, 456]
    })

    startDrag()
    capturedHandlers['pointermove'](pointerEvent(200, 250))

    expect(inputNode.onPointerMove).toHaveBeenCalled()
    expect(mockLinkConnector.state.snapLinksPos).toEqual([123, 456])
    expect(mockSetDirty).toHaveBeenCalledWith(true, true)
  })

  it('marks canvas dirty when subgraph IO hover state changes without a slot', () => {
    outputNode.onPointerMove.mockImplementation(() => {
      outputNode.isPointerOver = true
    })
    outputNode.getSlotInPosition.mockReturnValue(null)

    startDrag()
    mockSetDirty.mockClear()
    capturedHandlers['pointermove'](pointerEvent(200, 250))

    // Pointer moved over the IO node but not onto a slot: redraw, no snap.
    expect(mockSetDirty).toHaveBeenCalledWith(true, true)
    expect(mockLinkConnector.state.snapLinksPos).toEqual([200, 250])
  })

  it('does not run subgraph IO logic for non-subgraph graphs', () => {
    isSubgraphMock.mockReturnValue(false)

    startDrag()
    capturedHandlers['pointermove'](pointerEvent(200, 250))

    expect(inputNode.onPointerMove).not.toHaveBeenCalled()
    expect(outputNode.onPointerMove).not.toHaveBeenCalled()
  })
})
