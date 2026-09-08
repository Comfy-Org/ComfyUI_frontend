import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import {
  addNode,
  createCanvas,
  pointerEvent,
  selectedTitles
} from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import type { PointerEventOptions } from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'
import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { createNodeState } from '@/utils/__tests__/litegraphTestUtils'

const shouldHandleNodePointerEvents = ref(true)
const forwardEventToCanvas = vi.fn()

vi.mock<unknown>(
  import('@/renderer/core/canvas/useCanvasInteractions'),
  () => ({
    useCanvasInteractions: () => ({
      forwardEventToCanvas,
      shouldHandleNodePointerEvents
    })
  })
)

vi.mock<unknown>(
  import('@/renderer/extensions/vueNodes/layout/useNodeDrag'),
  () => {
    const drag = { startDrag: vi.fn(), handleDrag: vi.fn(), endDrag: vi.fn() }
    return { useNodeDrag: () => drag }
  }
)

vi.mock<unknown>(
  import('@/renderer/extensions/vueNodes/composables/useNodeZIndex'),
  () => {
    const bringNodeToFront = vi.fn()
    return { useNodeZIndex: () => ({ bringNodeToFront }) }
  }
)

const DRIFT = CanvasPointer.maxClickDrift

function setup() {
  const graph = new LGraph()
  const first = addNode(graph, 'First', 0, 0)
  const second = addNode(graph, 'Second', 300, 0)
  const canvas = createCanvas(graph)
  useCanvasStore().canvas = canvas
  const { pointerHandlers: firstHandlers } = useNodePointerInteractions(
    createNodeState({ id: first.id })
  )
  return { canvas, first, second, firstHandlers }
}

function press(
  handlers: ReturnType<typeof useNodePointerInteractions>['pointerHandlers'],
  x: number,
  y: number,
  options?: PointerEventOptions
) {
  handlers.onPointerdown(pointerEvent('pointerdown', x, y, options))
}

function release(
  handlers: ReturnType<typeof useNodePointerInteractions>['pointerHandlers'],
  x: number,
  y: number,
  options?: PointerEventOptions
) {
  handlers.onPointerup(pointerEvent('pointerup', x, y, options))
}

function move(
  handlers: ReturnType<typeof useNodePointerInteractions>['pointerHandlers'],
  x: number,
  y: number,
  options?: PointerEventOptions
) {
  handlers.onPointermove(pointerEvent('pointermove', x, y, options))
}

