import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { capturedHandlers, mockLinkConnector, mockAdapter, cancelLinkRelease } =
  vi.hoisted(() => ({
    capturedHandlers: {} as Record<string, (...args: unknown[]) => void>,
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
    },
    cancelLinkRelease: vi.fn()
  }))

mockAdapter.linkConnector = mockLinkConnector

// Emulate the real teardown: cancelling a held session clears the connector
// state so the subsequent begin call no longer trips the guard.
cancelLinkRelease.mockImplementation(() => {
  mockLinkConnector.isConnecting = false
})

vi.mock('@/stores/workspace/searchBoxStore', () => ({
  useSearchBoxStore: () => ({ cancelLinkRelease })
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
      ds: { offset: [0, 0], scale: 1 },
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
      setDirty: vi.fn()
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
      updatePointerPosition: vi.fn(),
      setCandidate: vi.fn(),
      setCompatibleForKey: vi.fn(),
      clearCompatible: vi.fn()
    })
  }
})

vi.mock('@/composables/element/useCanvasPositionConversion', () => ({
  useSharedCanvasPositionConversion: () => ({
    clientPosToCanvasPos: (pos: [number, number]): [number, number] => pos
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

function pointerEvent(pointerId = 1): PointerEvent {
  return fromPartial<PointerEvent>({
    clientX: 400,
    clientY: 300,
    button: 0,
    pointerId,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
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
  onPointerDown(pointerEvent())
}

describe('useSlotLinkInteraction held-session takeover', () => {
  beforeEach(() => {
    for (const k of Object.keys(capturedHandlers)) delete capturedHandlers[k]
    mockLinkConnector.isConnecting = false
    cancelLinkRelease.mockClear()
    mockAdapter.beginFromOutput.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('cancels a held link-release session before starting a new drag', () => {
    mockLinkConnector.isConnecting = true

    startDrag()

    expect(cancelLinkRelease).toHaveBeenCalledOnce()
    expect(mockAdapter.beginFromOutput).toHaveBeenCalled()
  })

  it('does not cancel when no session is held', () => {
    startDrag()

    expect(cancelLinkRelease).not.toHaveBeenCalled()
    expect(mockAdapter.beginFromOutput).toHaveBeenCalled()
  })
})
