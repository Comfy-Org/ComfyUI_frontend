import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'

import type { NodeLayout } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

// TODO: Simplify test setup — use real layoutStore + createTestingPinia instead
// of manually mocking every dependency. See https://github.com/Comfy-Org/ComfyUI_frontend/issues/10765
const testState = vi.hoisted(() => {
  // Imports are unavailable inside vi.hoisted() so shoehorn's fromAny cannot
  // be used here. This local identity function serves the same purpose
  // (runtime no-op cast) until the test is rewritten to use real stores.
  const placeholder = <T>(v: unknown): T => v as T
  return {
    selectedNodeIds: placeholder<Ref<Set<NodeId>>>(null),
    selectedItems: placeholder<Ref<unknown[]>>(null),
    isDraggingVueNodes: placeholder<Ref<boolean>>(null),
    nodeLayouts: new Map<string, Pick<NodeLayout, 'position' | 'size'>>(),
    mutationFns: {
      setSource: vi.fn(),
      moveNode: vi.fn(),
      batchMoveNodes: vi.fn()
    },
    batchUpdateNodeBounds: vi.fn(),
    nodeSnap: {
      shouldSnap: vi.fn(() => false),
      applySnapToPosition: vi.fn((pos: { x: number; y: number }) => pos)
    },
    cancelAnimationFrame: vi.fn(),
    stopShiftSync: vi.fn(),
    requestAnimationFrameCallback: null as FrameRequestCallback | null,
    resetDragState: {
      current: null as (() => void) | null
    },
    windowListeners: new Map<string, (event: PointerEvent) => void>(),
    capturedOnPan: {
      current: null as ((dx: number, dy: number) => void) | null
    },
    capturedAutoPanInstance: {
      current: null as {
        updatePointer: ReturnType<typeof vi.fn>
        start: ReturnType<typeof vi.fn>
        stop: ReturnType<typeof vi.fn>
      } | null
    },
    mockDs: { offset: [0, 0] as [number, number], scale: 1 }
  }
})

vi.mock('pinia', () => ({
  storeToRefs: <T>(store: T) => store
}))

vi.mock('@/renderer/core/canvas/useAutoPan', () => ({
  AutoPanController: class {
    updatePointer = vi.fn()
    start = vi.fn()
    stop = vi.fn()
    constructor(opts: { onPan: (dx: number, dy: number) => void }) {
      testState.capturedOnPan.current = opts.onPan
      testState.capturedAutoPanInstance.current = this
    }
  }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    selectedNodeIds: testState.selectedNodeIds,
    selectedItems: testState.selectedItems,
    canvas: {
      ds: testState.mockDs,
      auto_pan_speed: 10,
      canvas: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          right: 800,
          bottom: 600
        })
      }
    }
  })
}))

vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: () => testState.mutationFns
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    get isDraggingVueNodes() {
      return testState.isDraggingVueNodes
    },
    getNodeLayoutRef: (nodeId: NodeId) =>
      ref(testState.nodeLayouts.get(nodeId) ?? null),
    batchUpdateNodeBounds: testState.batchUpdateNodeBounds
  }
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useNodeSnap', () => ({
  useNodeSnap: () => testState.nodeSnap
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useShiftKeySync', () => ({
  useShiftKeySync: () => ({
    trackShiftKey: () => testState.stopShiftSync
  })
}))

vi.mock('@/renderer/core/layout/transform/useTransformState', () => ({
  useTransformState: () => ({
    screenToCanvas: ({ x, y }: { x: number; y: number }) => ({
      x: x / (testState.mockDs.scale || 1) - testState.mockDs.offset[0],
      y: y / (testState.mockDs.scale || 1) - testState.mockDs.offset[1]
    })
  })
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: () => false
}))

vi.mock('@vueuse/core', () => ({
  createSharedComposable: (fn: () => unknown) => fn,
  useEventListener: (
    _target: Window,
    events: string | string[],
    listener: (event: PointerEvent) => void
  ) => {
    for (const event of Array.isArray(events) ? events : [events]) {
      testState.windowListeners.set(event, listener)
    }
  },
  whenever: (_source: () => boolean, callback: () => void) => {
    testState.resetDragState.current = callback
  }
}))

import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'

const node1 = toNodeId('1')
const node2 = toNodeId('2')

