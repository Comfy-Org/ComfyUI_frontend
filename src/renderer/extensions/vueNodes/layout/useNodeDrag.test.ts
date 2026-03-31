import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { NodeLayout } from '@/renderer/core/layout/types'
import { fromPartial } from '@total-typescript/shoehorn'

// TODO: Simplify test setup — use real layoutStore + createTestingPinia instead
// of manually mocking every dependency. See https://github.com/Comfy-Org/ComfyUI_frontend/issues/10765
const testState = vi.hoisted(() => {
  // Imports are unavailable inside vi.hoisted() so shoehorn's fromAny cannot
  // be used here. This local identity function serves the same purpose
  // (runtime no-op cast) until the test is rewritten to use real stores.
  const placeholder = <T>(v: unknown): T => v as T
  return {
    selectedNodeIds: placeholder<Ref<Set<string>>>(null),
    selectedItems: placeholder<Ref<unknown[]>>(null),
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
    requestAnimationFrameCallback: null as FrameRequestCallback | null,
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
    getNodeLayoutRef: (nodeId: string) =>
      ref(testState.nodeLayouts.get(nodeId) ?? null),
    batchUpdateNodeBounds: testState.batchUpdateNodeBounds
  }
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useNodeSnap', () => ({
  useNodeSnap: () => testState.nodeSnap
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useShiftKeySync', () => ({
  useShiftKeySync: () => ({
    trackShiftKey: () => () => {}
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
  isLGraphGroup: () => false
}))

vi.mock('@vueuse/core', () => ({
  createSharedComposable: (fn: () => unknown) => fn
}))

import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'

function pointerEvent(clientX: number, clientY: number): PointerEvent {
  const target = document.createElement('div')
  target.hasPointerCapture = vi.fn(() => false)
  target.setPointerCapture = vi.fn()
  return fromPartial<PointerEvent>({ clientX, clientY, target, pointerId: 1 })
}

describe('useNodeDrag', () => {
  beforeEach(() => {
    testState.selectedNodeIds = ref(new Set<string>())
    testState.selectedItems = ref<unknown[]>([])
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
    testState.requestAnimationFrameCallback = null
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
    testState.selectedNodeIds.value = new Set(['1', '2'])
    testState.nodeLayouts.set('1', {
      position: { x: 100, y: 100 },
      size: { width: 200, height: 120 }
    })
    testState.nodeLayouts.set('2', {
      position: { x: 200, y: 180 },
      size: { width: 210, height: 130 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(pointerEvent(10, 20), '1')
    handleDrag(pointerEvent(30, 40), '1')
    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledTimes(1)
    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 120, y: 120 } },
      { nodeId: '2', position: { x: 220, y: 200 } }
    ])
    expect(testState.mutationFns.moveNode).not.toHaveBeenCalled()
  })

  it('uses the same batched mutation path for single-node drags', () => {
    testState.selectedNodeIds.value = new Set(['1'])
    testState.nodeLayouts.set('1', {
      position: { x: 50, y: 80 },
      size: { width: 180, height: 110 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(pointerEvent(5, 10), '1')
    handleDrag(pointerEvent(25, 30), '1')
    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledTimes(1)
    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 70, y: 100 } }
    ])
    expect(testState.mutationFns.moveNode).not.toHaveBeenCalled()
  })

  it('cancels pending RAF and applies snap updates on endDrag', () => {
    testState.selectedNodeIds.value = new Set(['1'])
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

    startDrag(pointerEvent(5, 10), '1')
    handleDrag(pointerEvent(25, 30), '1')
    endDrag({} as PointerEvent, '1')

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
})

describe('useNodeDrag auto-pan', () => {
  beforeEach(() => {
    testState.selectedNodeIds = ref(new Set(['1']))
    testState.selectedItems = ref<unknown[]>([])
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
    testState.requestAnimationFrameCallback = null
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
    drag.startDrag(pointerEvent(750, 300), '1')

    drag.handleDrag(pointerEvent(760, 300), '1')
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
    testState.selectedNodeIds.value = new Set(['1', '2'])
    const drag = useNodeDrag()

    drag.startDrag(pointerEvent(750, 300), '1')
    testState.mutationFns.batchMoveNodes.mockClear()

    testState.mockDs.offset[0] -= 5
    testState.capturedOnPan.current!(5, 0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledTimes(1)
    const calls = testState.mutationFns.batchMoveNodes.mock.calls[0][0]
    const nodeIds = calls.map((u: { nodeId: string }) => u.nodeId)
    expect(nodeIds).toContain('1')
    expect(nodeIds).toContain('2')
  })

  it('updates auto-pan pointer on handleDrag', () => {
    const drag = useNodeDrag()
    drag.startDrag(pointerEvent(400, 300), '1')

    drag.handleDrag(pointerEvent(790, 300), '1')

    expect(
      testState.capturedAutoPanInstance.current!.updatePointer
    ).toHaveBeenCalledWith(790, 300)
  })

  it('stops auto-pan on endDrag', () => {
    const drag = useNodeDrag()
    drag.startDrag(pointerEvent(400, 300), '1')
    expect(testState.capturedAutoPanInstance.current).not.toBeNull()

    drag.endDrag(pointerEvent(400, 300), '1')

    expect(testState.capturedAutoPanInstance.current!.stop).toHaveBeenCalled()
  })

  it('does not move nodes if onPan fires after endDrag', () => {
    const drag = useNodeDrag()
    drag.startDrag(pointerEvent(400, 300), '1')
    const onPan = testState.capturedOnPan.current!

    drag.endDrag(pointerEvent(400, 300), '1')
    testState.mutationFns.batchMoveNodes.mockClear()

    onPan(5, 0)

    expect(testState.mutationFns.batchMoveNodes).not.toHaveBeenCalled()
  })
})
