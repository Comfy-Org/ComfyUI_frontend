import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import {
  addNode,
  createCanvas,
  pointerEvent,
  selectedTitles
} from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import type { PointerEventOptions } from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'
import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
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

function onTarget(event: PointerEvent, target: Element): PointerEvent {
  Object.defineProperty(event, 'currentTarget', { value: target })
  return event
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
    expect(bringNodeToFront).toHaveBeenCalledWith(first.id)
  })

  it('right press does not clone or raise the node', () => {
    const { bringNodeToFront } = useNodeZIndex()
    const cloneNodes = vi.spyOn(LGraphCanvas, 'cloneNodes')

    press(handlers, 10, 10, { altKey: true, button: 2 })

    expect(cloneNodes).not.toHaveBeenCalled()
    expect(bringNodeToFront).not.toHaveBeenCalled()
  })

  it('raises the cloned node on alt press', async () => {
    const { bringNodeToFront } = useNodeZIndex()
    const graph = canvas.graph
    if (!graph) throw new Error('canvas graph is required')
    const clone = addNode(graph, 'Clone', 10, 10)
    vi.spyOn(LGraphCanvas, 'cloneNodes').mockReturnValue({
      created: [clone],
      links: new Map(),
      nodes: new Map(),
      reroutes: new Map(),
      subgraphs: new Map()
    })

    press(handlers, 10, 10, { altKey: true })
    await nextTick()

    expect(bringNodeToFront).toHaveBeenCalledWith(clone.id)
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

  it('uses press modifiers when movement starts a drag', () => {
    canvas.select(second)
    press(handlers, 10, 10)

    move(handlers, 10 + DRIFT + 1, 10, { shiftKey: true })

    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('captures the accepted pointer until release', () => {
    const target = document.createElement('div')
    let captured = false
    const setPointerCapture = vi
      .spyOn(target, 'setPointerCapture')
      .mockImplementation(() => {
        captured = true
      })
    vi.spyOn(target, 'hasPointerCapture').mockImplementation(() => captured)
    const releasePointerCapture = vi
      .spyOn(target, 'releasePointerCapture')
      .mockImplementation(() => {
        captured = false
      })
    const down = onTarget(pointerEvent('pointerdown', 10, 10), target)

    handlers.onPointerdown(down)
    release(handlers, 10, 10)

    expect(setPointerCapture).toHaveBeenCalledWith(1)
    expect(releasePointerCapture).toHaveBeenCalledWith(1)
    expect(captured).toBe(false)
  })

  it('captures a button press on the button', () => {
    const target = document.createElement('div')
    const button = target.appendChild(document.createElement('button'))
    const rootCapture = vi.spyOn(target, 'setPointerCapture')
    const buttonCapture = vi.spyOn(button, 'setPointerCapture')
    const down = onTarget(pointerEvent('pointerdown', 10, 10), target)
    Object.defineProperty(down, 'target', { value: button })

    handlers.onPointerdown(down)

    expect(rootCapture).not.toHaveBeenCalled()
    expect(buttonCapture).toHaveBeenCalledWith(1)
  })

  it('ignores events from pointers other than the press owner', () => {
    const { startDrag, handleDrag, endDrag } = useNodeDrag()
    press(handlers, 10, 10, { pointerId: 1 })

    move(handlers, 40, 10, { pointerId: 2 })
    release(handlers, 40, 10, { pointerId: 2 })

    expect(startDrag).not.toHaveBeenCalled()
    expect(handleDrag).not.toHaveBeenCalled()
    expect(endDrag).not.toHaveBeenCalled()
    move(handlers, 40, 10, { pointerId: 1 })
    expect(startDrag).toHaveBeenCalledOnce()
  })

  it('cancel while dragging ends the drag without snapping', () => {
    const { endDrag } = useNodeDrag()
    press(handlers, 10, 10)
    move(handlers, 40, 10)
    handlers.onPointercancel(pointerEvent('pointercancel', 40, 10))

    release(handlers, 40, 10)

    expect(endDrag).not.toHaveBeenCalled()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('clears terminal state when endDrag throws', () => {
    const { endDrag } = useNodeDrag()
    vi.mocked(endDrag).mockImplementationOnce(() => {
      throw new Error('end failed')
    })
    press(handlers, 10, 10)
    move(handlers, 40, 10)

    expect(() => release(handlers, 40, 10)).toThrow('end failed')

    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
    release(handlers, 40, 10)
    expect(endDrag).toHaveBeenCalledOnce()
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
    const { startDrag, handleDrag, endDrag } = useNodeDrag()
    const { bringNodeToFront } = useNodeZIndex()
    const { pointerHandlers } = useNodePointerInteractions(
      createNodeState({ id: second.id, flags: { pinned: true } })
    )
    press(pointerHandlers, 310, 10)
    move(pointerHandlers, 340, 10)
    release(pointerHandlers, 340, 10)

    expect(bringNodeToFront).not.toHaveBeenCalled()
    expect(startDrag).not.toHaveBeenCalled()
    expect(handleDrag).not.toHaveBeenCalled()
    expect(endDrag).not.toHaveBeenCalled()
    expect(selectedTitles(canvas)).toEqual(['Second'])
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
})