function pointerEvent(
  clientX: number,
  clientY: number,
  buttons = 1,
  pointerId = 1,
  target = pointerTarget()
): PointerEvent {
  return fromPartial<PointerEvent>({
    buttons,
    clientX,
    clientY,
    currentTarget: target,
    target,
    pointerId
  })
}

function pointerTarget(): HTMLElement {
  const target = document.createElement('div')
  let hasCapture = false
  target.hasPointerCapture = vi.fn(() => hasCapture)
  target.setPointerCapture = vi.fn(() => {
    hasCapture = true
  })
  target.releasePointerCapture = vi.fn(() => {
    hasCapture = false
  })
  return target
}

function getWindowListener(
  event: 'pointermove' | 'pointerup' | 'pointercancel'
) {
  const listener = testState.windowListeners.get(event)
  if (!listener) throw new Error(`Missing ${event} listener`)
  return listener
}

describe('useNodeDrag', () => {
  beforeEach(() => {
    testState.selectedNodeIds = ref(new Set<NodeId>())
    testState.selectedItems = ref<unknown[]>([])
    testState.isDraggingVueNodes = ref(false)
    testState.nodeLayouts.clear()
    testState.mutationFns.setSource.mockReset()
    testState.mutationFns.moveNode.mockReset()
    testState.mutationFns.batchMoveNodes.mockReset()
    testState.batchUpdateNodeBounds.mockReset()
    testState.nodeSnap.shouldSnap.mockReset()
    testState.nodeSnap.shouldSnap.mockReturnValue(false)
    testState.nodeSnap.applySnapToPosition.mockReset()
    testState.nodeSnap.applySnapToPosition.mockImplementation(
      (pos: { x: number; y: number }) => pos
    )
    testState.cancelAnimationFrame.mockReset()
    testState.stopShiftSync.mockReset()
    testState.requestAnimationFrameCallback = null
    testState.resetDragState.current = null
    testState.windowListeners.clear()
    testState.capturedOnPan.current = null
    testState.capturedAutoPanInstance.current = null
    testState.mockDs.offset = [0, 0]
    testState.mockDs.scale = 1

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      testState.requestAnimationFrameCallback = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', testState.cancelAnimationFrame)
  })

  it('batches multi-node drag updates into one mutation call per frame', () => {
    testState.selectedNodeIds.value = new Set([node1, node2])
    testState.nodeLayouts.set('1', {
      position: { x: 100, y: 100 },
      size: { width: 200, height: 120 }
    })
    testState.nodeLayouts.set('2', {
      position: { x: 200, y: 180 },
      size: { width: 210, height: 130 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(pointerEvent(10, 20), node1)
    handleDrag(pointerEvent(30, 40))
    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledTimes(1)
    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 120, y: 120 } },
      { nodeId: '2', position: { x: 220, y: 200 } }
    ])
    expect(testState.mutationFns.moveNode).not.toHaveBeenCalled()
  })

  it('uses the same batched mutation path for single-node drags', () => {
    testState.selectedNodeIds.value = new Set([node1])
    testState.nodeLayouts.set('1', {
      position: { x: 50, y: 80 },
      size: { width: 180, height: 110 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(pointerEvent(5, 10), node1)
    handleDrag(pointerEvent(25, 30))
    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledTimes(1)
    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 70, y: 100 } }
    ])
    expect(testState.mutationFns.moveNode).not.toHaveBeenCalled()
  })

  it('continues the originating node drag from window-level movement', () => {
    testState.nodeLayouts.set('1', {
      position: { x: 50, y: 80 },
      size: { width: 180, height: 110 }
    })
    testState.nodeLayouts.set('2', {
      position: { x: 200, y: 220 },
      size: { width: 200, height: 120 }
    })
    const { startDrag } = useNodeDrag()
    const dragOrigin = pointerTarget()
    const firstMoveTarget = pointerTarget()
    const canvasMoveTarget = pointerTarget()
    const firstMove = pointerEvent(15, 20, 1, 1, firstMoveTarget)
    const canvasMove = pointerEvent(45, 60, 1, 1, canvasMoveTarget)

    startDrag(pointerEvent(5, 10, 1, 1, dragOrigin), node1)
    testState.isDraggingVueNodes.value = true
    getWindowListener('pointermove')(firstMove)
    dragOrigin.releasePointerCapture(1)
    getWindowListener('pointermove')(canvasMove)
    testState.requestAnimationFrameCallback?.(0)

    expect(dragOrigin.setPointerCapture).toHaveBeenCalledTimes(2)
    expect(firstMoveTarget.setPointerCapture).not.toHaveBeenCalled()
    expect(canvasMoveTarget.setPointerCapture).not.toHaveBeenCalled()
    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledOnce()
    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 90, y: 130 } }
    ])
  })

  it('uses the latest window movement while a frame is pending', () => {
    testState.nodeLayouts.set('1', {
      position: { x: 50, y: 80 },
      size: { width: 180, height: 110 }
    })
    const { startDrag } = useNodeDrag()

    startDrag(pointerEvent(5, 10), node1)
    testState.isDraggingVueNodes.value = true
    getWindowListener('pointermove')(pointerEvent(15, 20))
    getWindowListener('pointermove')(pointerEvent(35, 50))
    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledOnce()
    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 80, y: 120 } }
    ])
  })

  it('ignores window movement from a different pointer', () => {
    testState.nodeLayouts.set('1', {
      position: { x: 50, y: 80 },
      size: { width: 180, height: 110 }
    })
    const { startDrag } = useNodeDrag()

    startDrag(pointerEvent(5, 10), node1)
    testState.isDraggingVueNodes.value = true
    getWindowListener('pointermove')(pointerEvent(35, 50, 1, 2))

    expect(testState.requestAnimationFrameCallback).toBeNull()
    expect(testState.mutationFns.batchMoveNodes).not.toHaveBeenCalled()
  })

  it.each(['pointerup', 'pointercancel'] as const)(
    'ignores %s from a different pointer',
    (eventType) => {
      testState.nodeLayouts.set('1', {
        position: { x: 50, y: 80 },
        size: { width: 180, height: 110 }
      })
      testState.nodeSnap.shouldSnap.mockReturnValue(true)
      testState.nodeSnap.applySnapToPosition.mockImplementation(({ x, y }) => ({
        x: x + 5,
        y: y + 7
      }))
      const { startDrag, handleDrag } = useNodeDrag()

      startDrag(pointerEvent(5, 10), node1)
      testState.isDraggingVueNodes.value = true
      handleDrag(pointerEvent(25, 30))
      const autoPan = testState.capturedAutoPanInstance.current
      if (!autoPan) throw new Error('Auto-pan controller was not created')

      getWindowListener(eventType)(pointerEvent(25, 30, 0, 2))

      expect(testState.isDraggingVueNodes.value).toBe(true)
      expect(autoPan.stop).not.toHaveBeenCalled()
      expect(testState.stopShiftSync).not.toHaveBeenCalled()
      expect(testState.cancelAnimationFrame).not.toHaveBeenCalled()
      expect(testState.batchUpdateNodeBounds).not.toHaveBeenCalled()
      expect(testState.mutationFns.batchMoveNodes).not.toHaveBeenCalled()
    }
  )

  it('cancels pending RAF and applies snap updates on endDrag', () => {
    testState.selectedNodeIds.value = new Set([node1])
    testState.nodeLayouts.set('1', {
      position: { x: 50, y: 80 },
      size: { width: 180, height: 110 }
    })
    testState.nodeSnap.shouldSnap.mockReturnValue(true)
    testState.nodeSnap.applySnapToPosition.mockImplementation(({ x, y }) => ({
      x: x + 5,
      y: y + 7
    }))

    const { startDrag, handleDrag, endDrag } = useNodeDrag()

    startDrag(pointerEvent(5, 10), node1)
    handleDrag(pointerEvent(25, 30))
    endDrag(pointerEvent(25, 30, 0))

    expect(testState.cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(testState.cancelAnimationFrame).toHaveBeenCalledWith(1)
    expect(testState.batchUpdateNodeBounds).toHaveBeenCalledTimes(1)
    expect(testState.batchUpdateNodeBounds).toHaveBeenCalledWith([
      {
        nodeId: '1',
        bounds: {
          x: 55,
          y: 87,
          width: 180,
          height: 110
        }
      }
    ])
  })

  it('keeps movement and snapping owned by the node that started the drag', () => {
    testState.nodeLayouts.set('1', {
      position: { x: 50, y: 80 },
      size: { width: 180, height: 110 }
    })
    testState.nodeLayouts.set('2', {
      position: { x: 200, y: 220 },
      size: { width: 200, height: 120 }
    })
    testState.nodeSnap.shouldSnap.mockReturnValue(true)
    testState.nodeSnap.applySnapToPosition.mockImplementation(({ x, y }) => ({
      x: x + 5,
      y: y + 7
    }))

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(pointerEvent(5, 10), node1)
    handleDrag(pointerEvent(25, 30))
    testState.requestAnimationFrameCallback?.(0)
    getWindowListener('pointerup')(pointerEvent(25, 30, 0))

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 70, y: 100 } }
    ])
    expect(testState.batchUpdateNodeBounds).toHaveBeenCalledWith([
      {
        nodeId: '1',
        bounds: { x: 55, y: 87, width: 180, height: 110 }
      }
    ])

    testState.mutationFns.batchMoveNodes.mockClear()
    handleDrag(pointerEvent(35, 40))
    expect(testState.mutationFns.batchMoveNodes).not.toHaveBeenCalled()
  })

  it('cleans up once when the global drag state is cleared', () => {
    testState.nodeLayouts.set('1', {
      position: { x: 50, y: 80 },
      size: { width: 180, height: 110 }
    })
    const { startDrag, handleDrag } = useNodeDrag()
    const dragOrigin = pointerTarget()
    const dragEvent = pointerEvent(25, 30)

    startDrag(pointerEvent(5, 10, 1, 1, dragOrigin), node1)
    testState.isDraggingVueNodes.value = true
    handleDrag(dragEvent)
    const autoPan = testState.capturedAutoPanInstance.current
    if (!autoPan) throw new Error('Auto-pan controller was not created')
    testState.isDraggingVueNodes.value = false
    testState.resetDragState.current?.()
    testState.resetDragState.current?.()

    expect(autoPan.stop).toHaveBeenCalledTimes(1)
    expect(testState.stopShiftSync).toHaveBeenCalledTimes(1)
    expect(testState.cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(dragOrigin.releasePointerCapture).toHaveBeenCalledTimes(1)
  })

  it('recovers when pointer movement reports that the left button is up', () => {
    testState.nodeLayouts.set('1', {
      position: { x: 50, y: 80 },
      size: { width: 180, height: 110 }
    })
    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(pointerEvent(5, 10), node1)
    testState.isDraggingVueNodes.value = true
    handleDrag(pointerEvent(25, 30))
    const autoPan = testState.capturedAutoPanInstance.current
    if (!autoPan) throw new Error('Auto-pan controller was not created')

    handleDrag(pointerEvent(30, 35, 0))

    expect(testState.isDraggingVueNodes.value).toBe(false)
    expect(autoPan.stop).toHaveBeenCalledTimes(1)
    expect(testState.cancelAnimationFrame).toHaveBeenCalledTimes(1)
  })

  it('cleans up a canceled drag delivered at window level', () => {
    testState.nodeLayouts.set('1', {
      position: { x: 50, y: 80 },
      size: { width: 180, height: 110 }
    })
    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(pointerEvent(5, 10), node1)
    testState.isDraggingVueNodes.value = true
    handleDrag(pointerEvent(25, 30))
    const autoPan = testState.capturedAutoPanInstance.current
    const onPan = testState.capturedOnPan.current
    if (!autoPan || !onPan) throw new Error('Auto-pan was not initialized')

    getWindowListener('pointercancel')(pointerEvent(25, 30, 0))
    testState.mutationFns.batchMoveNodes.mockClear()
    onPan(5, 0)

    expect(testState.isDraggingVueNodes.value).toBe(false)
    expect(autoPan.stop).toHaveBeenCalledTimes(1)
    expect(testState.cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(testState.mutationFns.batchMoveNodes).not.toHaveBeenCalled()
  })
})

