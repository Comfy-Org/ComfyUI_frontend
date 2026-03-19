import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'
import type * as VueUseModule from '@vueuse/core'

import type { Bounds, NodeLayout } from '@/renderer/core/layout/types'

function getStoredNodeBounds(
  layout: Pick<NodeLayout, 'position' | 'size'>
): Bounds {
  return {
    x: layout.position.x,
    y: layout.position.y,
    width: layout.size.width,
    height: layout.size.height
  }
}

function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

const testState = vi.hoisted(() => {
  return {
    selectedNodeIds: null as unknown as Ref<Set<string>>,
    selectedItems: null as unknown as Ref<unknown[]>,
    nodeLayouts: new Map<string, Pick<NodeLayout, 'position' | 'size'>>(),
    canvas: {
      setDirty: vi.fn()
    },
    settingValues: {
      'Comfy.Canvas.AlignNodesWhileDragging': false
    } as Record<string, boolean>,
    mutationFns: {
      setSource: vi.fn(),
      moveNode: vi.fn(),
      batchMoveNodes: vi.fn()
    },
    batchUpdateNodeBounds: vi.fn(),
    vueDragSnapGuides: { value: [] as unknown[] } as Ref<unknown[]>,
    nodeSnap: {
      shouldSnap: vi.fn((event: PointerEvent) => event.shiftKey),
      applySnapToPosition: vi.fn((pos: { x: number; y: number }) => pos)
    },
    cancelAnimationFrame: vi.fn(),
    requestAnimationFrameCallback: null as FrameRequestCallback | null
  }
})

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof VueUseModule>('@vueuse/core')

  return {
    ...actual,
    createSharedComposable: <TArgs extends unknown[], TResult>(
      composable: (...args: TArgs) => TResult
    ) => composable
  }
})

vi.mock('pinia', () => ({
  storeToRefs: <T>(store: T) => store
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    selectedNodeIds: testState.selectedNodeIds,
    selectedItems: testState.selectedItems,
    canvas: testState.canvas
  })
}))

vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: () => testState.mutationFns
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getNodeLayoutRef: (nodeId: string) =>
      ref(testState.nodeLayouts.get(nodeId) ?? null),
    queryNodesInBounds: (bounds: Bounds) =>
      Array.from(testState.nodeLayouts.entries())
        .filter(([, layout]) =>
          boundsIntersect(getStoredNodeBounds(layout), bounds)
        )
        .map(([nodeId]) => nodeId),
    batchUpdateNodeBounds: testState.batchUpdateNodeBounds,
    vueDragSnapGuides: testState.vueDragSnapGuides
  }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => testState.settingValues[key]
  })
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
    camera: { z: 1 },
    screenToCanvas: ({ x, y }: { x: number; y: number }) => ({ x, y })
  })
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphGroup: () => false
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LiteGraph: {
    NODE_TITLE_HEIGHT: 30
  }
}))

import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'

