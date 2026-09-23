import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasInteractionModeReader } from '@/lib/litegraph/src/canvas/CanvasInteractionMode'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

function createHarness(interactionMode?: CanvasInteractionModeReader) {
  const canvasElement = document.createElement('canvas')
  canvasElement.width = 800
  canvasElement.height = 600
  canvasElement.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  canvasElement.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 600
  })

  const graph = new LGraph()
  const canvas = new LGraphCanvas(canvasElement, graph, {
    skip_render: true,
    interactionMode
  })
  const node = new LGraphNode('Node')
  node.pos = [100, 100]
  node.size = [150, 80]
  node.updateArea()
  graph.add(node)
  canvas.visible_nodes = [node]
  return { canvas, graph, node }
}

function pointerDownOn(canvas: LGraphCanvas, clientX: number, clientY: number) {
  const event = new MouseEvent('pointerdown', { button: 0, clientX, clientY })
  Object.defineProperty(event, 'isPrimary', { value: true })
  canvas.processMouseDown(event)
}

describe('LGraphCanvas interaction mode', () => {
  beforeEach(() => {
    LiteGraph.vueNodesMode = false
  })

  it.for([
    { reader: undefined, selectOnly: false },
    { reader: { isSelectOnly: () => false }, selectOnly: false },
    { reader: { isSelectOnly: () => true }, selectOnly: true }
  ])(
    'reads selectOnly=$selectOnly from the injected mode',
    ({ reader, selectOnly }) => {
      const { canvas } = createHarness(reader)

      expect(canvas.selectOnly).toBe(selectOnly)
    }
  )

  it('keeps the canvas own selectOnly flag when the mode is editable', () => {
    const { canvas } = createHarness({ isSelectOnly: () => false })

    canvas.selectOnly = true

    expect(canvas.selectOnly).toBe(true)
  })

  it('reads the mode at interaction time rather than at construction', () => {
    let picking = false
    const { canvas, node } = createHarness({ isSelectOnly: () => picking })
    const dragStartsBefore = (() => {
      pointerDownOn(canvas, 150, 140)
      return canvas.pointer.onDragStart !== undefined
    })()
    canvas.pointer.reset()

    picking = true
    pointerDownOn(canvas, 150, 140)
    canvas.pointer.onClick?.(fromPartial<CanvasPointerEvent>({}))

    expect(dragStartsBefore).toBe(true)
    expect(canvas.pointer.onDragStart).toBeUndefined()
    expect(canvas.selectedItems).toEqual(new Set([node]))
  })

  it('keeps the injected mode when the canvas switches graphs', () => {
    const { canvas } = createHarness({ isSelectOnly: () => true })

    canvas.setGraph(new LGraph())

    expect(canvas.selectOnly).toBe(true)
  })

  describe('while select-only', () => {
    it.for([
      { renderer: 'classic', vueNodesMode: false },
      { renderer: 'Vue nodes', vueNodesMode: true }
    ])(
      'a $renderer node press selects the node and sets up no drag',
      ({ vueNodesMode }) => {
        LiteGraph.vueNodesMode = vueNodesMode
        const { canvas, node } = createHarness({ isSelectOnly: () => true })

        pointerDownOn(canvas, 150, 140)
        canvas.pointer.onClick?.(fromPartial<CanvasPointerEvent>({}))

        expect(canvas.selectedItems).toEqual(new Set([node]))
        expect(canvas.pointer.onDragStart).toBeUndefined()
        expect(canvas.pointer.onDrag).toBeUndefined()
        expect(canvas.pointer.onDoubleClick).toBeUndefined()
      }
    )

    it('a press on a group is an empty-canvas press', () => {
      const { canvas, graph } = createHarness({ isSelectOnly: () => true })
      const group = new LGraphGroup('Group')
      group._bounding.set([300, 300, 100, 100])
      graph.add(group)
      const resize = vi.spyOn(group, 'resize')

      pointerDownOn(canvas, 399, 399)
      canvas.pointer.onDragStart?.(canvas.pointer)
      canvas.pointer.onDrag?.(
        fromPartial<CanvasPointerEvent>({ canvasX: 450, canvasY: 450 })
      )
      canvas.pointer.onClick?.(fromPartial<CanvasPointerEvent>({}))

      expect(resize).not.toHaveBeenCalled()
      expect(group.selected).toBeFalsy()
      expect(canvas.selectedItems.size).toBe(0)
    })

    it('an empty-canvas press still pans', () => {
      LiteGraph.leftMouseClickBehavior = 'panning'
      const { canvas } = createHarness({ isSelectOnly: () => true })

      pointerDownOn(canvas, 700, 500)

      expect(canvas.dragging_canvas).toBe(true)
    })
  })
})
