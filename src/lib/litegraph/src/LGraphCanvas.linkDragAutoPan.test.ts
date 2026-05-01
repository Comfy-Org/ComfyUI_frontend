import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createMockCanvasPointerEvent,
  createMockCanvasRenderingContext2D
} from '@/utils/__tests__/litegraphTestUtils'

import { createTestSubgraph } from './subgraph/__fixtures__/subgraphHelpers'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    querySlotAtPoint: vi.fn(),
    queryRerouteAtPoint: vi.fn(),
    getNodeLayoutRef: vi.fn(() => ({ value: null })),
    getSlotLayout: vi.fn()
  }
}))

describe('LGraphCanvas link drag auto-pan', () => {
  let canvas: LGraphCanvas
  let canvasElement: HTMLCanvasElement

  beforeEach(() => {
    vi.useFakeTimers()

    canvasElement = document.createElement('canvas')
    canvasElement.width = 800
    canvasElement.height = 600

    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    canvasElement.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {}
    })

    const graph = new LGraph()
    canvas = new LGraphCanvas(canvasElement, graph, {
      skip_render: true,
      skip_events: true
    })
  })

  afterEach(() => {
    canvas.pointer.finally?.()
    vi.useRealTimers()
  })

  function startLinkDrag() {
    canvas['_linkConnectorDrop']()
  }

  it('starts auto-pan when link drag begins', () => {
    canvas.mouse[0] = 400
    canvas.mouse[1] = 300
    startLinkDrag()
    expect(canvas['_autoPan']).not.toBeNull()
  })

  it('keeps graph_mouse consistent with offset after auto-pan', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    startLinkDrag()

    vi.advanceTimersByTime(16)

    const { scale } = canvas.ds
    expect(canvas.graph_mouse[0]).toBeCloseTo(
      canvas.mouse[0] / scale - canvas.ds.offset[0]
    )
    expect(canvas.graph_mouse[1]).toBeCloseTo(
      canvas.mouse[1] / scale - canvas.ds.offset[1]
    )
  })

  it('keeps graph_mouse consistent with zoom applied', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    canvas.ds.scale = 2
    startLinkDrag()

    vi.advanceTimersByTime(16)

    expect(canvas.graph_mouse[0]).toBeCloseTo(
      canvas.mouse[0] / 2 - canvas.ds.offset[0]
    )
    expect(canvas.graph_mouse[1]).toBeCloseTo(
      canvas.mouse[1] / 2 - canvas.ds.offset[1]
    )
  })

  it('pans the viewport when pointer is near edge', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    startLinkDrag()

    const offsetBefore = canvas.ds.offset[0]

    vi.advanceTimersByTime(16)

    expect(canvas.ds.offset[0]).not.toBe(offsetBefore)
  })

  it('marks canvas dirty when auto-pan fires', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    startLinkDrag()

    canvas.dirty_canvas = false
    canvas.dirty_bgcanvas = false

    vi.advanceTimersByTime(16)

    expect(canvas.dirty_canvas).toBe(true)
    expect(canvas.dirty_bgcanvas).toBe(true)
  })

  it('stops auto-pan when pointer.finally fires', () => {
    canvas.mouse[0] = 400
    canvas.mouse[1] = 300
    startLinkDrag()
    expect(canvas['_autoPan']).not.toBeNull()

    canvas.pointer.finally!()

    expect(canvas['_autoPan']).toBeNull()
  })

  it('does not pan when pointer is in the center', () => {
    canvas.mouse[0] = 400
    canvas.mouse[1] = 300
    startLinkDrag()

    const offsetBefore = [...canvas.ds.offset]

    vi.advanceTimersByTime(16)

    expect(canvas.ds.offset[0]).toBe(offsetBefore[0])
    expect(canvas.ds.offset[1]).toBe(offsetBefore[1])
  })

  describe('subgraph IO slots', () => {
    function openSubgraph(
      kind: 'input' | 'output',
      slotNames: string[] = ['slot0']
    ) {
      const subgraph = createTestSubgraph(
        kind === 'input'
          ? { inputs: slotNames.map((name) => ({ name, type: 'STRING' })) }
          : { outputs: slotNames.map((name) => ({ name, type: 'STRING' })) }
      )
      canvas.setGraph(subgraph)
      const ioNode = kind === 'input' ? subgraph.inputNode : subgraph.outputNode
      ioNode.arrange()
      return ioNode
    }

    const cases = [
      { kind: 'input', slot: 'first', mouseX: 5, sign: 1 },
      { kind: 'output', slot: 'first', mouseX: 795, sign: -1 },
      { kind: 'input', slot: 'empty', mouseX: 5, sign: 1 },
      { kind: 'output', slot: 'empty', mouseX: 795, sign: -1 }
    ] as const

    it.each(cases)(
      'starts a link drag and pans in the right direction when dragging a subgraph $kind $slot slot near the edge',
      ({ kind, slot: slotKind, mouseX, sign }) => {
        const ioNode = openSubgraph(kind)
        canvas.mouse[0] = mouseX
        canvas.mouse[1] = 300

        const slot = slotKind === 'empty' ? ioNode.emptySlot : ioNode.slots[0]
        const [sx, sy, sw, sh] = slot.boundingRect
        canvas['_processPrimaryButton'](
          createMockCanvasPointerEvent(sx + sw / 2, sy + sh / 2, { button: 0 }),
          undefined
        )

        // Fire the drag-start callback that onPointerDown wired up — this is
        // what actually creates the link. Without it, we'd only be testing
        // that auto-pan starts on mousedown, not the full drag flow.
        canvas.pointer.onDragStart!(canvas.pointer)
        expect(canvas.linkConnector.isConnecting).toBe(true)

        const before = canvas.ds.offset[0]
        vi.advanceTimersByTime(16)
        expect(Math.sign(canvas.ds.offset[0] - before)).toBe(sign)
      }
    )

    it('uses getSlotInPosition to route the link drag through the correct slot when multiple are present', () => {
      const ioNode = openSubgraph('input', ['in0', 'in1', 'in2'])
      const dragSpy = vi.spyOn(canvas.linkConnector, 'dragNewFromSubgraphInput')

      const targetSlot = ioNode.slots[1]
      const [sx, sy, sw, sh] = targetSlot.boundingRect
      canvas.mouse[0] = sx + sw / 2
      canvas.mouse[1] = sy + sh / 2

      canvas['_processPrimaryButton'](
        createMockCanvasPointerEvent(sx + sw / 2, sy + sh / 2, { button: 0 }),
        undefined
      )
      canvas.pointer.onDragStart!(canvas.pointer)

      expect(dragSpy).toHaveBeenCalledWith(
        expect.anything(),
        ioNode,
        targetSlot
      )
    })

    it('does not select the IO node on a left-click without drag (matches regular-node slot click behavior)', () => {
      const ioNode = openSubgraph('input')
      const slot = ioNode.slots[0]
      const [sx, sy, sw, sh] = slot.boundingRect

      canvas['_processPrimaryButton'](
        createMockCanvasPointerEvent(sx + sw / 2, sy + sh / 2, { button: 0 }),
        undefined
      )

      expect(canvas.pointer.onClick).toBeUndefined()

      canvas.pointer.finally?.()
      expect(ioNode.selected).toBe(false)
    })

    it('right-click on an IO slot opens the context menu without arming drag handlers or auto-pan', () => {
      const ioNode = openSubgraph('input')
      const ContextMenuSpy = vi
        .spyOn(LiteGraph, 'ContextMenu')
        .mockImplementation(function ContextMenuStub() {
          return Object.create(LiteGraph.ContextMenu.prototype)
        })

      try {
        const [sx, sy, sw, sh] = ioNode.slots[0].boundingRect
        const event = createMockCanvasPointerEvent(sx + sw / 2, sy + sh / 2, {
          button: 2
        })
        const result = ioNode.onPointerDown(
          event,
          canvas.pointer,
          canvas.linkConnector
        )

        expect(result).toBe(false)
        expect(ContextMenuSpy).toHaveBeenCalledTimes(1)
        expect(canvas['_autoPan']).toBeNull()
        expect(canvas.pointer.onDragStart).toBeUndefined()
        expect(canvas.pointer.onDragEnd).toBeUndefined()
      } finally {
        ContextMenuSpy.mockRestore()
      }
    })
  })
})
