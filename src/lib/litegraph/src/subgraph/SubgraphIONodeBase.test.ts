import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'

import type { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import type {
  IContextMenuOptions,
  IContextMenuValue
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { CanvasItem } from '@/lib/litegraph/src/types/globalEnums'
import { toLinkId } from '@/types/linkId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import {
  createTestSubgraph,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

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
      const ctx = createMockCanvasRenderingContext2D({
        stroke: vi.fn(() => {
          strokeStyles.push(ctx.strokeStyle)
        }),
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