describe('useNodeDrag', () => {
  beforeEach(() => {
    testState.selectedNodeIds = ref(new Set<string>())
    testState.selectedItems = ref<unknown[]>([])
    testState.nodeLayouts.clear()
    testState.canvas.setDirty.mockReset()
    testState.settingValues['Comfy.Canvas.AlignNodesWhileDragging'] = false
    testState.mutationFns.setSource.mockReset()
    testState.mutationFns.moveNode.mockReset()
    testState.mutationFns.batchMoveNodes.mockReset()
    testState.batchUpdateNodeBounds.mockReset()
    testState.vueDragSnapGuides.value = []
    testState.nodeSnap.shouldSnap.mockReset()
    testState.nodeSnap.shouldSnap.mockImplementation(
      (event: PointerEvent) => event.shiftKey
    )
    testState.nodeSnap.applySnapToPosition.mockReset()
    testState.nodeSnap.applySnapToPosition.mockImplementation(
      (pos: { x: number; y: number }) => pos
    )
    testState.cancelAnimationFrame.mockReset()
    testState.requestAnimationFrameCallback = null

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

  it('uses the latest pointer event when moves arrive before the next frame', () => {
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

    handleDrag(
      {
        clientX: 45,
        clientY: 60,
        target,
        pointerId: 1
      } as unknown as PointerEvent,
      '1'
    )

    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledTimes(1)
    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 90, y: 130 } }
    ])
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

  it('snaps a dragged multi-selection to matching node edges', () => {
    testState.settingValues['Comfy.Canvas.AlignNodesWhileDragging'] = true
    testState.selectedNodeIds.value = new Set(['1', '2'])
    testState.nodeLayouts.set('1', {
      position: { x: 0, y: 40 },
      size: { width: 100, height: 60 }
    })
    testState.nodeLayouts.set('2', {
      position: { x: 40, y: 40 },
      size: { width: 100, height: 60 }
    })
    testState.nodeLayouts.set('3', {
      position: { x: 200, y: 40 },
      size: { width: 100, height: 60 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag({ clientX: 0, clientY: 0 } as PointerEvent, '1')
    testState.canvas.setDirty.mockClear()

    const target = document.createElement('div')
    target.hasPointerCapture = vi.fn(() => false)
    target.setPointerCapture = vi.fn()

    handleDrag(
      {
        clientX: 193,
        clientY: 0,
        target,
        pointerId: 1
      } as unknown as PointerEvent,
      '1'
    )

    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 200, y: 40 } },
      { nodeId: '2', position: { x: 240, y: 40 } }
    ])
    expect(testState.vueDragSnapGuides.value).toContainEqual({
      axis: 'vertical',
      coordinate: 200,
      start: 10,
      end: 100
    })
    expect(testState.canvas.setDirty).toHaveBeenCalledWith(true)
  })

  it('excludes selected nodes from alignment candidates', () => {
    testState.settingValues['Comfy.Canvas.AlignNodesWhileDragging'] = true
    testState.selectedNodeIds.value = new Set(['1', '2'])
    testState.nodeLayouts.set('1', {
      position: { x: 0, y: 40 },
      size: { width: 100, height: 60 }
    })
    testState.nodeLayouts.set('2', {
      position: { x: 60, y: 40 },
      size: { width: 100, height: 60 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag({ clientX: 0, clientY: 0 } as PointerEvent, '1')

    const target = document.createElement('div')
    target.hasPointerCapture = vi.fn(() => false)
    target.setPointerCapture = vi.fn()

    handleDrag(
      {
        clientX: 63,
        clientY: 0,
        target,
        pointerId: 1
      } as unknown as PointerEvent,
      '1'
    )

    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 63, y: 40 } },
      { nodeId: '2', position: { x: 123, y: 40 } }
    ])
    expect(testState.vueDragSnapGuides.value).toEqual([])
  })

  it('only snaps against nearby nodes returned by the spatial query', () => {
    testState.settingValues['Comfy.Canvas.AlignNodesWhileDragging'] = true
    testState.selectedNodeIds.value = new Set(['1'])
    testState.nodeLayouts.set('1', {
      position: { x: 0, y: 40 },
      size: { width: 100, height: 60 }
    })
    testState.nodeLayouts.set('2', {
      position: { x: 200, y: 320 },
      size: { width: 100, height: 60 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag({ clientX: 0, clientY: 0 } as PointerEvent, '1')

    const target = document.createElement('div')
    target.hasPointerCapture = vi.fn(() => false)
    target.setPointerCapture = vi.fn()

    handleDrag(
      {
        clientX: 193,
        clientY: 0,
        target,
        pointerId: 1
      } as unknown as PointerEvent,
      '1'
    )

    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 193, y: 40 } }
    ])
    expect(testState.vueDragSnapGuides.value).toEqual([])
  })

  it('suppresses alignment snapping when grid snapping is active', () => {
    testState.settingValues['Comfy.Canvas.AlignNodesWhileDragging'] = true
    testState.selectedNodeIds.value = new Set(['1'])
    testState.nodeLayouts.set('1', {
      position: { x: 0, y: 40 },
      size: { width: 100, height: 60 }
    })
    testState.nodeLayouts.set('2', {
      position: { x: 200, y: 40 },
      size: { width: 100, height: 60 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag({ clientX: 0, clientY: 0 } as PointerEvent, '1')

    const target = document.createElement('div')
    target.hasPointerCapture = vi.fn(() => false)
    target.setPointerCapture = vi.fn()

    handleDrag(
      {
        clientX: 193,
        clientY: 0,
        shiftKey: true,
        target,
        pointerId: 1
      } as unknown as PointerEvent,
      '1'
    )

    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 193, y: 40 } }
    ])
    expect(testState.vueDragSnapGuides.value).toEqual([])
  })

  it('does not move an unrelated selection when dragging an unselected node', () => {
    testState.settingValues['Comfy.Canvas.AlignNodesWhileDragging'] = true
    testState.selectedNodeIds.value = new Set(['2'])
    testState.nodeLayouts.set('1', {
      position: { x: 0, y: 40 },
      size: { width: 100, height: 60 }
    })
    testState.nodeLayouts.set('2', {
      position: { x: 200, y: 40 },
      size: { width: 100, height: 60 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag({ clientX: 0, clientY: 0 } as PointerEvent, '1')

    const target = document.createElement('div')
    target.hasPointerCapture = vi.fn(() => false)
    target.setPointerCapture = vi.fn()

    handleDrag(
      {
        clientX: 193,
        clientY: 0,
        target,
        pointerId: 1
      } as unknown as PointerEvent,
      '1'
    )

    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 200, y: 40 } }
    ])
  })

  it('snaps unselected drags using only the dragged node bounds', () => {
    testState.settingValues['Comfy.Canvas.AlignNodesWhileDragging'] = true
    testState.selectedNodeIds.value = new Set(['2', '3'])
    testState.nodeLayouts.set('1', {
      position: { x: 0, y: 40 },
      size: { width: 100, height: 60 }
    })
    testState.nodeLayouts.set('2', {
      position: { x: -500, y: 40 },
      size: { width: 100, height: 60 }
    })
    testState.nodeLayouts.set('3', {
      position: { x: 400, y: 40 },
      size: { width: 100, height: 60 }
    })
    testState.nodeLayouts.set('4', {
      position: { x: 200, y: 40 },
      size: { width: 100, height: 60 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag({ clientX: 0, clientY: 0 } as PointerEvent, '1')

    const target = document.createElement('div')
    target.hasPointerCapture = vi.fn(() => false)
    target.setPointerCapture = vi.fn()

    handleDrag(
      {
        clientX: 193,
        clientY: 0,
        target,
        pointerId: 1
      } as unknown as PointerEvent,
      '1'
    )

    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith([
      { nodeId: '1', position: { x: 200, y: 40 } }
    ])
    expect(testState.vueDragSnapGuides.value).toContainEqual({
      axis: 'vertical',
      coordinate: 200,
      start: 10,
      end: 100
    })
  })

  it('skips redraw when clearing already-empty snap guides', () => {
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

    expect(testState.canvas.setDirty).not.toHaveBeenCalled()
  })
})
