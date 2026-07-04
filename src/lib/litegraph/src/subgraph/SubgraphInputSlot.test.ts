import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LLink } from '@/lib/litegraph/src/LLink'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

import { createTestSubgraph } from './__fixtures__/subgraphHelpers'

function createWidget(
  overrides: Partial<Pick<IBaseWidget, 'name' | 'type' | 'options'>> = {}
): IBaseWidget {
  return {
    name: overrides.name ?? 'strength',
    type: overrides.type ?? 'FLOAT',
    options: {
      min: 0,
      max: 1,
      step: 0.1,
      step2: 0.01,
      precision: 2,
      ...overrides.options
    }
  } as IBaseWidget
}

describe('SubgraphInput', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('connects subgraph inputs to node inputs', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const targetNode = new LGraphNode('Target')
    targetNode.id = toNodeId(10)
    subgraph.add(targetNode)
    const input = targetNode.addInput('image', 'IMAGE')
    const afterChangeSpy = vi.spyOn(subgraph, 'afterChange')
    const triggerSpy = vi.spyOn(subgraph, 'trigger')
    const connectionSpy = vi.fn()
    targetNode.onConnectionsChange = connectionSpy

    const link = subgraph.inputs[0].connect(input, targetNode, toRerouteId(5))

    expect(link).toBeInstanceOf(LLink)
    expect(link?.origin_id).toBe(subgraph.inputNode.id)
    expect(link?.target_id).toBe(targetNode.id)
    expect(link?.parentId).toBe(toRerouteId(5))
    expect(subgraph.inputs[0].linkIds).toEqual([link?.id])
    expect(input.link).toBe(link?.id)
    expect(triggerSpy).toHaveBeenCalledWith('node:slot-links:changed', {
      nodeId: targetNode.id,
      slotType: NodeSlotType.INPUT,
      slotIndex: 0,
      connected: true,
      linkId: link?.id
    })
    expect(connectionSpy).toHaveBeenCalledWith(
      NodeSlotType.INPUT,
      0,
      true,
      link,
      input
    )
    expect(afterChangeSpy).toHaveBeenCalled()
  })

  it('does not connect when the target node blocks the input', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const targetNode = new LGraphNode('Target')
    const input = targetNode.addInput('image', 'IMAGE')
    targetNode.onConnectInput = vi.fn(() => false)

    expect(subgraph.inputs[0].connect(input, targetNode)).toBeUndefined()
  })

  it('rejects widget inputs that do not match the promoted widget', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'strength', type: 'FLOAT' }]
    })
    const targetNode = new LGraphNode('Target')
    const input = targetNode.addInput('strength', 'FLOAT')
    const currentWidget = createWidget()
    const otherWidget = createWidget({ options: { min: 1 } })
    input.widget = { name: otherWidget.name }
    targetNode.widgets = [otherWidget]
    subgraph.inputs[0]._widget = currentWidget
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(subgraph.inputs[0].connect(input, targetNode)).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(
      'Target input has invalid widget.',
      input,
      targetNode
    )
  })

  it('tracks connected widgets and clears them on disconnect', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'strength', type: 'FLOAT' }]
    })
    const targetNode = new LGraphNode('Target')
    targetNode.id = toNodeId(10)
    subgraph.add(targetNode)
    const input = targetNode.addInput('strength', 'FLOAT')
    const widget = createWidget()
    input.widget = { name: widget.name }
    targetNode.widgets = [widget]
    const connectedSpy = vi.fn()
    const disconnectedSpy = vi.fn()
    subgraph.inputs[0].events.addEventListener('input-connected', connectedSpy)
    subgraph.inputs[0].events.addEventListener(
      'input-disconnected',
      disconnectedSpy
    )

    const link = subgraph.inputs[0].connect(input, targetNode)

    expect(subgraph.inputs[0]._widget).toBe(widget)
    expect(subgraph.inputs[0].getConnectedWidgets()).toEqual([widget])
    expect(connectedSpy).toHaveBeenCalledOnce()

    subgraph.inputs[0].disconnect()

    expect(subgraph.inputs[0]._widget).toBeUndefined()
    expect(subgraph.inputs[0].linkIds).toEqual([])
    expect(disconnectedSpy).toHaveBeenCalledTimes(2)
    expect(subgraph.getLink(link?.id ?? toLinkId(-1))).toBeUndefined()
  })

  it('arranges and labels from the right edge', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const input = subgraph.inputs[0]

    input.arrange([140, 30, 120, 40])

    expect(Array.from(input.boundingRect)).toEqual([20, 30, 120, 40])
    expect(input.pos).toEqual([120, 50])
    expect(input.labelPos).toEqual([20, 50])
  })

  it('validates node inputs and subgraph outputs as targets', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'source', type: 'IMAGE' }],
      outputs: [{ name: 'preview', type: 'IMAGE' }]
    })
    const input = subgraph.inputs[0]
    const imageInput = { name: 'image', type: 'IMAGE', link: null }
    const latentInput = { name: 'latent', type: 'LATENT', link: null }
    const imageOutput = fromPartial<INodeOutputSlot>({
      name: 'image',
      type: 'IMAGE',
      links: []
    })

    expect(input.isValidTarget(imageInput as INodeInputSlot)).toBe(true)
    expect(input.isValidTarget(latentInput as INodeInputSlot)).toBe(false)
    expect(input.isValidTarget(imageOutput)).toBe(false)
    expect(input.isValidTarget(subgraph.outputs[0])).toBe(true)
  })

  it('matches widget options by type and numeric constraints', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'strength', type: 'FLOAT' }]
    })
    const input = subgraph.inputs[0]
    input._widget = createWidget()

    expect(input.matchesWidget(createWidget())).toBe(true)
    expect(input.matchesWidget(createWidget({ type: 'INT' }))).toBe(false)
    expect(input.matchesWidget(createWidget({ options: { max: 2 } }))).toBe(
      false
    )

    input._widget = undefined
    expect(input.matchesWidget(createWidget({ type: 'INT' }))).toBe(true)
  })

  it('disconnects node inputs and removes link references', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'image', type: 'IMAGE' }]
    })
    const targetNode = new LGraphNode('Target')
    targetNode.id = toNodeId(10)
    subgraph.add(targetNode)
    const input = targetNode.addInput('image', 'IMAGE')
    const link = subgraph.inputs[0].connect(input, targetNode)
    const triggerSpy = vi.spyOn(subgraph, 'trigger')
    const connectionSpy = vi.fn()
    targetNode.onConnectionsChange = connectionSpy

    subgraph.inputNode._disconnectNodeInput(targetNode, input, link)

    expect(input.link).toBeNull()
    expect(subgraph.inputs[0].linkIds).toEqual([])
    expect(connectionSpy).toHaveBeenCalledWith(
      NodeSlotType.INPUT,
      0,
      false,
      link,
      subgraph.inputs[0]
    )
    expect(triggerSpy).toHaveBeenCalledWith('node:slot-links:changed', {
      nodeId: targetNode.id,
      slotType: NodeSlotType.INPUT,
      slotIndex: 0,
      connected: false,
      linkId: link?.id
    })
  })
})
