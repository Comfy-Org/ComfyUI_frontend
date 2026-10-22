import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tryOnScopeDispose, useEventListener } from '@vueuse/core'

import { toNodeId } from '@/types/nodeId'

const {
  capturedOnPan,
  capturedAutoPan,
  capturedHandlers,
  mockDs,
  mockSetDirty,
  mockLinkConnector,
  mockAdapter,
  mockGetNodeById
} = vi.hoisted(() => {
  const capturedHandlers: Record<string, (...args: unknown[]) => void> = {}
  const mockLinkConnector = {
    isConnecting: false,
    state: { snapLinksPos: null as [number, number] | null },
    events: {}
  }
  return {
    capturedOnPan: {
      current: null as ((dx: number, dy: number) => void) | null
    },
    capturedAutoPan: {
      current: null as {
        updatePointer: ReturnType<typeof vi.fn>
        start: ReturnType<typeof vi.fn>
        stop: ReturnType<typeof vi.fn>
      } | null
    },
    capturedHandlers,
    mockDs: { offset: [0, 0] as [number, number], scale: 1 },
    mockSetDirty: vi.fn(),
    mockGetNodeById: vi.fn(),
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
    }
  }
})

vi.mock<unknown>(import('@/renderer/core/canvas/useAutoPan'), () => ({
  AutoPanController: class {
    updatePointer = vi.fn()
    start = vi.fn()
    stop = vi.fn()
    constructor(opts: { onPan: (dx: number, dy: number) => void }) {
      capturedOnPan.current = opts.onPan
      capturedAutoPan.current = this
    }
  }
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    canvas: {
      ds: mockDs,
      graph: {
        rootGraph: { id: 'autopan-graph' },
        nodes: [],
        getNodeById: mockGetNodeById,
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

vi.mock<unknown>(
  import('@/renderer/core/canvas/links/linkConnectorAdapter'),
  () => ({
    createLinkConnectorAdapter: () => mockAdapter
  })
)

vi.mock<unknown>(
  import('@/renderer/core/canvas/links/slotLinkDragUIState'),
  () => {
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
  }
)

vi.mock<unknown>(
  import('@/composables/element/useCanvasPositionConversion'),
  () => ({
    useSharedCanvasPositionConversion: () => ({
      clientPosToCanvasPos: (pos: [number, number]): [number, number] => [
        pos[0] / (mockDs.scale || 1) - mockDs.offset[0],
        pos[1] / (mockDs.scale || 1) - mockDs.offset[1]
      ]
    })
  })
)

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

vi.mock<unknown>(
  import('@/renderer/core/canvas/litegraph/slotCalculations'),
  () => ({
    getGraphSlotLayout: () => ({
      nodeId: 'node1',
      index: 0,
      type: 'output',
      position: { x: 100, y: 200 }
    })
  })
)

vi.mock<unknown>(import('@/renderer/core/layout/slots/slotIdentifier'), () => ({
  getSlotKey: (...args: unknown[]) => args.join('-')
}))

vi.mock<unknown>(
  import('@/renderer/core/canvas/interaction/canvasPointerEvent'),
  () => ({
    toCanvasPointerEvent: (e: PointerEvent) => e,
    clearCanvasPointerHistory: vi.fn()
  })
)

vi.mock<unknown>(
  import('@/renderer/extensions/vueNodes/composables/slotLinkDragContext'),
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

vi.mock(import('@/renderer/extensions/vueNodes/utils/eventUtils'), () => ({
  augmentToCanvasPointerEvent: vi.fn()
}))

vi.mock(import('@/renderer/core/canvas/links/linkDropOrchestrator'), () => ({
  resolveSlotTargetCandidate: () => null,
  resolveNodeSurfaceSlotCandidate: () => null
}))

vi.mock(import('@vueuse/core'), { spy: true })
vi.mocked(useEventListener).mockImplementation((event, handler) => {
  if (typeof event === 'string' && typeof handler === 'function') {
    capturedHandlers[event] = handler
  }
  return vi.fn()
})
vi.mocked(tryOnScopeDispose).mockImplementation(() => true)

vi.mock<unknown>(import('@/lib/litegraph/src/LLink'), () => ({
  LLink: { getReroutes: () => [] },
  slotFloatingLinks: () => []
}))

vi.mock(import('@/lib/litegraph/src/canvas/linkSelection'), { spy: true })

vi.mock<unknown>(import('@/utils/rafBatch'), () => ({
  createRafBatch: (fn: () => void) => ({
    schedule: () => {},
    cancel: () => {},
    flush: fn
  })
}))

import { selectSlotLinks } from '@/lib/litegraph/src/canvas/linkSelection'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'

function pointerEvent(
  clientX: number,
  clientY: number,
  pointerId = 1,
  shiftKey = false
): PointerEvent {
  return fromPartial<PointerEvent>({
    clientX,
    clientY,
    button: 0,
    pointerId,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey,
    target: document.createElement('div'),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  })
}

function startDrag(type: 'input' | 'output' = 'output') {
  const { onPointerDown } = useSlotLinkInteraction({
    nodeId: toNodeId('node1'),
    index: 0,
    type
  })
  onPointerDown(pointerEvent(400, 300))
}

describe('useSlotLinkInteraction', () => {
  beforeEach(() => {
    vi.mocked(useEventListener).mockImplementation((event, handler) => {
      if (typeof event === 'string' && typeof handler === 'function') {
        capturedHandlers[event] = handler
      }
      return vi.fn()
    })
    vi.mocked(tryOnScopeDispose).mockImplementation(() => true)
    capturedOnPan.current = null
    capturedAutoPan.current = null
    for (const k of Object.keys(capturedHandlers)) {
      delete capturedHandlers[k]
    }
    mockDs.offset = [0, 0]
    mockDs.scale = 1
    mockLinkConnector.state.snapLinksPos = null
    vi.mocked(selectSlotLinks).mockReturnValue(true)
    useCanvasStore().isReadOnly = false
    mockGetNodeById.mockImplementation((id: string) => ({
      id,
      inputs: [],
      outputs: [{ name: 'out', type: '*', links: [] }]
    }))
  })

  it.for([
    { type: 'output', release: [400, 300], calls: 1 },
    { type: 'input', release: [403, 302], calls: 1 },
    { type: 'output', release: [440, 300], calls: 0 },
    { type: 'input', release: [400, 340], calls: 0 }
  ] as const)(
    'a release at $release on an $type selects its links $calls time(s)',
    ({ type, release, calls }) => {
      vi.mocked(selectSlotLinks).mockClear()
      startDrag(type)

      capturedHandlers['pointerup'](pointerEvent(release[0], release[1]))

      expect(selectSlotLinks).toHaveBeenCalledTimes(calls)
    }
  )

  it('a shift click keeps the existing selection', () => {
    vi.mocked(selectSlotLinks).mockClear()
    const { onPointerDown } = useSlotLinkInteraction({
      nodeId: toNodeId('node1'),
      index: 0,
      type: 'output'
    })
    onPointerDown(pointerEvent(400, 300, 1, true))

    capturedHandlers['pointerup'](pointerEvent(400, 300))

    expect(selectSlotLinks).not.toHaveBeenCalled()
  })

  it('a drag that returns to its start is still a drag', () => {
    vi.mocked(selectSlotLinks).mockClear()
    startDrag()

    capturedHandlers['pointermove'](pointerEvent(460, 300))
    capturedHandlers['pointerup'](pointerEvent(400, 300))

    expect(selectSlotLinks).not.toHaveBeenCalled()
  })

  it('a stationary click is still a click when auto-pan ticks', () => {
    vi.mocked(selectSlotLinks).mockClear()
    startDrag()

    capturedOnPan.current!(10, 0)
    capturedHandlers['pointerup'](pointerEvent(400, 300))

    expect(selectSlotLinks).toHaveBeenCalledOnce()
  })

  it('a click selects the links of the pressed slot at its position', () => {
    vi.mocked(selectSlotLinks).mockClear()
    startDrag('input')

    capturedHandlers['pointerup'](pointerEvent(400, 300))

    expect(selectSlotLinks).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: toNodeId('node1') }),
      'input',
      0,
      { x: 100, y: 200 }
    )
  })

  it('selects the links of the node pressed, not of a node looked up at release', () => {
    vi.mocked(selectSlotLinks).mockClear()
    startDrag()
    const nodeAtRelease = { id: toNodeId('node1'), inputs: [], outputs: [] }
    mockGetNodeById.mockReturnValue(nodeAtRelease)

    capturedHandlers['pointerup'](pointerEvent(400, 300))

    expect(selectSlotLinks).toHaveBeenCalledOnce()
    expect(vi.mocked(selectSlotLinks).mock.calls[0][1]).not.toBe(nodeAtRelease)
  })

  it('a drag made while Space pans the canvas is still a drag', () => {
    vi.mocked(selectSlotLinks).mockClear()
    startDrag()

    useCanvasStore().isReadOnly = true
    capturedHandlers['pointermove'](pointerEvent(460, 300))
    useCanvasStore().isReadOnly = false
    capturedHandlers['pointerup'](pointerEvent(400, 300))

    expect(selectSlotLinks).not.toHaveBeenCalled()
  })

  it('pauses auto-pan while Space pans the canvas and resumes on the next move', () => {
    startDrag()
    capturedHandlers['pointermove'](pointerEvent(460, 300))
    const autoPan = capturedAutoPan.current!

    useCanvasStore().isReadOnly = true
    capturedHandlers['pointermove'](pointerEvent(470, 300))
    expect(autoPan.stop).toHaveBeenCalledOnce()

    useCanvasStore().isReadOnly = false
    autoPan.start.mockClear()
    capturedHandlers['pointermove'](pointerEvent(480, 300))
    expect(autoPan.start).toHaveBeenCalledOnce()
  })

  it('starts auto-pan once the pointer passes the click drift', () => {
    startDrag()
    expect(capturedAutoPan.current!.start).not.toHaveBeenCalled()

    capturedHandlers['pointermove'](pointerEvent(460, 300))

    expect(capturedAutoPan.current!.start).toHaveBeenCalledOnce()
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
