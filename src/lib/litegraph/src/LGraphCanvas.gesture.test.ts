import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PointerEventOptions } from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import {
  addGroup,
  addNode,
  createCanvas,
  pointerEvent,
  selectedTitles
} from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import type {
  LGraphCanvas,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { CanvasPointer, LGraph, LiteGraph } from '@/lib/litegraph/src/litegraph'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

type Point = [number, number]

/** Node A body. */
const A_BODY: Point = [70, 70]
/** Node A title bar, right of the collapse box. */
const A_TITLE: Point = [90, 30]
/** Node B body. */
const B_BODY: Point = [340, 70]
/** Group title bar, between nodes A and B. */
const G_TITLE: Point = [220, 10]
/** Empty canvas, outside every node and group. */
const EMPTY: Point = [600, 500]
/** Well past {@link CanvasPointer.maxClickDrift}. */
const FAR: Point = [20, 30]
/** Within {@link CanvasPointer.maxClickDrift}. */
const NEAR: Point = [1, 0]

function shifted([x, y]: Point, [dx, dy]: Point): Point {
  return [x + dx, y + dy]
}

function posOf(item: LGraphNode | LGraphGroup): Point {
  return [item.pos[0], item.pos[1]]
}

class Gesture {
  clock = 0
  constructor(readonly canvas: LGraphCanvas) {}

  private stamp(advance: number) {
    this.clock += advance
    return this.clock
  }

  press([x, y]: Point, options: PointerEventOptions = {}, after = 1) {
    this.canvas.visible_nodes = [...this.canvas.graph!.nodes]
    this.canvas.processMouseDown(
      pointerEvent('pointerdown', x, y, {
        timeStamp: this.stamp(after),
        ...options
      })
    )
  }

  move([x, y]: Point, options: PointerEventOptions = {}, after = 1) {
    this.canvas.processMouseMove(
      pointerEvent('pointermove', x, y, {
        timeStamp: this.stamp(after),
        ...options
      })
    )
  }

  release([x, y]: Point, options: PointerEventOptions = {}, after = 1) {
    this.canvas.processMouseUp(
      pointerEvent('pointerup', x, y, {
        timeStamp: this.stamp(after),
        ...options
      })
    )
  }

  cancel() {
    this.canvas.processMouseCancel()
  }

  click(at: Point, options: PointerEventOptions = {}) {
    this.press(at, options)
    this.release(at, options)
  }

  drag(from: Point, by: Point, options: PointerEventOptions = {}) {
    const to = shifted(from, by)
    this.press(from, options)
    this.move(to, options)
    this.release(to, options)
  }
}

function recordCallbacks(canvas: LGraphCanvas, node: LGraphNode) {
  const log: string[] = []
  const callbackArgs = new Map<string, unknown[][]>()
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      log.push(name)
      const calls = callbackArgs.get(name) ?? []
      calls.push(args)
      callbackArgs.set(name, calls)
    }
  Object.assign(node, {
    onSelected: record('node.onSelected'),
    onDeselected: record('node.onDeselected'),
    onMouseDown: record('node.onMouseDown'),
    onMouseUp: record('node.onMouseUp'),
    onDblClick: record('node.onDblClick')
  })
  canvas.onNodeSelected = record('canvas.onNodeSelected')
  canvas.onNodeDeselected = record('canvas.onNodeDeselected')
  canvas.onNodeMoved = record('canvas.onNodeMoved')
  canvas.onSelectionChange = record('canvas.onSelectionChange')
  canvas.onShowNodePanel = record('canvas.onShowNodePanel')
  canvas.onNodeDblClicked = record('canvas.onNodeDblClicked')
  vi.spyOn(canvas, 'bringToFront').mockImplementation(record('bringToFront'))
  vi.spyOn(canvas, 'processContextMenu').mockImplementation(
    record('processContextMenu')
  )
  vi.spyOn(canvas, 'showSearchBox').mockImplementation(() => {
    log.push('showSearchBox')
    return document.createElement('div')
  })
  vi.spyOn(canvas, 'emitEvent').mockImplementation(({ subType }) => {
    log.push(`emit.${subType}`)
  })
  return { args: callbackArgs, log }
}