describe('useNodePointerInteractions', () => {
  let canvas: LGraphCanvas
  let handlers: ReturnType<typeof useNodePointerInteractions>['pointerHandlers']
  let first: ReturnType<typeof addNode>
  let second: ReturnType<typeof addNode>

  beforeEach(async () => {
    shouldHandleNodePointerEvents.value = true
    layoutStore.isDraggingVueNodes.value = false
    const fixture = setup()
    canvas = fixture.canvas
    first = fixture.first
    second = fixture.second
    handlers = fixture.firstHandlers
    await nextTick()
  })

  it('click replaces the selection on release', () => {
    canvas.select(second)
    press(handlers, 10, 10)
    expect(selectedTitles(canvas)).toEqual(['Second'])

    release(handlers, 10, 10)
    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('press brings the node to front before release', () => {
    const { bringNodeToFront } = useNodeZIndex()
    press(handlers, 10, 10)
    expect(bringNodeToFront).toHaveBeenCalledOnce()
  })

  it('shift and ctrl clicks toggle membership like the classic canvas', () => {
    canvas.select(second)
    press(handlers, 10, 10, { shiftKey: true })
    release(handlers, 10, 10, { shiftKey: true })
    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])

    press(handlers, 10, 10, { ctrlKey: true })
    release(handlers, 10, 10, { ctrlKey: true })
    expect(selectedTitles(canvas)).toEqual(['Second'])
  })

  it('a second click inside the double-click window still applies modifiers', () => {
    canvas.select(second)
    press(handlers, 10, 10, { shiftKey: true, timeStamp: 0 })
    release(handlers, 10, 10, { shiftKey: true, timeStamp: 10 })
    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])

    press(handlers, 10, 10, { ctrlKey: true, timeStamp: 100 })
    release(handlers, 10, 10, { ctrlKey: true, timeStamp: 110 })
    expect(selectedTitles(canvas)).toEqual(['Second'])
  })

  it('movement inside the click drift stays a click', () => {
    const { startDrag } = useNodeDrag()
    press(handlers, 10, 10)
    move(handlers, 10 + DRIFT, 10)
    release(handlers, 10 + DRIFT, 10)

    expect(startDrag).not.toHaveBeenCalled()
    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('movement past the click drift selects and drags without toggling on release', () => {
    const { startDrag, handleDrag, endDrag } = useNodeDrag()
    canvas.select(second)
    const down = pointerEvent('pointerdown', 10, 10, { shiftKey: true })
    handlers.onPointerdown(down)
    move(handlers, 10 + DRIFT + 1, 10, { shiftKey: true })

    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])
    expect(startDrag).toHaveBeenCalledWith(down, first.id)
    expect(handleDrag).toHaveBeenCalledOnce()
    expect(layoutStore.isDraggingVueNodes.value).toBe(true)

    release(handlers, 40, 10, { shiftKey: true })
    expect(endDrag).toHaveBeenCalledOnce()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])
  })

  it('cancel while dragging ends the drag without snapping', () => {
    const { endDrag } = useNodeDrag()
    press(handlers, 10, 10)
    move(handlers, 40, 10)
    handlers.onPointercancel(pointerEvent('pointercancel', 40, 10))

    expect(endDrag).not.toHaveBeenCalled()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('context menu while dragging cancels the drag and blocks the menu', () => {
    press(handlers, 10, 10)
    move(handlers, 40, 10)
    const menu = new MouseEvent('contextmenu', { button: 2, cancelable: true })
    handlers.onContextmenu(menu)

    expect(menu.defaultPrevented).toBe(true)
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('right press neither selects nor drags', () => {
    const { startDrag } = useNodeDrag()
    press(handlers, 10, 10, { button: 2 })
    move(handlers, 40, 10, { button: 2 })
    release(handlers, 40, 10, { button: 2 })

    expect(startDrag).not.toHaveBeenCalled()
    expect(selectedTitles(canvas)).toEqual([])
  })

  it('pinned node selects on click but never drags', () => {
    const { startDrag } = useNodeDrag()
    const { bringNodeToFront } = useNodeZIndex()
    const { pointerHandlers } = useNodePointerInteractions(
      createNodeState({ id: second.id, flags: { pinned: true } })
    )
    press(pointerHandlers, 310, 10)
    move(pointerHandlers, 340, 10)
    release(pointerHandlers, 340, 10)

    expect(bringNodeToFront).not.toHaveBeenCalled()
    expect(startDrag).not.toHaveBeenCalled()
    expect(selectedTitles(canvas)).toEqual(['Second'])
  })

  it('agent node selection mode toggles membership on click and ignores drags', () => {
    const { startDrag } = useNodeDrag()
    useAgentNodeSelectionStore().isActive = true
    canvas.multi_select = true
    canvas.selectOnly = true
    canvas.select(second)

    press(handlers, 10, 10)
    move(handlers, 40, 10)
    release(handlers, 40, 10)
    expect(startDrag).not.toHaveBeenCalled()
    expect(selectedTitles(canvas)).toEqual(['Second'])

    press(handlers, 10, 10)
    release(handlers, 10, 10)
    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])
  })

  it('forwards presses to the canvas while node pointer events are disabled', () => {
    shouldHandleNodePointerEvents.value = false
    const down = pointerEvent('pointerdown', 10, 10)
    handlers.onPointerdown(down)
    release(handlers, 10, 10)

    expect(forwardEventToCanvas).toHaveBeenCalledWith(down)
    expect(selectedTitles(canvas)).toEqual([])
  })

  it('a move without a press does nothing', () => {
    const { startDrag } = useNodeDrag()
    move(handlers, 200, 200, { shiftKey: true })

    expect(startDrag).not.toHaveBeenCalled()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('window blur while dragging ends the drag without snapping', () => {
    const { endDrag } = useNodeDrag()
    press(handlers, 10, 10)
    move(handlers, 40, 10)

    window.dispatchEvent(new Event('blur'))

    expect(endDrag).not.toHaveBeenCalled()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('hidden document while pressed discards the click', () => {
    press(handlers, 10, 10)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    release(handlers, 10, 10)

    expect(selectedTitles(canvas)).toEqual([])
  })

  it('disposing the scope while dragging ends the drag', () => {
    const scope = effectScope()
    const scoped = scope.run(() =>
      useNodePointerInteractions(createNodeState({ id: second.id }))
    )!
    press(scoped.pointerHandlers, 310, 10)
    move(scoped.pointerHandlers, 340, 10)
    expect(layoutStore.isDraggingVueNodes.value).toBe(true)

    scope.stop()

    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })
})
