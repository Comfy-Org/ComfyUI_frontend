import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type { DefaultConnectionColors } from '@/lib/litegraph/src/interfaces'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/litegraph'
import { CanvasItem } from '@/lib/litegraph/src/types/globalEnums'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import { SubgraphIONodeBase } from '@/lib/litegraph/src/subgraph/SubgraphIONodeBase'
import type { NodeId } from '@/types/nodeId'

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

const originalContextMenu = LiteGraph.ContextMenu

beforeEach(() => {
  contextMenus.length = 0
  Object.assign(LiteGraph, { ContextMenu: MockContextMenu })
})

afterEach(() => {
  Object.assign(LiteGraph, { ContextMenu: originalContextMenu })
})

describe('SubgraphIONodeBase', () => {
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
