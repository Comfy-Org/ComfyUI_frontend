import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  capturedOnPan,
  capturedAutoPan,
  capturedHandlers,
  mockDs,
  mockSetDirty,
  mockLinkConnector,
  mockAdapter
} = vi.hoisted(() => ({
  capturedOnPan: { current: null as ((dx: number, dy: number) => void) | null },
  capturedAutoPan: {
    current: null as {
      updatePointer: ReturnType<typeof vi.fn>
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
    } | null
  },
  capturedHandlers: {} as Record<string, (...args: unknown[]) => void>,
  mockDs: { offset: [0, 0] as [number, number], scale: 1 },
  mockSetDirty: vi.fn(),
  mockLinkConnector: {
    isConnecting: false,
    state: { snapLinksPos: null as [number, number] | null },
    events: {}
  },
  mockAdapter: {
    beginFromOutput: vi.fn(),
    beginFromInput: vi.fn(),
    reset: vi.fn(),
    renderLinks: [] as unknown[],
    linkConnector: null as unknown,
    isInputValidDrop: vi.fn(() => false),
    isOutputValidDrop: vi.fn(() => false),
    dropOnCanvas: vi.fn()
  }
}))

mockAdapter.linkConnector = mockLinkConnector

vi.mock('@/renderer/core/canvas/useAutoPan', () => ({
  AutoPanController: class {
    updatePointer = vi.fn()
    start = vi.fn()
    stop = vi.fn()
    constructor(opts: { onPan: (dx: number, dy: number) => void }) {
      capturedOnPan.current = opts.onPan
      capturedAutoPan.current = this as typeof capturedAutoPan.current
    }
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      ds: mockDs,
      graph: {
        getNodeById: (id: string) => ({
          id,
          inputs: [],
          outputs: [{ name: 'out', type: '*', links: [], _floatingLinks: null }]
        }),
        getLink: () => null,
        getReroute: () => null
      },
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
      pos[0] / (mockDs.scale || 1) - mockDs.offset[0],
      pos[1] / (mockDs.scale || 1) - mockDs.offset[1]
    ]
  })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getSlotLayout: (_key: string) => ({
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

vi.mock('@/utils/rafBatch', () => ({
  createRafBatch: (fn: () => void) => ({
    schedule: () => {},
    cancel: () => {},
    flush: fn
  })
}))

import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'

function pointerEvent(
  clientX: number,
  clientY: number,
  pointerId = 1
): PointerEvent {
  return {
    clientX,
    clientY,
    button: 0,
    pointerId,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: document.createElement('div'),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as PointerEvent
}

function startDrag() {
  const { onPointerDown } = useSlotLinkInteraction({
    nodeId: 'node1',
    index: 0,
    type: 'output'
  })
  onPointerDown(pointerEvent(400, 300))
}

describe('useSlotLinkInteraction auto-pan', () => {
  beforeEach(() => {
    capturedOnPan.current = null
    capturedAutoPan.current = null
    Object.keys(capturedHandlers).forEach((k) => delete capturedHandlers[k])
    mockDs.offset = [0, 0]
    mockDs.scale = 1
    mockSetDirty.mockClear()
    mockAdapter.beginFromOutput.mockClear()
    mockLinkConnector.state.snapLinksPos = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts auto-pan when link drag begins', () => {
    startDrag()

    expect(capturedAutoPan.current).not.toBeNull()
    expect(capturedAutoPan.current!.start).toHaveBeenCalled()
  })

  it('updates snapLinksPos and marks dirty when onPan fires', () => {
    startDrag()
    mockSetDirty.mockClear()

    mockDs.offset = [-10, -5]
    capturedOnPan.current!(10, 5)

    expect(mockLinkConnector.state.snapLinksPos).toEqual([410, 305])
    expect(mockSetDirty).toHaveBeenCalledWith(true, true)
  })

  it('forwards pointer position to auto-pan during drag', () => {
    startDrag()
    const moveHandler = capturedHandlers['pointermove']

    moveHandler(pointerEvent(790, 300))

    expect(capturedAutoPan.current!.updatePointer).toHaveBeenCalledWith(
      790,
      300
    )
  })

  it('stops auto-pan on cleanup', () => {
    startDrag()
    const upHandler = capturedHandlers['pointerup']

    upHandler(pointerEvent(400, 300))

    expect(capturedAutoPan.current!.stop).toHaveBeenCalled()
  })
})
