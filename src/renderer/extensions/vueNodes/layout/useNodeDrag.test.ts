import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'

const testState = vi.hoisted(() => {
  return {
    selectedNodeIds: null as unknown as Ref<Set<string>>,
    selectedItems: null as unknown as Ref<unknown[]>,
    nodeLayouts: new Map<
      string,
      {
        position: { x: number; y: number }
        size: { width: number; height: number }
      }
    >(),
    mutationFns: {
      setSource: vi.fn(),
      moveNode: vi.fn(),
      batchMoveNodes: vi.fn()
    },
    requestAnimationFrameCallback: null as FrameRequestCallback | null
  }
})

vi.mock('pinia', () => ({
  storeToRefs: <T>(store: T) => store
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    selectedNodeIds: testState.selectedNodeIds,
    selectedItems: testState.selectedItems
  })
}))

vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: () => testState.mutationFns
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getNodeLayoutRef: (nodeId: string) =>
      ref(testState.nodeLayouts.get(nodeId) ?? null),
    batchUpdateNodeBounds: vi.fn()
  }
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useNodeSnap', () => ({
  useNodeSnap: () => ({
    shouldSnap: () => false,
    applySnapToPosition: (pos: { x: number; y: number }) => pos
  })
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useShiftKeySync', () => ({
  useShiftKeySync: () => ({
    trackShiftKey: () => () => {}
  })
}))

vi.mock('@/renderer/core/layout/transform/useTransformState', () => ({
  useTransformState: () => ({
    screenToCanvas: ({ x, y }: { x: number; y: number }) => ({ x, y })
  })
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphGroup: () => false
}))

import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'

describe('useNodeDrag', () => {
  beforeEach(() => {
    testState.selectedNodeIds = ref(new Set<string>())
    testState.selectedItems = ref<unknown[]>([])
    testState.nodeLayouts.clear()
    testState.mutationFns.setSource.mockReset()
    testState.mutationFns.moveNode.mockReset()
    testState.mutationFns.batchMoveNodes.mockReset()
    testState.requestAnimationFrameCallback = null

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      testState.requestAnimationFrameCallback = cb
      return 1
    })
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

    startDrag(
      {
        clientX: 10,
        clientY: 20
      } as PointerEvent,
      '1'
    )

    const target = document.createElement('div')
    target.hasPointerCapture = vi.fn(() => false)
    target.setPointerCapture = vi.fn()

    handleDrag(
      {
        clientX: 30,
        clientY: 40,
        target,
        pointerId: 1
      } as unknown as PointerEvent,
      '1'
    )

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

    startDrag(
      {
        clientX: 5,
        clientY: 10
      } as PointerEvent,
      '1'
    )

    const target = document.createElement('div')
    target.hasPointerCapture = vi.fn(() => false)
    target.setPointerCapture = vi.fn()

    handleDrag(
      {
        clientX: 25,
        clientY: 30,
        target,
        pointerId: 1
      } as unknown as PointerEvent,
      '1'
    )

    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledTimes(1)
    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 70, y: 100 } }
    ])
    expect(testState.mutationFns.moveNode).not.toHaveBeenCalled()
  })
})
