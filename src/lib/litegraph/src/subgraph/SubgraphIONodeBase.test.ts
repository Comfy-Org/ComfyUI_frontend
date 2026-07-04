import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type { DefaultConnectionColors } from '@/lib/litegraph/src/interfaces'
import type {
  IContextMenuOptions,
  IContextMenuValue
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import { SubgraphIONodeBase } from '@/lib/litegraph/src/subgraph/SubgraphIONodeBase'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { CanvasItem } from '@/lib/litegraph/src/types/globalEnums'
import { toLinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'

import {
  createTestSubgraph,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

type MenuConfig = {
  title?: string
  callback?: (item: { content: string; value: string }) => void
}

const { contextMenus, MockContextMenu } = vi.hoisted(() => {
  const contextMenus: Array<{
    options: unknown[]
    config: MenuConfig
  }> = []

  class MockContextMenu {
    constructor(options: unknown[], config: MenuConfig) {
      contextMenus.push({ options, config })
    }
  }

  return { contextMenus, MockContextMenu }
})

type TestSlot = SubgraphInput & {
  arrange: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  draw: ReturnType<typeof vi.fn>
  measure: ReturnType<typeof vi.fn>
  onPointerMove: ReturnType<typeof vi.fn>
}

class TestIONode extends SubgraphIONodeBase<SubgraphInput> {
  readonly id = 'subgraph-io' as NodeId
  readonly emptySlot: SubgraphInput
  readonly slots: SubgraphInput[]
  readonly renameSlot = vi.fn()
  readonly removeSlot = vi.fn()

  constructor(
    subgraph: Subgraph,
    slots: SubgraphInput[],
    emptySlot: SubgraphInput
  ) {
    super(subgraph)
    this.slots = slots
    this.emptySlot = emptySlot
  }

  get allSlots(): SubgraphInput[] {
    return [...this.slots, this.emptySlot]
  }

  get slotAnchorX(): number {
    return this.pos[0] + this.size[0] - SubgraphIONodeBase.roundedRadius
  }

  onPointerDown(): void {}

  openMenu(slot: SubgraphInput, event: CanvasPointerEvent): void {
    this.showSlotContextMenu(slot, event)
  }

  renameByDoubleClick(slot: SubgraphInput, event: CanvasPointerEvent): void {
    this.handleSlotDoubleClick(slot, event)
  }

  drawProtected(
    ctx: CanvasRenderingContext2D,
    colorContext: DefaultConnectionColors,
    fromSlot?: SubgraphInput,
    editorAlpha?: number
  ): void {
    ctx.lineWidth = 99
    ctx.strokeStyle = 'red'
    ctx.fillStyle = 'blue'
    ctx.font = '20px serif'
    ctx.textBaseline = 'top'
    this.drawSlots(ctx, colorContext, fromSlot, editorAlpha)
  }
}

function createSlot(
  name: string,
  rect: [number, number, number, number],
  links: number[] = []
): TestSlot {
  const slot = {
    name,
    displayName: `${name} label`,
    linkIds: links,
    boundingRect: new Rectangle(...rect),
    isPointerOver: false,
    measure: vi.fn(() => [rect[2], rect[3]]),
    arrange: vi.fn((nextRect: [number, number, number, number]) => {
      slot.boundingRect.set(nextRect)
    }),
    onPointerMove: vi.fn((event: CanvasPointerEvent) => {
      slot.isPointerOver = slot.boundingRect.containsXy(
        event.canvasX,
        event.canvasY
      )
    }),
    disconnect: vi.fn(),
    draw: vi.fn()
  }
  return fromPartial<TestSlot>(slot)
}

function createSubgraph() {
  const prompt = vi.fn(
    (_title: string, _value: string, callback: (value: string) => void) =>
      callback('renamed')
  )
  return {
    prompt,
    subgraph: fromPartial<Subgraph>({
      setDirtyCanvas: vi.fn(),
      canvasAction: vi.fn(
        (callback: (canvas: { prompt: typeof prompt }) => void) =>
          callback({ prompt })
      )
    })
  }
}

function createNode() {
  const filled = createSlot('value', [20, 30, 80, 20], [1])
  const empty = createSlot('', [20, 60, 80, 20])
  const { subgraph, prompt } = createSubgraph()
  const node = new TestIONode(subgraph, [filled], empty)
  node.configure({
    id: 'subgraph-io',
    bounding: [10, 20, 100, 80],
    pinned: false
  })
  return { node, filled, empty, subgraph, prompt }
}

function eventAt(x: number, y: number): CanvasPointerEvent {
  return { canvasX: x, canvasY: y } as CanvasPointerEvent
}

function pointerEvent(
  canvasX: number,
  canvasY: number,
  button = 0
): CanvasPointerEvent {
  return fromPartial({ canvasX, canvasY, button })
}

function createArrangedInputNode() {
  const subgraph = createTestSubgraph({
    inputs: [{ name: 'value', type: 'STRING' }]
  })
  const inputNode = subgraph.inputNode
  inputNode.configure({ id: inputNode.id, bounding: [0, 0, 150, 100] })
  inputNode.arrange()
  return { subgraph, inputNode }
}

function slotCentre(slot: {
  boundingRect: ArrayLike<number>
}): [number, number] {
  const [x, y, width, height] = Array.from(slot.boundingRect)
  return [x + width / 2, y + height / 2]
}

describe('SubgraphIONodeBase (test node harness)', () => {
  beforeEach(() => {
    contextMenus.length = 0
    Object.assign(LiteGraph, { ContextMenu: MockContextMenu })
  })

  it('moves, snaps, hit-tests, and serializes node bounds', () => {
    const { node } = createNode()

    node.move(5, -10)

    expect(Array.from(node.pos)).toEqual([15, 10])
    expect(node.containsPoint([20, 20])).toBe(true)
    expect(node.asSerialisable()).toEqual({
      id: 'subgraph-io',
      bounding: [15, 10, 100, 80],
      pinned: undefined
    })

    node.pinned = true
    expect(node.snapToGrid(10)).toBe(false)
    expect(node.asSerialisable().pinned).toBe(true)
  })

  it('tracks pointer entry, slot hover, and pointer leave', () => {
    const { node, filled } = createNode()

    const overResult = node.onPointerMove(eventAt(25, 35))

    expect(overResult & CanvasItem.SubgraphIoNode).toBeTruthy()
    expect(overResult & CanvasItem.SubgraphIoSlot).toBeTruthy()
    expect(node.isPointerOver).toBe(true)
    expect(filled.isPointerOver).toBe(true)

    const outResult = node.onPointerMove(eventAt(500, 500))

    expect(outResult).toBe(CanvasItem.Nothing)
    expect(node.isPointerOver).toBe(false)
    expect(filled.isPointerOver).toBe(false)
  })

  it('finds slots, arranges them, and restores drawing context state', () => {
    const { node, filled } = createNode()
    const ctx = {
      lineWidth: 1,
      strokeStyle: 'black',
      fillStyle: 'white',
      font: '12px sans-serif',
      textBaseline: 'middle'
    } as CanvasRenderingContext2D

    node.arrange()
    node.draw(ctx, {} as DefaultConnectionColors, filled)

    expect(node.getSlotInPosition(100, 40)).toBe(filled)
    expect(node.getSlotInPosition(500, 500)).toBeUndefined()
    expect(filled.arrange).toHaveBeenCalled()
    expect(node.size[0]).toBeGreaterThanOrEqual(108)
    expect(ctx.lineWidth).toBe(1)
    expect(ctx.strokeStyle).toBe('black')
    expect(ctx.fillStyle).toBe('white')
    expect(ctx.font).toBe('12px sans-serif')
    expect(ctx.textBaseline).toBe('middle')
    expect(filled.draw).toHaveBeenCalledWith(
      expect.objectContaining({ ctx, fromSlot: filled })
    )
  })

  it('prompts for non-empty slot rename on double click', () => {
    const { node, filled, empty, prompt } = createNode()

    node.renameByDoubleClick(empty, eventAt(0, 0))
    expect(prompt).not.toHaveBeenCalled()

    node.renameByDoubleClick(filled, eventAt(20, 30))

    expect(prompt).toHaveBeenCalledWith(
      'Slot name',
      'value label',
      expect.any(Function),
      expect.any(Object)
    )
    expect(node.renameSlot).toHaveBeenCalledWith(filled, 'renamed')
  })

  it('opens slot context menu actions for connected non-empty slots', () => {
    const { node, filled, subgraph } = createNode()

    node.openMenu(filled, eventAt(20, 30))

    expect(contextMenus).toHaveLength(1)
    expect(contextMenus[0].config.title).toBe('value')
    expect(contextMenus[0].options).toMatchObject([
      { value: 'disconnect' },
      { value: 'rename' },
      null,
      { value: 'remove', className: 'danger' }
    ])

    contextMenus[0].config.callback?.({
      content: 'Disconnect Links',
      value: 'disconnect'
    })
    contextMenus[0].config.callback?.({
      content: 'Rename Slot',
      value: 'rename'
    })
    contextMenus[0].config.callback?.({
      content: 'Remove Slot',
      value: 'remove'
    })

    expect(filled.disconnect).toHaveBeenCalled()
    expect(node.renameSlot).toHaveBeenCalledWith(filled, 'renamed')
    expect(node.removeSlot).toHaveBeenCalledWith(filled)
    expect(subgraph.setDirtyCanvas).toHaveBeenCalledWith(true, true)
  })

  it('does not open a context menu for the empty slot', () => {
    const { node, empty } = createNode()

    node.openMenu(empty, eventAt(20, 60))

    expect(contextMenus).toHaveLength(0)
  })
})

describe('SubgraphIONodeBase', () => {
  beforeEach(() => {
    resetSubgraphFixtureState()
    LGraphCanvas._measureText = (text: string) => text.length * 8
  })

  afterEach(() => {
    LGraphCanvas._measureText = undefined
    vi.restoreAllMocks()
  })

  describe('pointer hover', () => {
    it('tracks pointer enter, slot hover, and leave', () => {
      const { inputNode } = createArrangedInputNode()
      const [slotX, slotY] = slotCentre(inputNode.slots[0])

      const overSlot = inputNode.onPointerMove(pointerEvent(slotX, slotY))
      expect(inputNode.isPointerOver).toBe(true)
      expect(overSlot & CanvasItem.SubgraphIoNode).toBeTruthy()
      expect(overSlot & CanvasItem.SubgraphIoSlot).toBeTruthy()
      expect(inputNode.slots[0].isPointerOver).toBe(true)

      // Move within the node but off the slot
      const overNode = inputNode.onPointerMove(pointerEvent(1, 1))
      expect(overNode).toBe(CanvasItem.SubgraphIoNode)

      // Leave the node entirely
      const outside = inputNode.onPointerMove(pointerEvent(500, 500))
      expect(outside).toBe(CanvasItem.Nothing)
      expect(inputNode.isPointerOver).toBe(false)
      expect(inputNode.slots[0].isPointerOver).toBe(false)

      // Moving outside while already outside stays a no-op
      expect(inputNode.onPointerMove(pointerEvent(500, 500))).toBe(
        CanvasItem.Nothing
      )
    })

    it('reports whether a point is inside the node', () => {
      const { inputNode } = createArrangedInputNode()

      expect(inputNode.containsPoint([1, 1])).toBe(true)
      expect(inputNode.containsPoint([500, 500])).toBe(false)
    })
  })

  describe('snapToGrid', () => {
    it('does not snap pinned nodes', () => {
      const { inputNode } = createArrangedInputNode()
      inputNode.pinned = true

      expect(inputNode.snapToGrid(10)).toBe(false)
    })

    it('snaps unpinned nodes to the grid', () => {
      const { inputNode } = createArrangedInputNode()
      inputNode.pos = [7, 13]

      expect(inputNode.snapToGrid(10)).toBe(true)
      expect([inputNode.pos[0], inputNode.pos[1]]).toEqual([10, 10])
    })
  })

  describe('getSlotInPosition', () => {
    it('returns the slot at the given canvas position', () => {
      const { inputNode } = createArrangedInputNode()
      const [slotX, slotY] = slotCentre(inputNode.slots[0])

      expect(inputNode.getSlotInPosition(slotX, slotY)).toBe(inputNode.slots[0])
    })

    it('returns undefined when no slot contains the position', () => {
      const { inputNode } = createArrangedInputNode()

      expect(inputNode.getSlotInPosition(500, 500)).toBeUndefined()
    })
  })

  describe('slot context menu', () => {
    interface CapturedMenu {
      options: (IContextMenuValue | null)[]
      opts: IContextMenuOptions
    }

    let captured: CapturedMenu | undefined
    const OriginalContextMenu = LiteGraph.ContextMenu

    beforeEach(() => {
      captured = undefined
      LiteGraph.ContextMenu = fromPartial<typeof LiteGraph.ContextMenu>(
        class {
          constructor(
            options: (IContextMenuValue | null)[],
            opts: IContextMenuOptions
          ) {
            captured = { options, opts }
          }
        }
      )
    })

    afterEach(() => {
      LiteGraph.ContextMenu = OriginalContextMenu
    })

    it('offers disconnect, rename, and remove for connected slots', () => {
      const { subgraph, inputNode } = createArrangedInputNode()
      const slot = inputNode.slots[0]
      slot.linkIds.push(toLinkId(1))
      const [slotX, slotY] = slotCentre(slot)

      inputNode.onPointerDown(
        pointerEvent(slotX, slotY, 2),
        fromPartial<CanvasPointer>({}),
        fromPartial<LinkConnector>({})
      )

      expect(captured).toBeDefined()
      expect(captured?.options.map((o) => o?.value)).toEqual([
        'disconnect',
        'rename',
        undefined,
        'remove'
      ])

      // Disconnect action clears the slot's links.
      void captured?.opts.callback?.(fromPartial({ value: 'disconnect' }))
      expect(slot.linkIds).toHaveLength(0)

      // Remove action deletes the slot from the subgraph.
      void captured?.opts.callback?.(fromPartial({ value: 'remove' }))
      expect(subgraph.inputs).toHaveLength(0)
    })

    it('renames the slot through the canvas prompt', () => {
      const { subgraph, inputNode } = createArrangedInputNode()
      const slot = inputNode.slots[0]
      const prompt = vi.fn(
        (
          _title: string,
          _value: unknown,
          callback: (value: string) => void
        ) => {
          callback('renamed')
        }
      )
      subgraph.list_of_graphcanvas = [
        fromPartial<LGraphCanvas>({ prompt, setDirty: vi.fn() })
      ]
      const [slotX, slotY] = slotCentre(slot)

      inputNode.onPointerDown(
        pointerEvent(slotX, slotY, 2),
        fromPartial<CanvasPointer>({}),
        fromPartial<LinkConnector>({})
      )
      void captured?.opts.callback?.(fromPartial({ value: 'rename' }))

      expect(prompt).toHaveBeenCalledWith(
        'Slot name',
        'value',
        expect.any(Function),
        expect.anything()
      )
      // Renaming an input updates its display label.
      expect(subgraph.inputs[0].displayName).toBe('renamed')
    })

    it('does not show a menu for the empty slot', () => {
      const { inputNode } = createArrangedInputNode()
      const [slotX, slotY] = slotCentre(inputNode.emptySlot)

      inputNode.onPointerDown(
        pointerEvent(slotX, slotY, 2),
        fromPartial<CanvasPointer>({}),
        fromPartial<LinkConnector>({})
      )

      expect(captured).toBeUndefined()
    })

    it('ignores right-clicks outside all slots', () => {
      const { inputNode } = createArrangedInputNode()

      inputNode.onPointerDown(
        pointerEvent(500, 500, 2),
        fromPartial<CanvasPointer>({}),
        fromPartial<LinkConnector>({})
      )

      expect(captured).toBeUndefined()
    })
  })

  describe('left-click drag and double-click', () => {
    it('wires up drag handlers when a slot is clicked', () => {
      const { subgraph, inputNode } = createArrangedInputNode()
      const slot = inputNode.slots[0]
      const pointer = fromPartial<CanvasPointer>({})
      const linkConnector = fromPartial<LinkConnector>({
        dragNewFromSubgraphInput: vi.fn(),
        dropLinks: vi.fn(),
        reset: vi.fn()
      })
      const [slotX, slotY] = slotCentre(slot)

      inputNode.onPointerDown(
        pointerEvent(slotX, slotY),
        pointer,
        linkConnector
      )

      pointer.onDragStart?.(pointer)
      expect(linkConnector.dragNewFromSubgraphInput).toHaveBeenCalledWith(
        subgraph,
        inputNode,
        slot
      )

      pointer.onDragEnd?.(fromPartial<CanvasPointerEvent>({}))
      expect(linkConnector.dropLinks).toHaveBeenCalled()

      pointer.finally?.()
      expect(linkConnector.reset).toHaveBeenCalledWith(true)
    })

    it('prompts to rename on double-click of a regular slot', () => {
      const { subgraph, inputNode } = createArrangedInputNode()
      const slot = inputNode.slots[0]
      const prompt = vi.fn()
      subgraph.list_of_graphcanvas = [fromPartial<LGraphCanvas>({ prompt })]
      const pointer = fromPartial<CanvasPointer>({})
      const [slotX, slotY] = slotCentre(slot)

      inputNode.onPointerDown(
        pointerEvent(slotX, slotY),
        pointer,
        fromPartial<LinkConnector>({})
      )
      pointer.onDoubleClick?.(fromPartial<CanvasPointerEvent>({}))

      expect(prompt).toHaveBeenCalled()
    })

    it('does not prompt to rename on double-click of the empty slot', () => {
      const { subgraph, inputNode } = createArrangedInputNode()
      const prompt = vi.fn()
      subgraph.list_of_graphcanvas = [fromPartial<LGraphCanvas>({ prompt })]
      const pointer = fromPartial<CanvasPointer>({})
      const [slotX, slotY] = slotCentre(inputNode.emptySlot)

      inputNode.onPointerDown(
        pointerEvent(slotX, slotY),
        pointer,
        fromPartial<LinkConnector>({})
      )
      pointer.onDoubleClick?.(fromPartial<CanvasPointerEvent>({}))

      expect(prompt).not.toHaveBeenCalled()
    })
  })

  describe('arrange', () => {
    it('sizes the node to fit its widest slot', () => {
      LGraphCanvas._measureText = () => 300
      const { inputNode } = createArrangedInputNode()

      inputNode.arrange()

      // Slot width (300 + slot height) exceeds the minimum width of 100.
      expect(inputNode.size[0]).toBeGreaterThan(300)
    })

    it('falls back to zero-width labels without a text measurer', () => {
      LGraphCanvas._measureText = undefined
      const { inputNode } = createArrangedInputNode()

      inputNode.arrange()

      expect(inputNode.size[0]).toBeGreaterThan(0)
    })
  })

  describe('serialisation', () => {
    it('round-trips pinned state', () => {
      const { inputNode } = createArrangedInputNode()

      inputNode.configure({
        id: inputNode.id,
        bounding: [5, 6, 150, 100],
        pinned: true
      })
      expect(inputNode.pinned).toBe(true)
      expect(inputNode.asSerialisable().pinned).toBe(true)

      inputNode.configure({ id: inputNode.id, bounding: [5, 6, 150, 100] })
      expect(inputNode.pinned).toBe(false)
      expect(inputNode.asSerialisable().pinned).toBeUndefined()
    })
  })

  describe('draw', () => {
    it('draws with hover-dependent stroke styling and restores context state', () => {
      const { inputNode } = createArrangedInputNode()
      const strokeStyles: unknown[] = []
      const ctx = fromPartial<CanvasRenderingContext2D>({
        getTransform: vi.fn(() => new DOMMatrix()),
        setTransform: vi.fn(),
        translate: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(() => {
          strokeStyles.push(ctx.strokeStyle)
        }),
        fill: vi.fn(),
        rect: vi.fn(),
        fillText: vi.fn(),
        lineWidth: 1,
        strokeStyle: 'original',
        fillStyle: 'original',
        font: 'original',
        textBaseline: 'alphabetic'
      })
      const colorContext = {
        getConnectedColor: () => '#0f0',
        getDisconnectedColor: () => '#f00'
      }

      inputNode.draw(ctx, colorContext)
      const [defaultStroke] = strokeStyles

      inputNode.onPointerEnter()
      inputNode.draw(ctx, colorContext)
      const [, hoverStroke] = strokeStyles

      expect(defaultStroke).not.toBe(hoverStroke)
      expect(ctx.strokeStyle).toBe('original')
      expect(ctx.fillStyle).toBe('original')
      expect(ctx.font).toBe('original')
    })
  })
})
