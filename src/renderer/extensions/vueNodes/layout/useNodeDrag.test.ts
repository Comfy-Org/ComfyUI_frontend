import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw } from 'vue'

import type { Positionable } from '@/lib/litegraph/src/interfaces'
import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { NodeLayout } from '@/renderer/core/layout/types'
import { toGroupId } from '@/types/groupId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

const ROOT_GRAPH_ID = vi.hoisted<UUID>(() => 'root-graph')

const testState = vi.hoisted(() => {
  return {
    mutationFns: {
      moveNode: vi.fn(),
      batchMoveNodes: vi.fn()
    },
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
    selectedNodes: new WeakSet<object>(),
    mockDs: { offset: [0, 0] as [number, number], scale: 1 }
  }
})

let canvasStore: ReturnType<typeof useCanvasStore>

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

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    isAppMode: { value: false },
    setMode: vi.fn()
  })
}))

vi.mock('@/scripts/app', () => ({ app: {} }))

vi.mock('@/core/graph/subgraph/promotionUtils', () => ({
  promoteRecommendedWidgets: vi.fn()
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: (item: unknown) =>
    typeof item === 'object' &&
    item !== null &&
    testState.selectedNodes.has(item)
}))

vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: () => testState.mutationFns
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

vi.mock('@vueuse/core', () => ({
  createSharedComposable: (fn: () => unknown) => fn,
  whenever: vi.fn()
}))

import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'

const node1 = toNodeId('1')

function pointerEvent(clientX: number, clientY: number): PointerEvent {
  const target = document.createElement('div')
  target.hasPointerCapture = vi.fn(() => false)
  target.setPointerCapture = vi.fn()
  return fromPartial<PointerEvent>({ clientX, clientY, target, pointerId: 1 })
}

function selectedNode(id: NodeId, x = 0, y = 0) {
  const pos: [number, number] = [x, y]
  const node = {
    id,
    pos,
    move(deltaX: number, deltaY: number) {
      pos[0] += deltaX
      pos[1] += deltaY
    }
  }
  const positionable = markRaw(fromPartial<Positionable>(node))
  testState.selectedNodes.add(positionable)
  return positionable
}

function groupAt(x: number, y: number) {
  const pos: [number, number] = [x, y]
  return {
    id: toGroupId(-1),
    pos,
    pinned: false,
    move(deltaX: number, deltaY: number) {
      if (this.pinned) return
      pos[0] += deltaX
      pos[1] += deltaY
    }
  }
}

function selectNodes(...nodeIds: NodeId[]) {
  canvasStore.selectedItems = nodeIds.map((id) => selectedNode(id))
}

function setNodeLayout(
  nodeId: NodeId,
  { position, size }: Pick<NodeLayout, 'position' | 'size'>
) {
  layoutStore.applyOperation({
    type: 'createNode',
    graphId: ROOT_GRAPH_ID,
    nodeId,
    layout: {
      id: nodeId,
      position,
      size,
      zIndex: 0,
      visible: true,
      bounds: { ...position, width: size.width, height: size.height }
    },
    timestamp: 0,
    source: LayoutSource.Vue,
    actor: 'test'
  })
}