describe('CanvasPointer lifecycle callbacks', () => {
  it('passes the release event to click and then runs final cleanup', () => {
    const pointer = new CanvasPointer(document.createElement('canvas'))
    const onClick = vi.fn()
    const finallyCallback = vi.fn()
    const down = pointerEvent('pointerdown', 10, 20)
    const up = pointerEvent('pointerup', 10, 20)

    pointer.down(down)
    pointer.onClick = onClick
    pointer.finally = finallyCallback
    pointer.up(up)

    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledWith(up)
    expect(finallyCallback).toHaveBeenCalledOnce()
  })

  it('passes pointer events through the complete drag lifecycle', () => {
    const pointer = new CanvasPointer(document.createElement('canvas'))
    const onDragStart = vi.fn()
    const onDrag = vi.fn()
    const onDragEnd = vi.fn()
    const finallyCallback = vi.fn()
    const down = pointerEvent('pointerdown', 10, 20)
    const move = pointerEvent('pointermove', 30, 40)
    const up = pointerEvent('pointerup', 30, 40)

    pointer.down(down)
    pointer.onDragStart = onDragStart
    pointer.onDrag = onDrag
    pointer.onDragEnd = onDragEnd
    pointer.finally = finallyCallback
    pointer.move(move)
    pointer.up(up)

    expect(onDragStart).toHaveBeenCalledOnce()
    expect(onDragStart).toHaveBeenCalledWith(pointer, move)
    expect(onDrag).toHaveBeenCalledOnce()
    expect(onDrag).toHaveBeenCalledWith(move)
    expect(onDragEnd).toHaveBeenCalledOnce()
    expect(onDragEnd).toHaveBeenCalledWith(up)
    expect(finallyCallback).toHaveBeenCalledOnce()
  })
})

