import { fromPartial } from '@total-typescript/shoehorn'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { tryOnScopeDispose, useEventListener } from '@vueuse/core'

import { toNodeId } from '@/types/nodeId'
import { toLinkId } from '@/types/linkId'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import {
  clearRootLinkReveals,
  isLinkRevealed
} from '@/lib/litegraph/src/canvas/linkRevealState'
import { useLinkStore } from '@/stores/linkStore'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useSlotLinkReveal } from './useSlotLinkReveal'

const {
  capturedOnPan,
  capturedAutoPan,
  capturedHandlers,
  mockDs,
  mockSetDirty,
  mockLinkConnector,
  mockAdapter
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
        id: 'autopan-graph',
        rootGraph: { id: 'autopan-graph' },
        nodes: [],
        getNodeById: (id: string) => ({
          id,
          inputs: [],
          outputs: [{ name: 'out', type: '*', links: [] }]
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

vi.mock<unknown>(import('@/utils/rafBatch'), () => ({
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
  return fromPartial<PointerEvent>({
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
  })
}

function startDrag() {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  scope.run(() => {
    const { onPointerDown } = useSlotLinkInteraction({
      nodeId: toNodeId('node1'),
      index: 0,
      type: 'output'
    })
    onPointerDown(pointerEvent(400, 300))
  })
  return scope
}

describe('useSlotLinkInteraction auto-pan', () => {
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

  it.for([
    {
      name: 'pointerup',
      finish: () => capturedHandlers.pointerup(pointerEvent(400, 300))
    },
    {
      name: 'pointercancel',
      finish: () => capturedHandlers.pointercancel(pointerEvent(400, 300))
    },
    { name: 'scope disposal', finish: (scope: EffectScope) => scope.stop() }
  ])(
    'keeps the source link revealed after slot leave until $name',
    ({ finish }) => {
      const graphScope = {
        rootGraphId: toRootGraphId('autopan-graph'),
        owningGraphId: toOwningGraphId('autopan-graph')
      }
      onTestFinished(() => {
        clearRootLinkReveals(graphScope.rootGraphId)
      })
      const linkId = toLinkId(1)
      useLinkStore().registerLink(graphScope, {
        id: linkId,
        graphId: graphScope.owningGraphId,
        originNodeId: toNodeId('node1'),
        originSlot: 0,
        targetNodeId: toNodeId('node2'),
        targetSlot: 0,
        type: 'MODEL'
      })
      useLinkPresentationStore().patch(graphScope, linkId, { hidden: true })
      const hoverScope = effectScope()
      onTestFinished(() => hoverScope.stop())
      const hover = hoverScope.run(() =>
        useSlotLinkReveal({
          nodeId: toNodeId('node1'),
          index: 0,
          type: 'output'
        })
      )
      assert.exists(hover)
      hover.revealLinks()
      expect(isLinkRevealed(graphScope.rootGraphId, linkId)).toBe(true)

      const dragScope = startDrag()
      hover.unrevealLinks()

      expect(isLinkRevealed(graphScope.rootGraphId, linkId)).toBe(true)

      finish(dragScope)

      expect(isLinkRevealed(graphScope.rootGraphId, linkId)).toBe(false)
    }
  )
})
