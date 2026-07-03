import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { LLink } from '@/lib/litegraph/src/LLink'
import type {
  DefaultConnectionColors,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import type { NodeLike } from '@/lib/litegraph/src/types/NodeLike'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

import { createTestSubgraph } from './__fixtures__/subgraphHelpers'

function eventAt(x: number, y: number, button = 0): CanvasPointerEvent {
  return { canvasX: x, canvasY: y, button } as CanvasPointerEvent
}

function createCanvasContext() {
  return fromPartial<CanvasRenderingContext2D>({
    getTransform: vi.fn(() => new DOMMatrix()),
    translate: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setTransform: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    fillStyle: '',
    textBaseline: 'alphabetic',
    globalAlpha: 1
  })
}

describe('SubgraphOutputNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes output slots plus the empty slot and computes its anchor', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'image', type: 'IMAGE' }]
    })
    subgraph.outputNode.configure({
      id: subgraph.outputNode.id,
      bounding: [10, 20, 100, 80],
      pinned: false
    })

    expect(subgraph.outputNode.slots).toBe(subgraph.outputs)
    expect(subgraph.outputNode.allSlots).toEqual([
      subgraph.outputs[0],
      subgraph.outputNode.emptySlot
    ])
    expect(subgraph.outputNode.slotAnchorX).toBe(24)
  })

  it('sets link connector drag callbacks for left-clicked slots', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const slot = subgraph.outputs[0]
    slot.boundingRect.updateTo([10, 20, 100, 30])
    const pointer = {} as CanvasPointer
    const linkConnector = fromPartial<LinkConnector>({
      dragNewFromSubgraphOutput: vi.fn(),
      dropLinks: vi.fn(),
      reset: vi.fn()
    })

    subgraph.outputNode.onPointerDown(eventAt(20, 25), pointer, linkConnector)

    pointer.onDragStart?.(pointer)
    pointer.onDragEnd?.(eventAt(40, 45))
    pointer.finally?.()

    expect(linkConnector.dragNewFromSubgraphOutput).toHaveBeenCalledWith(
      subgraph,
      subgraph.outputNode,
      slot
    )
    expect(linkConnector.dropLinks).toHaveBeenCalledWith(
      subgraph,
      expect.objectContaining({ canvasX: 40 })
    )
    expect(linkConnector.reset).toHaveBeenCalledWith(true)
  })

  it('opens the slot context menu for right-clicked slots', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const slot = subgraph.outputs[0]
    slot.boundingRect.updateTo([10, 20, 100, 30])
    const menuSpy = vi.spyOn(
      subgraph.outputNode as unknown as {
        showSlotContextMenu(slot: unknown, event: unknown): void
      },
      'showSlotContextMenu'
    )

    subgraph.outputNode.onPointerDown(
      eventAt(20, 25, 2),
      {} as CanvasPointer,
      {} as LinkConnector
    )
    subgraph.outputNode.onPointerDown(
      eventAt(500, 500, 2),
      {} as CanvasPointer,
      {} as LinkConnector
    )

    expect(menuSpy).toHaveBeenCalledOnce()
    expect(menuSpy).toHaveBeenCalledWith(
      slot,
      expect.objectContaining({ button: 2 })
    )
  })

  it('renames and removes output slots through the parent subgraph', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const slot = subgraph.outputs[0]
    const renameSpy = vi.spyOn(subgraph, 'renameOutput')
    const removeSpy = vi.spyOn(subgraph, 'removeOutput')

    subgraph.outputNode.renameSlot(slot, 'preview')
    subgraph.outputNode.removeSlot(slot)

    expect(renameSpy).toHaveBeenCalledWith(slot, 'preview')
    expect(removeSpy).toHaveBeenCalledWith(slot)
  })

  it('delegates connection checks and output-type connections', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const slot = subgraph.outputs[0]
    const outputSlot = fromPartial<{ index: number; slot: INodeOutputSlot }>({
      index: 0,
      slot: { name: 'out', type: 'IMAGE' }
    })
    const targetNode = new LGraphNode('Target')
    targetNode.id = toNodeId(99)
    vi.spyOn(targetNode, 'findOutputByType').mockReturnValue(outputSlot)
    const link = new LLink(toLinkId(1), 'IMAGE', toNodeId(1), 0, toNodeId(2), 0)
    const connectSpy = vi.spyOn(slot, 'connect').mockReturnValue(link)
    const outputNode = fromPartial<NodeLike>({
      canConnectTo: vi.fn(() => true)
    })

    expect(
      subgraph.outputNode.canConnectTo(outputNode, slot, outputSlot.slot)
    ).toBe(true)
    expect(
      subgraph.outputNode.connectByTypeOutput(0, targetNode, 'IMAGE', {
        afterRerouteId: toRerouteId(7)
      })
    ).toBe(link)
    expect(connectSpy).toHaveBeenCalledWith(
      outputSlot.slot,
      targetNode,
      toRerouteId(7)
    )

    vi.mocked(targetNode.findOutputByType).mockReturnValue(undefined)
    expect(
      subgraph.outputNode.connectByTypeOutput(0, targetNode, 'LATENT')
    ).toBeUndefined()
  })

  it('finds the first free output slot of a matching type', () => {
    const subgraph = createTestSubgraph({
      outputs: [
        { name: 'used', type: 'IMAGE' },
        { name: 'free', type: 'IMAGE' }
      ]
    })
    subgraph.outputs[0].linkIds.push(toLinkId(1))

    expect(subgraph.outputNode.findInputByType('IMAGE')).toBe(
      subgraph.outputs[0]
    )
    expect(subgraph.outputNode.findInputByType('LATENT')).toBeUndefined()
  })

  it('draws the side rail and output slots', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'image', type: 'IMAGE' }]
    })
    subgraph.outputNode.configure({
      id: subgraph.outputNode.id,
      bounding: [10, 20, 100, 80],
      pinned: false
    })
    const ctx = createCanvasContext()
    const drawSlotsSpy = vi.spyOn(
      subgraph.outputNode as unknown as {
        drawSlots(
          ctx: unknown,
          colorContext: unknown,
          fromSlot: unknown,
          editorAlpha: unknown
        ): void
      },
      'drawSlots'
    )

    subgraph.outputNode.drawProtected(
      ctx,
      fromPartial<DefaultConnectionColors>({
        getConnectedColor: vi.fn(() => '#fff'),
        getDisconnectedColor: vi.fn(() => '#000')
      }),
      subgraph.outputs[0],
      0.5
    )

    expect(ctx.translate).toHaveBeenCalledWith(10, 20)
    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
    expect(ctx.setTransform).toHaveBeenCalled()
    expect(drawSlotsSpy).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        getConnectedColor: expect.any(Function),
        getDisconnectedColor: expect.any(Function)
      }),
      subgraph.outputs[0],
      0.5
    )
  })
})