beforeEach(() => {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
  canvasStore = useCanvasStore(pinia)
  canvasStore.currentGraph = fromPartial<LGraph>({
    rootGraph: { id: ROOT_GRAPH_ID }
  })
  canvasStore.selectedItems = []
  canvasStore.canvas = fromPartial<LGraphCanvas>({
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
  })
  layoutStore.resetForTests()
  vi.spyOn(layoutStore, 'batchUpdateNodeBounds')
  testState.nodeSnap.shouldSnap.mockReturnValue(false)
  testState.nodeSnap.applySnapToPosition.mockImplementation(
    (pos: { x: number; y: number }) => pos
  )
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

describe('useNodeDrag', () => {
  it('batches multi-node drag updates into one mutation call per frame', () => {
    selectNodes(node1, toNodeId('2'))
    setNodeLayout(node1, {
      position: { x: 100, y: 100 },
      size: { width: 200, height: 120 }
    })
    setNodeLayout(toNodeId('2'), {
      position: { x: 200, y: 180 },
      size: { width: 210, height: 130 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(pointerEvent(10, 20), node1)
    handleDrag(pointerEvent(30, 40), node1)
    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledTimes(1)
    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      [
        { nodeId: '1', position: { x: 120, y: 120 } },
        { nodeId: '2', position: { x: 220, y: 200 } }
      ]
    )
    expect(testState.mutationFns.moveNode).not.toHaveBeenCalled()
  })

  it('uses the same batched mutation path for single-node drags', () => {
    selectNodes(node1)
    setNodeLayout(node1, {
      position: { x: 50, y: 80 },
      size: { width: 180, height: 110 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(pointerEvent(5, 10), node1)
    handleDrag(pointerEvent(25, 30), node1)
    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledTimes(1)
    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      [{ nodeId: '1', position: { x: 70, y: 100 } }]
    )
    expect(testState.mutationFns.moveNode).not.toHaveBeenCalled()
  })

  it('moves selected non-node items without moving selected LiteGraph nodes', () => {
    const node = selectedNode(node1, 300, 400)
    const selectedGroup = groupAt(500, 600)
    canvasStore.selectedItems = [
      node,
      markRaw(fromPartial<Positionable>(selectedGroup))
    ]
    setNodeLayout(node1, {
      position: { x: 100, y: 100 },
      size: { width: 200, height: 120 }
    })

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(pointerEvent(10, 20), node1)
    handleDrag(pointerEvent(30, 50), node1)
    testState.requestAnimationFrameCallback?.(0)

    expect([...node.pos]).toEqual([300, 400])
    expect([...selectedGroup.pos]).toEqual([520, 630])
  })

  it('cancels pending RAF and applies snap updates on endDrag', () => {
    selectNodes(node1)
    setNodeLayout(node1, {
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
    handleDrag(pointerEvent(25, 30), node1)
    endDrag({} as PointerEvent, node1)

    expect(testState.cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(testState.cancelAnimationFrame).toHaveBeenCalledWith(1)
    expect(layoutStore.batchUpdateNodeBounds).toHaveBeenCalledTimes(1)
    expect(layoutStore.batchUpdateNodeBounds).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      [
        {
          nodeId: '1',
          bounds: {
            x: 55,
            y: 87,
            width: 180,
            height: 110
          }
        }
      ],
      { source: LayoutSource.Vue }
    )
  })
})

describe('useNodeDrag auto-pan', () => {
  beforeEach(() => {
    selectNodes(node1)
    setNodeLayout(node1, {
      position: { x: 100, y: 200 },
      size: { width: 200, height: 100 }
    })
    setNodeLayout(toNodeId('2'), {
      position: { x: 300, y: 400 },
      size: { width: 200, height: 100 }
    })
    testState.nodeSnap.shouldSnap.mockReturnValue(false)
    testState.nodeSnap.applySnapToPosition.mockImplementation(
      (pos: { x: number; y: number }) => pos
    )
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
    drag.startDrag(pointerEvent(750, 300), node1)

    drag.handleDrag(pointerEvent(760, 300), node1)
    testState.requestAnimationFrameCallback?.(0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenLastCalledWith(
      ROOT_GRAPH_ID,
      [{ nodeId: '1', position: { x: 110, y: 200 } }]
    )

    testState.mutationFns.batchMoveNodes.mockClear()

    testState.mockDs.offset[0] -= 5
    testState.capturedOnPan.current!(5, 0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledWith(
      ROOT_GRAPH_ID,
      [{ nodeId: '1', position: { x: 115, y: 200 } }]
    )
  })

  it('moves all selected nodes when auto-pan fires', () => {
    selectNodes(node1, toNodeId('2'))
    const drag = useNodeDrag()

    drag.startDrag(pointerEvent(750, 300), node1)
    drag.handleDrag(pointerEvent(760, 300), node1)
    testState.mutationFns.batchMoveNodes.mockClear()

    testState.mockDs.offset[0] -= 5
    testState.capturedOnPan.current!(5, 0)

    expect(testState.mutationFns.batchMoveNodes).toHaveBeenCalledTimes(1)
    const calls = testState.mutationFns.batchMoveNodes.mock.calls[0][1]
    const nodeIds = calls.map((u: { nodeId: string }) => u.nodeId)
    expect(nodeIds).toContain('1')
    expect(nodeIds).toContain('2')
  })

  it('starts auto-pan on handleDrag', () => {
    const drag = useNodeDrag()
    drag.startDrag(pointerEvent(400, 300), node1)

    drag.handleDrag(pointerEvent(790, 300), node1)

    const autoPan = testState.capturedAutoPanInstance.current
    if (!autoPan) throw new Error('Auto-pan controller was not created')
    expect(autoPan.start).toHaveBeenCalledTimes(1)
    expect(autoPan.updatePointer).toHaveBeenCalledWith(790, 300)
  })

  it('reuses auto-pan controller across handleDrag calls', () => {
    const drag = useNodeDrag()
    drag.startDrag(pointerEvent(400, 300), node1)

    drag.handleDrag(pointerEvent(790, 300), node1)
    const autoPan = testState.capturedAutoPanInstance.current
    if (!autoPan) throw new Error('Auto-pan controller was not created')

    testState.requestAnimationFrameCallback?.(0)
    drag.handleDrag(pointerEvent(795, 305), node1)

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
    drag.handleDrag(pointerEvent(400, 300), node1)
    expect(testState.capturedAutoPanInstance.current).not.toBeNull()

    drag.endDrag(pointerEvent(400, 300), node1)

    expect(testState.capturedAutoPanInstance.current!.stop).toHaveBeenCalled()
  })

  it('does not move nodes if onPan fires after endDrag', () => {
    const drag = useNodeDrag()
    drag.startDrag(pointerEvent(400, 300), node1)
    drag.handleDrag(pointerEvent(400, 300), node1)
    const onPan = testState.capturedOnPan.current!

    drag.endDrag(pointerEvent(400, 300), node1)
    testState.mutationFns.batchMoveNodes.mockClear()

    onPan(5, 0)

    expect(testState.mutationFns.batchMoveNodes).not.toHaveBeenCalled()
  })
})

describe('useNodeDrag non-node positionables', () => {
  function selectedGroupAt(x: number, y: number) {
    const group = groupAt(x, y)
    selectNodes(node1)
    canvasStore.selectedItems = [
      ...canvasStore.selectedItems,
      markRaw(fromPartial<Positionable>(group))
    ]
    return group
  }

  function dragNodeBy(delta: number) {
    setNodeLayout(node1, {
      position: { x: 0, y: 0 },
      size: { width: 100, height: 50 }
    })

    const { startDrag, handleDrag } = useNodeDrag()
    startDrag(pointerEvent(0, 0), node1)
    handleDrag(pointerEvent(delta, delta), node1)
    testState.requestAnimationFrameCallback?.(0)
  }

  it('leaves a pinned group where it is', () => {
    const group = selectedGroupAt(300, 400)
    group.pinned = true

    dragNodeBy(25)

    expect([...group.pos]).toEqual([300, 400])
  })

  it('carries non-node items along when auto-pan shifts the canvas', () => {
    const group = selectedGroupAt(300, 400)

    dragNodeBy(25)
    testState.capturedOnPan.current?.(10, 5)
    testState.requestAnimationFrameCallback?.(0)

    expect([...group.pos]).toEqual([335, 430])
  })
})
