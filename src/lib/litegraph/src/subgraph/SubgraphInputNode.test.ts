import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import { LLink } from '@/lib/litegraph/src/LLink'
import type {
  DefaultConnectionColors,
  INodeInputSlot
} from '@/lib/litegraph/src/interfaces'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
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

type MenuConfig = { title?: string; event?: CanvasPointerEvent }
const originalContextMenu = LiteGraph.ContextMenu

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

describe('SubgraphInputNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.assign(LiteGraph, { ContextMenu: originalContextMenu })
  })

  it('exposes input slots plus the empty slot and computes its anchor', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'image', type: 'IMAGE' }]
    })
    subgraph.inputNode.configure({
      id: subgraph.inputNode.id,
      bounding: [10, 20, 100, 80],
      pinned: false
    })

    expect(subgraph.inputNode.slots).toBe(subgraph.inputs)
    expect(subgraph.inputNode.allSlots).toEqual([
      subgraph.inputs[0],
      subgraph.inputNode.emptySlot
    ])
    expect(subgraph.inputNode.slotAnchorX).toBe(96)
  })

  it('sets link connector drag callbacks for left-clicked slots', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const slot = subgraph.inputs[0]
    slot.boundingRect.updateTo([10, 20, 100, 30])
    const pointer = {} as CanvasPointer
    const linkConnector = fromPartial<LinkConnector>({
      dragNewFromSubgraphInput: vi.fn(),
      dropLinks: vi.fn(),
      reset: vi.fn()
    })

    subgraph.inputNode.onPointerDown(eventAt(20, 25), pointer, linkConnector)

    pointer.onDragStart?.(pointer)
    pointer.onDragEnd?.(eventAt(40, 45))
    pointer.finally?.()

    expect(linkConnector.dragNewFromSubgraphInput).toHaveBeenCalledWith(
      subgraph,
      subgraph.inputNode,
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
      inputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const slot = subgraph.inputs[0]
    slot.boundingRect.updateTo([10, 20, 100, 30])
    const contextMenus: MenuConfig[] = []
    Object.assign(LiteGraph, {
      ContextMenu: class {
        constructor(_options: unknown[], config: MenuConfig) {
          contextMenus.push(config)
        }
      }
    })

    subgraph.inputNode.onPointerDown(
      eventAt(20, 25, 2),
      {} as CanvasPointer,
      {} as LinkConnector
    )
    subgraph.inputNode.onPointerDown(
      eventAt(500, 500, 2),
      {} as CanvasPointer,
      {} as LinkConnector
    )

    expect(contextMenus).toHaveLength(1)
    expect(contextMenus[0]).toEqual(
      expect.objectContaining({
        title: slot.name,
        event: expect.objectContaining({ button: 2 })
      })
    )
  })

  it('renames and removes input slots through the parent subgraph', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const slot = subgraph.inputs[0]
    const renameSpy = vi.spyOn(subgraph, 'renameInput')
    const removeSpy = vi.spyOn(subgraph, 'removeInput')

    subgraph.inputNode.renameSlot(slot, 'preview')
    subgraph.inputNode.removeSlot(slot)

    expect(renameSpy).toHaveBeenCalledWith(slot, 'preview')
    expect(removeSpy).toHaveBeenCalledWith(slot)
  })

  it('delegates connection checks and input-type connections', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const slot = subgraph.inputs[0]
    const inputSlot = fromPartial<{ index: number; slot: INodeInputSlot }>({
      index: 0,
      slot: { name: 'in', type: 'IMAGE' }
    })
    const targetNode = new LGraphNode('Target')
    targetNode.id = toNodeId(99)
    vi.spyOn(targetNode, 'findInputByType').mockReturnValue(inputSlot)
    const link = new LLink(toLinkId(1), 'IMAGE', toNodeId(1), 0, toNodeId(2), 0)
    const connectSpy = vi.spyOn(slot, 'connect').mockReturnValue(link)
    const inputNode = fromPartial<NodeLike>({
      canConnectTo: vi.fn(() => true)
    })

    expect(
      subgraph.inputNode.canConnectTo(inputNode, inputSlot.slot, slot)
    ).toBe(true)
    expect(
      subgraph.inputNode.connectByType(0, targetNode, 'IMAGE', {
        afterRerouteId: toRerouteId(7)
      })
    ).toBe(link)
    expect(connectSpy).toHaveBeenCalledWith(
      inputSlot.slot,
      targetNode,
      toRerouteId(7)
    )

    vi.mocked(targetNode.findInputByType).mockReturnValue(undefined)
    expect(
      subgraph.inputNode.connectByType(0, targetNode, 'LATENT')
    ).toBeUndefined()
  })

  it('finds input slots by name and the first free slot by type', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'used', type: 'IMAGE' },
        { name: 'free', type: 'IMAGE' }
      ]
    })
    subgraph.inputs[0].linkIds.push(toLinkId(1))

    expect(subgraph.inputNode.findOutputSlot('free')).toBe(subgraph.inputs[1])
    expect(subgraph.inputNode.findOutputByType('IMAGE')).toBe(
      subgraph.inputs[0]
    )
    expect(subgraph.inputNode.findOutputByType('LATENT')).toBeUndefined()
  })

  it('disconnects node inputs and clears floating links', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const targetNode = new LGraphNode('Target')
    targetNode.id = toNodeId(99)
    const input = targetNode.addInput('image', 'IMAGE')
    const floatingLink = new LLink(
      toLinkId(9),
      'IMAGE',
      subgraph.inputNode.id,
      0,
      targetNode.id,
      0
    )
    input._floatingLinks = new Set([floatingLink])
    input.link = toLinkId(3)
    const removeFloatingLinkSpy = vi.spyOn(subgraph, 'removeFloatingLink')
    const setDirtyCanvasSpy = vi.spyOn(subgraph, 'setDirtyCanvas')

    subgraph.inputNode._disconnectNodeInput(targetNode, input, undefined)

    expect(removeFloatingLinkSpy).toHaveBeenCalledWith(floatingLink)
    expect(input.link).toBeNull()
    expect(setDirtyCanvasSpy).toHaveBeenCalledWith(false, true)
  })

  it('draws the side rail and input slots', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'image', type: 'IMAGE' }]
    })
    subgraph.inputNode.configure({
      id: subgraph.inputNode.id,
      bounding: [10, 20, 100, 80],
      pinned: false
    })
    const ctx = createCanvasContext()
    const slotDrawSpy = vi.spyOn(subgraph.inputs[0], 'draw')

    subgraph.inputNode.drawProtected(
      ctx,
      fromPartial<DefaultConnectionColors>({
        getConnectedColor: vi.fn(() => '#fff'),
        getDisconnectedColor: vi.fn(() => '#000')
      }),
      subgraph.inputs[0],
      0.5
    )

    expect(ctx.translate).toHaveBeenCalledWith(10, 20)
    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
    expect(ctx.setTransform).toHaveBeenCalled()
    expect(slotDrawSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx,
        fromSlot: subgraph.inputs[0],
        editorAlpha: 0.5,
        colorContext: expect.objectContaining({
          getConnectedColor: expect.any(Function),
          getDisconnectedColor: expect.any(Function)
        })
      })
    )
  })
})