describe('LGraphCanvas pointer gestures', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let a: LGraphNode
  let b: LGraphNode
  let gesture: Gesture
  let callbackArgs: Map<string, unknown[][]>
  let log: string[]

  beforeEach(() => {
    LiteGraph.vueNodesMode = false
    LiteGraph.leftMouseClickBehavior = 'panning'
    graph = new LGraph()
    canvas = createCanvas(graph)
    a = addNode(graph, 'A', 20, 40)
    b = addNode(graph, 'B', 300, 40)
    gesture = new Gesture(canvas)
    ;({ args: callbackArgs, log } = recordCallbacks(canvas, a))
  })

  describe('node', () => {
    it('click selects on release without moving', () => {
      gesture.press(A_BODY)
      expect(selectedTitles(canvas)).toEqual([])

      gesture.release(A_BODY)

      expect(selectedTitles(canvas)).toEqual(['A'])
      expect(posOf(a)).toEqual([20, 40])
      expect(log).toEqual([
        'bringToFront',
        'node.onMouseDown',
        'node.onSelected',
        'canvas.onNodeSelected',
        'canvas.onSelectionChange'
      ])
      expect(callbackArgs.get('node.onMouseDown')?.[0]?.[0]).toBeInstanceOf(
        PointerEvent
      )
      expect(callbackArgs.get('canvas.onNodeSelected')).toEqual([[a]])
    })

    it('press brings an unpinned node to front before release', () => {
      gesture.press(A_BODY)

      expect(log).toEqual(['bringToFront', 'node.onMouseDown'])
    })

    it('press leaves a pinned node in place', () => {
      a.flags.pinned = true

      gesture.press(A_BODY)

      expect(log).toEqual(['node.onMouseDown'])
    })

    it('drag past the drift threshold selects and moves the node', () => {
      gesture.drag(A_BODY, FAR)

      expect(selectedTitles(canvas)).toEqual(['A'])
      expect(posOf(a)).toEqual([40, 70])
      expect(posOf(b)).toEqual([300, 40])
      expect(canvas.ds.offset).toEqual([0, 0])
      expect(canvas.isDragging).toBe(false)
      expect(log).toEqual([
        'bringToFront',
        'node.onMouseDown',
        'emit.before-change',
        'node.onSelected',
        'canvas.onNodeSelected',
        'canvas.onSelectionChange',
        'canvas.onNodeMoved',
        'emit.after-change'
      ])
      expect(callbackArgs.get('canvas.onNodeMoved')).toEqual([[a]])
    })

    it('drag moves every selected node', () => {
      gesture.click(B_BODY)
      gesture.click(A_BODY, { shiftKey: true })

      gesture.drag(A_BODY, FAR)

      expect(posOf(a)).toEqual([40, 70])
      expect(posOf(b)).toEqual([320, 70])
    })

    it('quick movement within the drift threshold stays a click', () => {
      gesture.press(A_BODY)
      gesture.move(shifted(A_BODY, NEAR), {}, 10)
      gesture.release(shifted(A_BODY, NEAR))

      expect(selectedTitles(canvas)).toEqual(['A'])
      expect(posOf(a)).toEqual([20, 40])
      expect(log).not.toContain('canvas.onNodeMoved')
    })

    it.fails('slow movement within the drift threshold stays a click', () => {
      gesture.press(A_BODY)
      gesture.move(shifted(A_BODY, NEAR), {}, CanvasPointer.bufferTime + 100)
      gesture.release(shifted(A_BODY, NEAR))

      expect({
        moved: log.includes('canvas.onNodeMoved'),
        position: posOf(a)
      }).toEqual({ moved: false, position: [20, 40] })
    })

    it('records the current slow movement promotion', () => {
      gesture.press(A_BODY)
      gesture.move(shifted(A_BODY, NEAR), {}, CanvasPointer.bufferTime + 100)
      gesture.release(shifted(A_BODY, NEAR))

      expect(posOf(a)).toEqual([21, 40])
      expect(log).toContain('canvas.onNodeMoved')
    })

    it('currently emits onNodeMoved for a far release that did not move the node', () => {
      gesture.press(A_BODY)
      gesture.release(shifted(A_BODY, FAR))

      expect(selectedTitles(canvas)).toEqual(['A'])
      expect(posOf(a)).toEqual([20, 40])
      expect(log).toContain('canvas.onNodeMoved')
    })

    it.fails('releases a hovered node with the pointerup event', () => {
      canvas.visible_nodes = [...graph.nodes]
      gesture.move(A_BODY)
      gesture.press(A_BODY)
      gesture.release(A_BODY)

      expect(callbackArgs.get('node.onMouseUp')).toEqual([
        [expect.any(PointerEvent), expect.any(Array), canvas]
      ])
      expect(callbackArgs.get('node.onMouseUp')?.[0]?.[0]).toMatchObject({
        type: 'pointerup'
      })
    })

    it('starts a link drag from an output slot', () => {
      const output = a.addOutput('value', 'number')
      a.updateArea()
      const dragNewFromOutput = vi
        .spyOn(canvas.linkConnector, 'dragNewFromOutput')
        .mockImplementation(() => {})
      const outputPosition = a.getOutputPos(0)

      gesture.press([outputPosition[0], outputPosition[1]])

      expect(dragNewFromOutput).toHaveBeenCalledWith(graph, a, output)
    })

    it('starts a link drag from a reroute slot', () => {
      a.addOutput('value', 'number')
      b.addInput('value', 'number')
      const link = a.connect(0, b, 0)
      assert(link)
      const reroute = graph.createReroute([220, 200], link)
      assert(reroute)
      canvas._visibleReroutes.add(reroute)
      const dragFromReroute = vi
        .spyOn(canvas.linkConnector, 'dragFromReroute')
        .mockImplementation(() => {})

      gesture.press([220, 200], { shiftKey: true })

      expect(dragFromReroute).toHaveBeenCalledWith(graph, reroute)
    })

    it('two clicks inside the double-click window fire the double-click callbacks once', () => {
      gesture.click(A_TITLE)
      gesture.press(A_TITLE, {}, 50)
      gesture.release(A_TITLE)

      expect(selectedTitles(canvas)).toEqual(['A'])
      expect(log).toEqual([
        'bringToFront',
        'node.onMouseDown',
        'node.onSelected',
        'canvas.onNodeSelected',
        'canvas.onSelectionChange',
        'bringToFront',
        'node.onMouseDown',
        'node.onDblClick',
        'emit.node-double-click',
        'canvas.onShowNodePanel',
        'canvas.onNodeDblClicked'
      ])
    })

    it('two clicks outside the double-click window stay single clicks', () => {
      gesture.click(A_TITLE)
      gesture.press(A_TITLE, {}, CanvasPointer.doubleClickTime + 1)
      gesture.release(A_TITLE)

      expect(log).not.toContain('node.onDblClick')
    })

    it('right press replaces the selection before release, then opens the menu', () => {
      gesture.click(B_BODY)

      gesture.press(A_BODY, { button: 2 })
      expect(selectedTitles(canvas)).toEqual(['A'])
      expect(log).not.toContain('processContextMenu')

      gesture.release(A_BODY, { button: 2 })
      expect(log).toContain('processContextMenu')
    })

    it('right press on a selected node keeps the multi-selection', () => {
      gesture.click(B_BODY)
      gesture.click(A_BODY, { shiftKey: true })

      gesture.click(A_BODY, { button: 2 })

      expect(selectedTitles(canvas)).toEqual(['A', 'B'])
    })

    it('cancel while pressed drops the click', () => {
      gesture.press(A_BODY)
      gesture.cancel()

      expect(selectedTitles(canvas)).toEqual([])
      expect(canvas.pointer.eDown).toBeUndefined()
    })

    it('cancel while dragging keeps the moved position and skips drag end', () => {
      gesture.press(A_BODY)
      gesture.move(shifted(A_BODY, FAR))
      gesture.cancel()

      expect(posOf(a)).toEqual([40, 70])
      expect(canvas.isDragging).toBe(false)
      expect(log).not.toContain('canvas.onNodeMoved')
    })

    it('read-only press on a node pans instead of selecting or moving', () => {
      canvas.read_only = true

      gesture.drag(A_BODY, FAR)

      expect(selectedTitles(canvas)).toEqual([])
      expect(posOf(a)).toEqual([20, 40])
      expect(canvas.ds.offset).toEqual(FAR)
      expect(canvas.dragging_canvas).toBe(false)
    })
  })

  describe('group', () => {
    let group: LGraphGroup

    beforeEach(() => {
      group = addGroup(graph, 'G', [0, 0, 500, 300])
    })

    it('title click selects the group only', () => {
      gesture.click(G_TITLE)

      expect(selectedTitles(canvas)).toEqual(['G'])
      expect(posOf(group)).toEqual([0, 0])
    })

    it('title drag moves the group with its children', () => {
      gesture.drag(G_TITLE, FAR)

      expect(selectedTitles(canvas)).toEqual(['G'])
      expect(posOf(group)).toEqual([20, 30])
      expect(posOf(a)).toEqual([40, 70])
      expect(posOf(b)).toEqual([320, 70])
    })

    it('title double click emits group-double-click', () => {
      gesture.click(G_TITLE)
      gesture.press(G_TITLE, {}, 50)
      gesture.release(G_TITLE)

      expect(log).toEqual([
        'canvas.onSelectionChange',
        'emit.group-double-click'
      ])
    })
  })

  describe('empty canvas', () => {
    it('click clears the selection', () => {
      gesture.click(A_BODY)

      gesture.click(EMPTY)

      expect(selectedTitles(canvas)).toEqual([])
    })

    it('drag pans the canvas and keeps the selection', () => {
      gesture.click(A_BODY)

      gesture.drag(EMPTY, FAR)

      expect(canvas.ds.offset).toEqual(FAR)
      expect(selectedTitles(canvas)).toEqual(['A'])
      expect(canvas.dragging_canvas).toBe(false)
    })

    it('double click opens the search box', () => {
      gesture.click(EMPTY)
      gesture.press(EMPTY, {}, 50)
      gesture.release(EMPTY)

      expect(log).toContain('showSearchBox')
    })

    it('cancel while panning stops the pan', () => {
      gesture.press(EMPTY)
      gesture.move(shifted(EMPTY, FAR))
      gesture.cancel()

      expect(canvas.dragging_canvas).toBe(false)
      expect(canvas.ds.offset).toEqual(FAR)
    })

    describe('marquee', () => {
      beforeEach(() => {
        LiteGraph.leftMouseClickBehavior = 'select'
      })

      it('drag selects the enclosed nodes without panning', () => {
        gesture.press([5, 5])
        gesture.move([140, 110])
        expect(canvas.dragging_rectangle).not.toBeNull()

        gesture.release([140, 110])

        expect(selectedTitles(canvas)).toEqual(['A'])
        expect(canvas.dragging_rectangle).toBeNull()
        expect(canvas.ds.offset).toEqual([0, 0])
      })

      it('ctrl drag in panning mode also selects', () => {
        LiteGraph.leftMouseClickBehavior = 'panning'

        gesture.drag([5, 5], [135, 105], { ctrlKey: true })

        expect(selectedTitles(canvas)).toEqual(['A'])
        expect(canvas.ds.offset).toEqual([0, 0])
      })

      it('cancel discards the rectangle and the selection change', () => {
        gesture.press([5, 5])
        gesture.move([140, 110])
        gesture.cancel()

        expect(canvas.dragging_rectangle).toBeNull()
        expect(selectedTitles(canvas)).toEqual([])
      })
    })
  })
})
