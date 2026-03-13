import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  capturedOnPan,
  capturedInstance,
  moveNode,
  setSource,
  mockDs,
  mockSelectedNodeIds,
  mockNodeLayouts
} = vi.hoisted(() => ({
  capturedOnPan: {
    current: null as ((dx: number, dy: number) => void) | null
  },
  capturedInstance: {
    current: null as {
      updatePointer: ReturnType<typeof vi.fn>
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
    } | null
  },
  moveNode: vi.fn(),
  setSource: vi.fn(),
  mockDs: { offset: [0, 0] as [number, number], scale: 1 },
  mockSelectedNodeIds: { value: new Set(['1']) },
  mockNodeLayouts: {
    value: new Map<
      string,
      {
        position: { x: number; y: number }
        size: { width: number; height: number }
      }
    >([
      [
        '1',
        { position: { x: 100, y: 200 }, size: { width: 200, height: 100 } }
      ],
      ['2', { position: { x: 300, y: 400 }, size: { width: 200, height: 100 } }]
    ])
  }
}))

vi.mock('@/renderer/core/canvas/useAutoPan', () => ({
  AutoPanController: class {
    updatePointer = vi.fn()
    start = vi.fn()
    stop = vi.fn()
    constructor(opts: { onPan: (dx: number, dy: number) => void }) {
      capturedOnPan.current = opts.onPan
      capturedInstance.current = this
    }
  }
}))

vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: () => ({ moveNode, setSource })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: {
      ds: mockDs,
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

vi.mock('pinia', async () => {
  const { ref } = await import('vue')
  return {
    storeToRefs: () => ({
      selectedNodeIds: ref(mockSelectedNodeIds.value),
      selectedItems: ref([])
    })
  }
})

vi.mock('@/renderer/core/layout/store/layoutStore', async () => {
  const { ref } = await import('vue')
  return {
    layoutStore: {
      getNodeLayoutRef: (id: string) => {
        const layout = mockNodeLayouts.value.get(id)
        return ref(
          layout
            ? { position: { ...layout.position }, size: { ...layout.size } }
            : null
        )
      },
      batchUpdateNodeBounds: vi.fn()
    }
  }
})

vi.mock('@/renderer/core/layout/transform/useTransformState', () => ({
  useTransformState: () => ({
    screenToCanvas: (p: { x: number; y: number }) => ({
      x: p.x / (mockDs.scale || 1) - mockDs.offset[0],
      y: p.y / (mockDs.scale || 1) - mockDs.offset[1]
    })
  })
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useNodeSnap', () => ({
  useNodeSnap: () => ({
    shouldSnap: () => false,
    applySnapToPosition: (p: { x: number; y: number }) => p
  })
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useShiftKeySync', () => ({
  useShiftKeySync: () => ({
    trackShiftKey: () => () => {}
  })
}))

vi.mock('@/renderer/core/layout/types', () => ({
  LayoutSource: { Vue: 'vue' }
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphGroup: () => false
}))

vi.mock('@vueuse/core', () => ({
  createSharedComposable: (fn: () => unknown) => fn
}))

import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'

function pointerEvent(clientX: number, clientY: number): PointerEvent {
  return {
    clientX,
    clientY,
    target: { hasPointerCapture: () => true },
    pointerId: 1
  } as unknown as PointerEvent
}

describe('useNodeDrag auto-pan', () => {
  let drag: ReturnType<typeof useNodeDrag>

  beforeEach(() => {
    vi.useFakeTimers()
    capturedOnPan.current = null
    capturedInstance.current = null
    moveNode.mockClear()
    setSource.mockClear()
    mockDs.offset = [0, 0]
    mockDs.scale = 1
    mockSelectedNodeIds.value = new Set(['1'])
    drag = useNodeDrag()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves node when auto-pan shifts the canvas offset', () => {
    drag.startDrag(pointerEvent(750, 300), '1')

    drag.handleDrag(pointerEvent(760, 300), '1')
    vi.advanceTimersByTime(16)

    expect(moveNode).toHaveBeenLastCalledWith('1', { x: 110, y: 200 })

    moveNode.mockClear()

    mockDs.offset[0] -= 5
    capturedOnPan.current!(5, 0)

    expect(moveNode).toHaveBeenCalledWith('1', { x: 115, y: 200 })
  })

  it('moves all selected nodes when auto-pan fires', () => {
    mockSelectedNodeIds.value = new Set(['1', '2'])
    drag = useNodeDrag()

    drag.startDrag(pointerEvent(750, 300), '1')
    moveNode.mockClear()

    mockDs.offset[0] -= 5
    capturedOnPan.current!(5, 0)

    expect(moveNode).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        x: expect.any(Number)
      })
    )
    expect(moveNode).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({
        x: expect.any(Number)
      })
    )
  })

  it('updates auto-pan pointer on handleDrag', () => {
    drag.startDrag(pointerEvent(400, 300), '1')

    drag.handleDrag(pointerEvent(790, 300), '1')

    expect(capturedInstance.current!.updatePointer).toHaveBeenCalledWith(
      790,
      300
    )
  })

  it('stops auto-pan on endDrag', () => {
    drag.startDrag(pointerEvent(400, 300), '1')
    expect(capturedInstance.current).not.toBeNull()

    drag.endDrag(pointerEvent(400, 300), '1')

    expect(capturedInstance.current!.stop).toHaveBeenCalled()
  })

  it('does not move nodes if onPan fires after endDrag', () => {
    drag.startDrag(pointerEvent(400, 300), '1')
    const onPan = capturedOnPan.current!

    drag.endDrag(pointerEvent(400, 300), '1')
    moveNode.mockClear()

    onPan(5, 0)

    expect(moveNode).not.toHaveBeenCalled()
  })
})
