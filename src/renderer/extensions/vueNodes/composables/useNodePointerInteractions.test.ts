import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, effectScope, nextTick, ref } from 'vue'

import {
  addNode,
  createCanvas,
  pointerEvent,
  selectedTitles
} from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import type {
  PointerEventOptions,
  PointerEventType
} from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { LGraph, LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { Positionable } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'
import type { NodeState } from '@/types/nodeState'
import { createNodeState } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'))

vi.mock(import('@/renderer/extensions/vueNodes/layout/useNodeDrag'), () => {
  const drag: ReturnType<typeof useNodeDrag> = {
    startDrag: vi.fn(),
    handleDrag: vi.fn(),
    endDrag: vi.fn(),
    cancelDrag: vi.fn()
  }
  return { useNodeDrag: () => drag }
})

vi.mock(
  import('@/renderer/extensions/vueNodes/composables/useNodeZIndex'),
  () => {
    const zIndex: ReturnType<typeof useNodeZIndex> = {
      bringNodeToFront: vi.fn()
    }
    return { useNodeZIndex: () => zIndex }
  }
)

const DRIFT = CanvasPointer.maxClickDrift

async function setup() {
  layoutStore.isDraggingVueNodes.value = false
  const graph = new LGraph()
  const first = addNode(graph, 'First', 0, 0)
  const second = addNode(graph, 'Second', 300, 0)
  const canvas = createCanvas(graph)
  useCanvasStore().canvas = canvas
  await nextTick()
  return { graph, canvas, first, second }
}

function mountNode(nodeState: NodeState) {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const interactions = scope.run(() => useNodePointerInteractions(nodeState))
  if (!interactions) throw new Error('interactions require an active scope')
  const element = document.createElement('div')
  const { pointerHandlers } = interactions
  element.addEventListener('pointerdown', pointerHandlers.onPointerdown)
  element.addEventListener('pointermove', pointerHandlers.onPointermove)
  element.addEventListener('pointerup', pointerHandlers.onPointerup)
  element.addEventListener('pointercancel', pointerHandlers.onPointercancel)
  element.addEventListener('contextmenu', pointerHandlers.onContextmenu)

  function dispatch(
    type: PointerEventType,
    x: number,
    y: number,
    options?: PointerEventOptions
  ) {
    const event = pointerEvent(type, x, y, options)
    element.dispatchEvent(event)
    return event
  }

  return {
    element,
    scope,
    pointerHandlers,
    press: (x: number, y: number, options?: PointerEventOptions) =>
      dispatch('pointerdown', x, y, options),
    move: (x: number, y: number, options?: PointerEventOptions) =>
      dispatch('pointermove', x, y, options),
    release: (x: number, y: number, options?: PointerEventOptions) =>
      dispatch('pointerup', x, y, options),
    cancel: (options?: PointerEventOptions) =>
      dispatch('pointercancel', 0, 0, options)
  }
}

function contextMenuOn(element: Element) {
  const menuHandler = vi.fn()
  element.addEventListener('contextmenu', menuHandler)
  const menu = new MouseEvent('contextmenu', { button: 2, cancelable: true })
  element.dispatchEvent(menu)
  return { menu, menuHandler }
}

function controlNodePointerEvents() {
  const handles = ref(true)
  useCanvasInteractions().shouldHandleNodePointerEvents = computed(
    () => handles.value
  )
  return () => {
    handles.value = false
  }
}

describe('useNodePointerInteractions', () => {
  it('click replaces the selection on release', async () => {
    const { canvas, first, second } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))
    canvas.select(second)

    node.press(10, 10)
    expect(selectedTitles(canvas)).toEqual(['Second'])

    node.release(10, 10)
    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it.for([
    {
      click: 'a plain click replacing the selection',
      modifiers: {},
      preselect: ['Second'],
      emitted: [[], ['First']]
    },
    {
      click: 'a shift click adding a node',
      modifiers: { shiftKey: true },
      preselect: ['Second'],
      emitted: [['First', 'Second']]
    },
    {
      click: 'a ctrl click removing a node',
      modifiers: { ctrlKey: true },
      preselect: ['First', 'Second'],
      emitted: [['Second']]
    }
  ])(
    '$click reports selection changes like the classic canvas',
    async ({ modifiers, preselect, emitted }) => {
      const { canvas, first, second } = await setup()
      const node = mountNode(createNodeState({ id: first.id }))
      const byTitle: Record<string, LGraphNode> = {
        First: first,
        Second: second
      }
      canvas.selectItems(preselect.map((title) => byTitle[title]))
      const reported: Positionable[][] = []
      canvas.onSelectionChange = (selected) => {
        reported.push(Object.values(selected))
      }

      node.press(10, 10, modifiers)
      node.release(10, 10, modifiers)

      expect(reported).toEqual(
        emitted.map((titles) => titles.map((title) => byTitle[title]))
      )
    }
  )

  it('press brings the node to front before release', async () => {
    const { first } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))

    node.press(10, 10)

    expect(useNodeZIndex().bringNodeToFront).toHaveBeenCalledWith(first.id)
  })

  it('right press neither clones, raises, selects nor drags', async () => {
    const { canvas, first } = await setup()
    LiteGraph.alt_drag_do_clone_nodes = true
    onTestFinished(() => {
      LiteGraph.alt_drag_do_clone_nodes = false
    })
    const cloneNodes = vi.spyOn(LGraphCanvas, 'cloneNodes')
    const node = mountNode(createNodeState({ id: first.id }))

    node.press(10, 10, { altKey: true, button: 2 })
    node.move(40, 10, { button: 2 })
    node.release(40, 10, { button: 2 })

    expect(cloneNodes).not.toHaveBeenCalled()
    expect(useNodeZIndex().bringNodeToFront).not.toHaveBeenCalled()
    expect(useNodeDrag().startDrag).not.toHaveBeenCalled()
    expect(selectedTitles(canvas)).toEqual([])
  })

  it('alt press does not clone while alt-drag cloning is disabled', async () => {
    const { canvas, first } = await setup()
    const cloneNodes = vi.spyOn(LGraphCanvas, 'cloneNodes')
    const node = mountNode(createNodeState({ id: first.id }))

    node.press(10, 10, { altKey: true })
    node.release(10, 10, { altKey: true })

    expect(cloneNodes).not.toHaveBeenCalled()
    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('alt press clones the node and selects, drags and raises the clone', async () => {
    const { graph, canvas, first } = await setup()
    LiteGraph.alt_drag_do_clone_nodes = true
    onTestFinished(() => {
      LiteGraph.alt_drag_do_clone_nodes = false
    })
    const clone = addNode(graph, 'Clone', 10, 10)
    vi.spyOn(LGraphCanvas, 'cloneNodes').mockReturnValue({
      created: [clone],
      links: new Map(),
      nodes: new Map(),
      reroutes: new Map(),
      subgraphs: new Map()
    })
    const { bringNodeToFront } = useNodeZIndex()
    const node = mountNode(createNodeState({ id: first.id }))

    const down = node.press(10, 10, { altKey: true })
    expect(bringNodeToFront).not.toHaveBeenCalled()
    await nextTick()
    node.move(10 + DRIFT + 1, 10, { altKey: true })

    expect(bringNodeToFront).toHaveBeenCalledExactlyOnceWith(clone.id)
    expect(useNodeDrag().startDrag).toHaveBeenCalledWith(down, clone.id, false)
    expect(selectedTitles(canvas)).toEqual(['Clone'])
  })

  it('click selection uses the press modifiers, not the release modifiers', async () => {
    const { canvas, first, second } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))
    canvas.select(second)

    node.press(10, 10, { shiftKey: true })
    node.release(10, 10)
    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])

    node.press(10, 10, { ctrlKey: true })
    node.release(10, 10)
    expect(selectedTitles(canvas)).toEqual(['Second'])
  })

  it.for([
    { name: 'plain', modifiers: {}, selected: ['First'] },
    { name: 'ctrl', modifiers: { ctrlKey: true }, selected: ['Second'] }
  ])(
    'a $name second click inside the double-click window is a click',
    async ({ modifiers, selected }) => {
      const { canvas, first, second } = await setup()
      const node = mountNode(createNodeState({ id: first.id }))
      canvas.select(second)
      node.press(10, 10, { shiftKey: true, timeStamp: 0 })
      node.release(10, 10, { shiftKey: true })

      node.press(10, 10, { ...modifiers, timeStamp: 100 })
      node.release(10, 10, modifiers)

      expect(selectedTitles(canvas)).toEqual(selected)
    }
  )

  it('movement inside the click drift stays a click and never flags a drag', async () => {
    const { canvas, first } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))

    node.press(10, 10)
    node.move(10 + DRIFT, 10)
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
    node.release(10 + DRIFT, 10)

    expect(useNodeDrag().startDrag).not.toHaveBeenCalled()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('honours a non-default click drift', async () => {
    const { canvas, first } = await setup()
    const defaultDrift = CanvasPointer.maxClickDrift
    CanvasPointer.maxClickDrift = 10
    onTestFinished(() => {
      CanvasPointer.maxClickDrift = defaultDrift
    })
    const node = mountNode(createNodeState({ id: first.id }))

    node.press(10, 10)
    node.move(18, 10)
    node.release(18, 10)

    expect(useNodeDrag().startDrag).not.toHaveBeenCalled()
    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('movement past the click drift selects and drags without toggling on release', async () => {
    const { canvas, first, second } = await setup()
    const { startDrag, handleDrag, endDrag } = useNodeDrag()
    const node = mountNode(createNodeState({ id: first.id }))
    canvas.select(second)

    const down = node.press(10, 10, { shiftKey: true })
    node.move(10 + DRIFT + 1, 10, { shiftKey: true })

    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])
    expect(startDrag).toHaveBeenCalledWith(down, first.id, true)
    expect(handleDrag).toHaveBeenCalledOnce()
    expect(layoutStore.isDraggingVueNodes.value).toBe(true)

    const up = node.release(40, 10, { shiftKey: true })
    expect(endDrag).toHaveBeenCalledExactlyOnceWith(up, first.id)
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])
  })

  it('plain drag of a selected node keeps the multi-selection', async () => {
    const { canvas, first, second } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))
    canvas.selectItems([first, second])

    node.press(10, 10)
    node.move(10 + DRIFT + 1, 10)

    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])
  })

  it('uses press modifiers when movement starts a drag', async () => {
    const { canvas, first, second } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))
    canvas.select(second)

    node.press(10, 10)
    node.move(10 + DRIFT + 1, 10, { shiftKey: true })

    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('uses current shift state when a drag starts', async () => {
    const { canvas, first, second } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))
    canvas.select(second)

    const down = node.press(10, 10, { shiftKey: true })
    node.move(10 + DRIFT + 1, 10)

    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])
    expect(useNodeDrag().startDrag).toHaveBeenCalledWith(down, first.id, false)
  })

  it('captures the pressed pointer until release', async () => {
    const { first } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))

    node.press(10, 10)
    expect(node.element.hasPointerCapture(1)).toBe(true)

    node.release(10, 10)
    expect(node.element.hasPointerCapture(1)).toBe(false)
  })

  it('captures a button press on the button', async () => {
    const { first } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))
    const button = node.element.appendChild(document.createElement('button'))

    button.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        buttons: 1,
        pointerId: 1
      })
    )

    expect(node.element.hasPointerCapture(1)).toBe(false)
    expect(button.hasPointerCapture(1)).toBe(true)
  })

  it('lost pointer capture cancels the drag and suppresses release', async () => {
    const { first } = await setup()
    const { endDrag, cancelDrag } = useNodeDrag()
    const node = mountNode(createNodeState({ id: first.id }))
    node.press(10, 10)
    node.move(40, 10)

    node.element.releasePointerCapture(1)
    node.element.dispatchEvent(
      new PointerEvent('lostpointercapture', { pointerId: 1 })
    )
    node.release(40, 10)

    expect(cancelDrag).toHaveBeenCalledOnce()
    expect(endDrag).not.toHaveBeenCalled()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('ignores lost pointer capture from another pointer', async () => {
    const { first } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))
    node.press(10, 10)

    node.element.dispatchEvent(
      new PointerEvent('lostpointercapture', { pointerId: 2 })
    )
    node.move(40, 10)

    expect(useNodeDrag().startDrag).toHaveBeenCalledOnce()
  })

  it('ignores events from pointers other than the press owner', async () => {
    const { canvas, first } = await setup()
    const { startDrag, handleDrag, endDrag } = useNodeDrag()
    const node = mountNode(createNodeState({ id: first.id }))
    const down = node.press(10, 10, { pointerId: 1 })

    node.press(60, 10, { pointerId: 2 })
    node.move(40, 10, { pointerId: 2 })
    node.release(40, 10, { pointerId: 2 })

    expect(startDrag).not.toHaveBeenCalled()
    expect(handleDrag).not.toHaveBeenCalled()
    expect(endDrag).not.toHaveBeenCalled()
    node.move(40, 10, { pointerId: 1 })
    expect(startDrag).toHaveBeenCalledExactlyOnceWith(down, first.id, false)
    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('a move without the primary button ends a press whose release was lost', async () => {
    const { first } = await setup()
    const { handleDrag, endDrag } = useNodeDrag()
    const node = mountNode(createNodeState({ id: first.id }))
    node.press(10, 10)
    node.move(40, 10)

    node.move(50, 10, { buttons: 0 })
    node.move(60, 10)

    expect(endDrag).toHaveBeenCalledOnce()
    expect(handleDrag).toHaveBeenCalledOnce()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('a new press from the same pointer replaces a press whose release was lost', async () => {
    const { canvas, first, second } = await setup()
    const { cancelDrag } = useNodeDrag()
    const node = mountNode(createNodeState({ id: first.id }))
    node.press(10, 10)
    node.move(40, 10)
    canvas.select(second)

    node.press(10, 10)
    expect(cancelDrag).toHaveBeenCalledOnce()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
    node.release(10, 10)

    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('a press on another node from the same pointer cancels a press whose release was lost', async () => {
    const { first, second } = await setup()
    const { cancelDrag, handleDrag, startDrag } = useNodeDrag()
    const stale = mountNode(createNodeState({ id: first.id }))
    const next = mountNode(createNodeState({ id: second.id }))
    stale.press(10, 10)
    stale.move(40, 10)

    next.press(310, 10)
    expect(cancelDrag).toHaveBeenCalledOnce()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
    stale.move(80, 10)

    expect(handleDrag).toHaveBeenCalledOnce()
    next.move(350, 10)
    expect(vi.mocked(startDrag).mock.lastCall?.[1]).toBe(second.id)
    expect(layoutStore.isDraggingVueNodes.value).toBe(true)
  })

  it.for(['pointercancel', 'pointerup'] as const)(
    "another pointer's %s on another node leaves the drag running",
    async (type) => {
      const { first, second } = await setup()
      const { endDrag, cancelDrag } = useNodeDrag()
      const dragged = mountNode(createNodeState({ id: first.id }))
      const other = mountNode(createNodeState({ id: second.id }))
      dragged.press(10, 10, { pointerId: 1 })
      dragged.move(40, 10, { pointerId: 1 })

      other.press(310, 10, { pointerId: 2 })
      other.element.dispatchEvent(pointerEvent(type, 310, 10, { pointerId: 2 }))

      expect(endDrag).not.toHaveBeenCalled()
      expect(cancelDrag).not.toHaveBeenCalled()
      expect(layoutStore.isDraggingVueNodes.value).toBe(true)
    }
  )

  it('cancel while dragging cancels the drag without ending it', async () => {
    const { canvas, first } = await setup()
    const { endDrag, cancelDrag } = useNodeDrag()
    const node = mountNode(createNodeState({ id: first.id }))
    node.press(10, 10)
    node.move(40, 10)

    node.cancel()
    node.release(40, 10)

    expect(cancelDrag).toHaveBeenCalledOnce()
    expect(endDrag).not.toHaveBeenCalled()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('clears terminal state when endDrag throws', async () => {
    const { first } = await setup()
    const { endDrag } = useNodeDrag()
    vi.mocked(endDrag).mockImplementationOnce(() => {
      throw new Error('end failed')
    })
    const node = mountNode(createNodeState({ id: first.id }))
    node.press(10, 10)
    node.move(40, 10)

    expect(() =>
      node.pointerHandlers.onPointerup(pointerEvent('pointerup', 40, 10))
    ).toThrow('end failed')

    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
    node.release(40, 10)
    expect(endDrag).toHaveBeenCalledOnce()
  })

  it('context menu while dragging blocks the node menu and cancels the drag', async () => {
    const { first } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))
    node.press(10, 10)
    node.move(40, 10)

    const { menu, menuHandler } = contextMenuOn(node.element)

    expect(menu.defaultPrevented).toBe(true)
    expect(menuHandler).not.toHaveBeenCalled()
    expect(useNodeDrag().cancelDrag).toHaveBeenCalledOnce()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('context menu during a press that has not dragged reaches the node menu', async () => {
    const { first } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))
    node.press(10, 10)

    const { menu, menuHandler } = contextMenuOn(node.element)

    expect(menu.defaultPrevented).toBe(false)
    expect(menuHandler).toHaveBeenCalledOnce()
    expect(useNodeDrag().cancelDrag).not.toHaveBeenCalled()
  })

  it('pinned node selects on click without raising or capturing', async () => {
    const { canvas, second } = await setup()
    const node = mountNode(
      createNodeState({ id: second.id, flags: { pinned: true } })
    )

    node.press(310, 10)
    expect(node.element.hasPointerCapture(1)).toBe(false)
    node.release(310, 10)

    expect(useNodeZIndex().bringNodeToFront).not.toHaveBeenCalled()
    expect(useNodeDrag().startDrag).not.toHaveBeenCalled()
    expect(selectedTitles(canvas)).toEqual(['Second'])
  })

  it('does not start dragging a node pinned after pointerdown', async () => {
    const { second } = await setup()
    const { startDrag, handleDrag, endDrag } = useNodeDrag()
    const nodeState = createNodeState({ id: second.id })
    const node = mountNode(nodeState)
    node.press(310, 10)

    nodeState.flags.pinned = true
    node.move(340, 10)
    node.release(340, 10)

    expect(startDrag).not.toHaveBeenCalled()
    expect(handleDrag).not.toHaveBeenCalled()
    expect(endDrag).not.toHaveBeenCalled()
  })

  it('stops moving a node pinned during a drag and ends the drag without a node to snap', async () => {
    const { second } = await setup()
    const { startDrag, handleDrag, endDrag } = useNodeDrag()
    const nodeState = createNodeState({ id: second.id })
    const node = mountNode(nodeState)
    node.press(310, 10)
    node.move(340, 10)

    nodeState.flags.pinned = true
    node.move(350, 10)
    const up = node.release(350, 10)

    expect(startDrag).toHaveBeenCalledOnce()
    expect(handleDrag).toHaveBeenCalledOnce()
    expect(endDrag).toHaveBeenCalledExactlyOnceWith(up, undefined)
  })

  it('forwards presses to the canvas while node pointer events are disabled', async () => {
    const { canvas, first } = await setup()
    useCanvasInteractions().shouldHandleNodePointerEvents = computed(
      () => false
    )
    const node = mountNode(createNodeState({ id: first.id }))

    const down = node.press(10, 10)
    const up = node.release(10, 10)

    const { forwardEventToCanvas } = useCanvasInteractions()
    expect(forwardEventToCanvas).toHaveBeenCalledWith(down)
    expect(forwardEventToCanvas).toHaveBeenCalledWith(up)
    expect(selectedTitles(canvas)).toEqual([])
  })

  it('a release after the canvas turns read-only ends a drag with snapping', async () => {
    const { first } = await setup()
    const disable = controlNodePointerEvents()
    const node = mountNode(createNodeState({ id: first.id }))
    node.press(10, 10)
    node.move(40, 10)

    disable()
    const up = node.release(40, 10)

    expect(useCanvasInteractions().forwardEventToCanvas).toHaveBeenCalledWith(
      up
    )
    expect(useNodeDrag().endDrag).toHaveBeenCalledExactlyOnceWith(up, first.id)
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('a release after the canvas turns read-only cancels a press without selecting', async () => {
    const { canvas, first } = await setup()
    const disable = controlNodePointerEvents()
    const node = mountNode(createNodeState({ id: first.id }))
    node.press(10, 10)

    disable()
    node.release(10, 10)

    expect(selectedTitles(canvas)).toEqual([])
    expect(node.element.hasPointerCapture(1)).toBe(false)
  })

  it('a move without a press does nothing', async () => {
    const { first } = await setup()
    const node = mountNode(createNodeState({ id: first.id }))

    node.move(200, 200, { shiftKey: true })

    expect(useNodeDrag().startDrag).not.toHaveBeenCalled()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('disposing an idle node does not end another node drag', async () => {
    const { first, second } = await setup()
    const { endDrag, cancelDrag } = useNodeDrag()
    const dragged = mountNode(createNodeState({ id: first.id }))
    const idle = mountNode(createNodeState({ id: second.id }))
    dragged.press(10, 10)
    dragged.move(40, 10)

    idle.scope.stop()

    expect(endDrag).not.toHaveBeenCalled()
    expect(cancelDrag).not.toHaveBeenCalled()
    expect(layoutStore.isDraggingVueNodes.value).toBe(true)
  })

  it('disposing the scope while dragging cancels the drag and releases capture', async () => {
    const { second } = await setup()
    const node = mountNode(createNodeState({ id: second.id }))
    node.press(310, 10)
    node.move(340, 10)
    expect(layoutStore.isDraggingVueNodes.value).toBe(true)

    node.scope.stop()

    expect(useNodeDrag().cancelDrag).toHaveBeenCalledOnce()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
    expect(node.element.hasPointerCapture(1)).toBe(false)
  })
})
