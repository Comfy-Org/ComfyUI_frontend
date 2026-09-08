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
  LGraphNode,
  LLink
} from '@/lib/litegraph/src/litegraph'
import {
  CanvasPointer,
  LGraph,
  LiteGraph,
  Reroute
} from '@/lib/litegraph/src/litegraph'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

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
/** Bottom-right resize handle of the 500x300 group. */
const G_RESIZE: Point = [497, 297]
/** Reroute on the A to B link, below both nodes. */
const REROUTE: Point = [200, 200]
/** Centre marker of the A to B link, below both nodes. */
const LINK_CENTRE: Point = [200, 250]
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

function connect(from: LGraphNode, to: LGraphNode) {
  from.addOutput('out', '*')
  to.addInput('in', '*')
  const link = from.connect(0, to, 0)
  assert(link)
  return link
}

class Gesture {
  clock = 0
  constructor(readonly canvas: LGraphCanvas) {}

  private stamp(advance: number) {
    this.clock += advance
    return this.clock
  }

  press([x, y]: Point, options: PointerEventOptions = {}, after = 1) {
    const { graph } = this.canvas
    if (!graph) throw new Error('canvas graph is required')
    this.canvas.visible_nodes = [...graph.nodes]
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
  vi.spyOn(canvas, 'showLinkMenu').mockImplementation(() => {
    log.push('showLinkMenu')
    return true
  })
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

  it('treats callback-less double clicks as normal clicks', () => {
    const pointer = new CanvasPointer(document.createElement('canvas'))
    const onClick = vi.fn()

    for (const timeStamp of [100, 200, 300]) {
      pointer.down(pointerEvent('pointerdown', 10, 20, { timeStamp }))
      pointer.onClick = onClick
      pointer.up(
        pointerEvent('pointerup', 10, 20, { timeStamp: timeStamp + 1 })
      )
    }

    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('records pointermove as eUp when it detects a released button', () => {
    const pointer = new CanvasPointer(document.createElement('canvas'))
    pointer.clearEventsOnReset = false
    pointer.down(pointerEvent('pointerdown', 10, 20))
    const releasedMove = pointerEvent('pointermove', 30, 40, { buttons: 2 })

    pointer.move(releasedMove)

    expect(pointer.eUp).toBe(releasedMove)
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

    it('slow movement within the drift threshold stays a click', () => {
      gesture.press(A_BODY)
      gesture.move(shifted(A_BODY, NEAR), {}, 500)
      gesture.release(shifted(A_BODY, NEAR))

      expect({
        moved: log.includes('canvas.onNodeMoved'),
        position: posOf(a)
      }).toEqual({ moved: false, position: [20, 40] })
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

    it('cancel while dragging keeps and finalizes the moved position', () => {
      gesture.press(A_BODY)
      gesture.move(shifted(A_BODY, FAR))
      gesture.cancel()

      expect(posOf(a)).toEqual([40, 70])
      expect(canvas.isDragging).toBe(false)
      expect(log).toContain('canvas.onNodeMoved')
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

    it('latches an empty press when release crosses into a group at low zoom', () => {
      canvas.ds.scale = 0.1

      gesture.press([20, -0.1])
      gesture.release([20, 0.1])

      expect(selectedTitles(canvas)).toEqual([])
    })

    it('latches a group press when release crosses outside at low zoom', () => {
      canvas.ds.scale = 0.1

      gesture.press([20, 0.1])
      gesture.release([20, -0.1])

      expect(selectedTitles(canvas)).toEqual(['G'])
    })

    it.for([
      { click: 'normally', modifiers: {} },
      { click: 'with ctrl', modifiers: { ctrlKey: true } }
    ])(
      'ignores stale reroute hits when links are hidden $click',
      ({ modifiers }) => {
        const link = connect(a, b)
        const reroute = graph.createReroute(G_TITLE, link)
        assert(reroute)
        canvas._visibleReroutes.add(reroute)
        canvas.links_render_mode = LinkRenderType.HIDDEN_LINK

        gesture.click(G_TITLE, modifiers)

        expect(selectedTitles(canvas)).toEqual(['G'])
      }
    )

    it('press sets selected_group; a node press leaves it untouched', () => {
      gesture.click(G_TITLE)
      expect(canvas.selected_group).toBe(group)

      gesture.click(A_BODY)
      expect(canvas.selected_group).toBe(group)

      gesture.click(EMPTY)
      expect(canvas.selected_group).toBeNull()

      gesture.drag(G_TITLE, FAR)
      expect(canvas.selected_group).toBeNull()
    })
  })

  describe('group resize handle', () => {
    let group: LGraphGroup

    beforeEach(() => {
      group = addGroup(graph, 'G', [0, 0, 500, 300])
    })

    it('drag resizes the group without selecting or moving it', () => {
      gesture.drag(G_RESIZE, FAR)

      expect([...group.size]).toEqual([520, 330])
      expect(posOf(group)).toEqual([0, 0])
      expect(selectedTitles(canvas)).toEqual([])
      expect(canvas.resizingGroup).toBeNull()
    })
  })

  describe('reroute', () => {
    let reroute: Reroute

    beforeEach(() => {
      const link = connect(a, b)
      const created = graph.createReroute(REROUTE, link)
      assert(created)
      reroute = created
      canvas._visibleReroutes.add(reroute)
    })

    it('click selects the reroute', () => {
      gesture.click(REROUTE)

      expect([...canvas.selectedItems]).toEqual([reroute])
    })

    it('drag moves the reroute without a link drag', () => {
      gesture.drag(REROUTE, FAR)

      expect([...canvas.selectedItems]).toEqual([reroute])
      expect([...reroute.pos]).toEqual(shifted(REROUTE, FAR))
      expect(canvas.linkConnector.isConnecting).toBe(false)
    })

    it('shift press starts a link drag from the reroute', () => {
      gesture.press(REROUTE, { shiftKey: true })

      expect(canvas.linkConnector.isConnecting).toBe(true)
      expect([...canvas.selectedItems]).toEqual([])
    })
  })

  describe('link centre marker', () => {
    let link: LLink

    beforeEach(() => {
      link = connect(a, b)
      link._pos = [...LINK_CENTRE]
      canvas.renderedPaths.add(link)
    })

    it('click opens the link menu', () => {
      gesture.click(LINK_CENTRE)

      expect(log).toEqual(['showLinkMenu'])
      expect(selectedTitles(canvas)).toEqual([])
    })

    it('drag pans the canvas instead of opening the menu', () => {
      gesture.drag(LINK_CENTRE, FAR)

      expect(log).toEqual([])
      expect(canvas.ds.offset).toEqual(FAR)
      expect(canvas.dragging_canvas).toBe(false)
    })

    it('starts a modified link drag when links are hidden', () => {
      canvas.links_render_mode = LinkRenderType.HIDDEN_LINK
      vi.mocked(layoutStore.queryLinkSegmentAtPoint).mockReturnValue({
        linkId: link.id,
        rerouteId: null
      })

      gesture.press(LINK_CENTRE, { shiftKey: true })

      expect(canvas.linkConnector.isConnecting).toBe(true)
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

      it('ctrl click in panning mode selects the group under the pointer', () => {
        LiteGraph.leftMouseClickBehavior = 'panning'
        addGroup(graph, 'G', [0, 0, 500, 300])

        gesture.click(G_TITLE, { ctrlKey: true })

        expect(selectedTitles(canvas)).toEqual(['G'])
      })

      it('ctrl click selects a group title beneath a link centre', () => {
        LiteGraph.leftMouseClickBehavior = 'panning'
        const group = addGroup(graph, 'G', [0, 240, 500, 300])
        const link = connect(a, b)
        link._pos = [...LINK_CENTRE]
        canvas.renderedPaths.add(link)

        gesture.click(LINK_CENTRE, { ctrlKey: true })

        expect([...canvas.selectedItems]).toEqual([group])
      })

      it('ctrl click selects a lower group title beneath a resize handle', () => {
        LiteGraph.leftMouseClickBehavior = 'panning'
        const lower = addGroup(graph, 'Lower', [450, 290, 100, 100])
        addGroup(graph, 'Upper', [0, 0, 500, 300])

        gesture.click(G_RESIZE, { ctrlKey: true })

        expect([...canvas.selectedItems]).toEqual([lower])
      })

      it('ctrl click selects a lower group title beneath an overlapping group', () => {
        LiteGraph.leftMouseClickBehavior = 'panning'
        const lower = addGroup(graph, 'Lower', [0, 0, 500, 300])
        addGroup(graph, 'Upper', [0, -50, 500, 100])

        gesture.click(G_TITLE, { ctrlKey: true })

        expect([...canvas.selectedItems]).toEqual([lower])
      })

      it('ctrl click selects a group title beneath a reroute slot', () => {
        LiteGraph.leftMouseClickBehavior = 'panning'
        const group = addGroup(graph, 'G', [0, 0, 500, 300])
        const link = connect(a, b)
        const reroute = graph.createReroute(
          [G_TITLE[0] - Reroute.slotOffset, G_TITLE[1]],
          link
        )
        assert(reroute)
        reroute.updateVisibility(G_TITLE)
        canvas._visibleReroutes.add(reroute)

        gesture.click(G_TITLE, { ctrlKey: true })

        expect([...canvas.selectedItems]).toEqual([group])
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

describe('LGraphCanvas interrupted gestures', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let a: LGraphNode
  let gesture: Gesture

  beforeEach(() => {
    LiteGraph.vueNodesMode = false
    LiteGraph.leftMouseClickBehavior = 'panning'
    graph = new LGraph()
    canvas = createCanvas(graph)
    a = addNode(graph, 'A', 20, 40)
    gesture = new Gesture(canvas)
    recordCallbacks(canvas, a)
  })

  function hideDocument() {
    const doc = canvas.canvas.ownerDocument
    vi.spyOn(doc, 'visibilityState', 'get').mockReturnValue('hidden')
    doc.dispatchEvent(new Event('visibilitychange'))
  }

  it('window blur while dragging ends the drag where it was', () => {
    const onNodeMoved = vi.fn()
    canvas.onNodeMoved = onNodeMoved
    gesture.press(A_BODY)
    gesture.move(shifted(A_BODY, FAR))
    expect(canvas.isDragging).toBe(true)

    canvas.canvas.ownerDocument.defaultView!.dispatchEvent(new Event('blur'))

    expect(canvas.isDragging).toBe(false)
    expect(posOf(a)).toEqual([40, 70])
    expect(onNodeMoved).toHaveBeenCalledWith(a)
    gesture.move(shifted(A_BODY, [40, 60]))
    expect(posOf(a)).toEqual([40, 70])
  })

  it('window blur finalizes an interrupted resize transaction', () => {
    const beforeChange = vi.spyOn(graph, 'beforeChange')
    const afterChange = vi.spyOn(graph, 'afterChange')
    const resizeHandle: Point = [119, 99]
    gesture.press(resizeHandle)
    gesture.move(shifted(resizeHandle, FAR))

    canvas.canvas.ownerDocument.defaultView?.dispatchEvent(new Event('blur'))

    expect(beforeChange).toHaveBeenCalledOnce()
    expect(afterChange).toHaveBeenCalledOnce()
    expect(afterChange).toHaveBeenCalledWith(a)
    expect(canvas.resizing_node).toBeNull()
  })

  it('hidden document while pressed discards the click', () => {
    gesture.press(A_BODY)
    hideDocument()
    gesture.release(A_BODY)

    expect(selectedTitles(canvas)).toEqual([])
  })

  it('lost pointer capture while dragging ends the drag', () => {
    gesture.press(A_BODY)
    gesture.move(shifted(A_BODY, FAR))

    canvas.canvas.dispatchEvent(
      new PointerEvent('lostpointercapture', { pointerId: 1 })
    )

    expect(canvas.isDragging).toBe(false)
    expect(canvas.pointer.isDown).toBe(false)
  })

  it('finishes cleanup when interrupted drag finalization throws', () => {
    const afterChange = vi.spyOn(graph, 'afterChange')
    const releasePointerCapture = vi.spyOn(
      canvas.canvas,
      'releasePointerCapture'
    )
    vi.spyOn(canvas.canvas, 'hasPointerCapture').mockReturnValue(true)
    canvas.onNodeMoved = () => {
      throw new Error('finalization failed')
    }
    gesture.press(A_BODY)
    gesture.move(shifted(A_BODY, FAR))

    expect(() => canvas.pointer.reset()).toThrow('finalization failed')

    expect(canvas.isDragging).toBe(false)
    expect(canvas.pointer.isDown).toBe(false)
    expect(afterChange).toHaveBeenCalledOnce()
    expect(releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('unbinding events while dragging ends the drag', () => {
    canvas.bindEvents()
    gesture.press(A_BODY)
    gesture.move(shifted(A_BODY, FAR))

    canvas.unbindEvents()

    expect(canvas.isDragging).toBe(false)
    expect(canvas.pointer.isDown).toBe(false)
  })

  it('unbinding events finishes an active drag zoom', () => {
    canvas.bindEvents()
    canvas.dragZoomEnabled = true
    gesture.press(A_BODY, { ctrlKey: true, shiftKey: true })
    expect(canvas.read_only).toBe(true)

    canvas.unbindEvents()

    expect(canvas.read_only).toBe(false)
  })
})