describe('useNodeDrag auto-pan', () => {
  beforeEach(() => {
    testState.selectedNodeIds = ref(new Set([node1]))
    testState.selectedItems = ref<unknown[]>([])
    testState.isDraggingVueNodes = ref(false)
    testState.nodeLayouts.clear()
    testState.nodeLayouts.set('1', {
      position: { x: 100, y: 200 },
      size: { width: 200, height: 100 }
    })
    testState.nodeLayouts.set('2', {
      position: { x: 300, y: 400 },
      size: { width: 200, height: 100 }
    })
    testState.mutationFns.setSource.mockReset()
    testState.mutationFns.moveNode.mockReset()
    testState.mutationFns.batchMoveNodes.mockReset()
    testState.batchUpdateNodeBounds.mockReset()
    testState.nodeSnap.shouldSnap.mockReset()
    testState.nodeSnap.shouldSnap.mockReturnValue(false)
    testState.nodeSnap.applySnapToPosition.mockReset()
    testState.nodeSnap.applySnapToPosition.mockImplementation(
      (pos: { x: number; y: number }) => pos
    )
    testState.cancelAnimationFrame.mockReset()
    testState.stopShiftSync.mockReset()
    testState.requestAnimationFrameCallback = null
    testState.resetDragState.current = null
    testState.windowListeners.clear()
    testState.capturedOnPan.current = null
    testState.capturedAutoPanInstance.current = null
    testState.mockDs.offset = [0, 0]
    testState.mockDs.scale = 1

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      testState.requestAnimationFrameCallback = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', testState.cancelAnimationFrame)
  })

  it('moves node when auto-pan shifts the canvas offset', () => {
    const drag = useNodeDrag()
    drag.startDrag(pointerEvent(750, 300), node1)

    drag.handleDrag(pointerEvent(760, 300))
    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenLastCalledWith([
      { nodeId: '1', position: { x: 110, y: 200 } }
    ])

    testState.mutationFns.batchMoveNodes.mockClear()

    testState.mockDs.offset[0] -= 5
    testState.capturedOnPan.current!(5, 0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 115, y: 200 } }
    ])
  })

  it('moves all selected nodes when auto-pan fires', () => {
    testState.selectedNodeIds.value = new Set([node1, node2])
    const drag = useNodeDrag()

    drag.startDrag(pointerEvent(750, 300), node1)
    drag.handleDrag(pointerEvent(760, 300))
    testState.mutationFns.batchMoveNodes.mockClear()

    testState.mockDs.offset[0] -= 5
    testState.capturedOnPan.current!(5, 0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledTimes(1)
    const calls = testState.mutationFns.batchMoveNodes.mock.calls[0][0]
    const nodeIds = calls.map((u: { nodeId: string }) => u.nodeId)
    expect(nodeIds).toContain('1')
    expect(nodeIds).toContain('2')
  })

  it('starts auto-pan on handleDrag', () => {
    const drag = useNodeDrag()
    drag.startDrag(pointerEvent(400, 300), node1)

    drag.handleDrag(pointerEvent(790, 300))

    const autoPan = testState.capturedAutoPanInstance.current
    if (!autoPan) throw new Error('Auto-pan controller was not created')
    expect(autoPan.start).toHaveBeenCalledTimes(1)
    expect(autoPan.updatePointer).toHaveBeenCalledWith(790, 300)
  })

  it('reuses auto-pan controller across handleDrag calls', () => {
    const drag = useNodeDrag()
    drag.startDrag(pointerEvent(400, 300), node1)

    drag.handleDrag(pointerEvent(790, 300))
    const autoPan = testState.capturedAutoPanInstance.current
    if (!autoPan) throw new Error('Auto-pan controller was not created')

    testState.requestAnimationFrameCallback?.(0)
    drag.handleDrag(pointerEvent(795, 305))

    expect(testState.capturedAutoPanInstance.current).toBe(autoPan)
    expect(autoPan.start).toHaveBeenCalledTimes(1)
    expect(autoPan.updatePointer).toHaveBeenLastCalledWith(795, 305)
  })

  it('does not start auto-pan before handleDrag', () => {
    const drag = useNodeDrag()

    drag.startDrag(pointerEvent(790, 300), node1)

    expect(testState.capturedAutoPanInstance.current).toBeNull()
  })

  it('stops auto-pan on endDrag', () => {
    const drag = useNodeDrag()
    drag.startDrag(pointerEvent(400, 300), node1)
    drag.handleDrag(pointerEvent(400, 300))
    expect(testState.capturedAutoPanInstance.current).not.toBeNull()

    drag.endDrag(pointerEvent(400, 300))

    expect(testState.capturedAutoPanInstance.current!.stop).toHaveBeenCalled()
  })

  it('does not move nodes if onPan fires after endDrag', () => {
    const drag = useNodeDrag()
    drag.startDrag(pointerEvent(400, 300), node1)
    drag.handleDrag(pointerEvent(400, 300))
    const onPan = testState.capturedOnPan.current!

    drag.endDrag(pointerEvent(400, 300))
    testState.mutationFns.batchMoveNodes.mockClear()

    onPan(5, 0)

    expect(testState.mutationFns.batchMoveNodes).not.toHaveBeenCalled()
  })
})
