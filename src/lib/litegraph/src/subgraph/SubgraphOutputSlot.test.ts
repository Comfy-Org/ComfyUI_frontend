import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LLink } from '@/lib/litegraph/src/LLink'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

import { createTestSubgraph } from './__fixtures__/subgraphHelpers'

describe('SubgraphOutput', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('connects node outputs to subgraph outputs', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'preview', type: 'IMAGE' }]
    })
    const sourceNode = new LGraphNode('Source')
    sourceNode.id = toNodeId(10)
    subgraph.add(sourceNode)
    const output = sourceNode.addOutput('image', 'IMAGE')
    const afterChangeSpy = vi.spyOn(subgraph, 'afterChange')
    const connectionSpy = vi.fn()
    sourceNode.onConnectionsChange = connectionSpy

    const link = subgraph.outputs[0].connect(output, sourceNode, toRerouteId(5))

    expect(link).toBeInstanceOf(LLink)
    expect(link?.origin_id).toBe(sourceNode.id)
    expect(link?.target_id).toBe(subgraph.outputNode.id)
    expect(link?.parentId).toBe(toRerouteId(5))
    expect(subgraph.outputs[0].linkIds).toEqual([link?.id])
    expect(output.links).toEqual([link?.id])
    expect(subgraph.getLink(link?.id ?? toLinkId(-1))).toBe(link)
    expect(connectionSpy).toHaveBeenCalledWith(
      NodeSlotType.OUTPUT,
      0,
      true,
      link,
      output
    )
    expect(afterChangeSpy).toHaveBeenCalled()
  })

  it('does not connect incompatible or blocked node outputs', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'preview', type: 'IMAGE' }]
    })
    const sourceNode = new LGraphNode('Source')
    const latentOutput = sourceNode.addOutput('latent', 'LATENT')

    expect(
      subgraph.outputs[0].connect(latentOutput, sourceNode)
    ).toBeUndefined()

    const imageOutput = sourceNode.addOutput('image', 'IMAGE')
    sourceNode.onConnectOutput = vi.fn(() => false)

    expect(subgraph.outputs[0].connect(imageOutput, sourceNode)).toBeUndefined()
  })

  it('throws when the output slot is not owned by the node', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'preview', type: 'IMAGE' }]
    })
    const sourceNode = new LGraphNode('Source')
    const foreignOutput = { name: 'image', type: 'IMAGE' } as INodeOutputSlot

    expect(() =>
      subgraph.outputs[0].connect(foreignOutput, sourceNode)
    ).toThrow('Slot is not an output of the given node')
  })

  it('disconnects existing links before accepting a replacement', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'preview', type: 'IMAGE' }]
    })
    const firstNode = new LGraphNode('First')
    firstNode.id = toNodeId(10)
    subgraph.add(firstNode)
    const firstOutput = firstNode.addOutput('image', 'IMAGE')
    const firstLink = subgraph.outputs[0].connect(firstOutput, firstNode)
    const secondNode = new LGraphNode('Second')
    secondNode.id = toNodeId(11)
    subgraph.add(secondNode)
    const secondOutput = secondNode.addOutput('image', 'IMAGE')
    const beforeChangeSpy = vi.spyOn(subgraph, 'beforeChange')

    const secondLink = subgraph.outputs[0].connect(secondOutput, secondNode)

    expect(beforeChangeSpy).toHaveBeenCalled()
    expect(firstOutput.links).not.toContain(firstLink?.id)
    expect(subgraph.outputs[0].linkIds).toEqual([secondLink?.id])
    expect(secondOutput.links).toEqual([secondLink?.id])
  })

  it('arranges and labels from the left edge', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'preview', type: 'IMAGE' }]
    })
    const output = subgraph.outputs[0]

    output.arrange([20, 30, 120, 40])

    expect(Array.from(output.boundingRect)).toEqual([20, 30, 120, 40])
    expect(output.pos).toEqual([40, 50])
    expect(output.labelPos).toEqual([60, 50])
  })

  it('validates output slots and subgraph inputs as targets', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'source', type: 'IMAGE' }],
      outputs: [{ name: 'preview', type: 'IMAGE' }]
    })
    const output = subgraph.outputs[0]
    const imageOutput = fromPartial<INodeOutputSlot>({
      name: 'image',
      type: 'IMAGE',
      links: []
    })
    const latentOutput = fromPartial<INodeOutputSlot>({
      name: 'latent',
      type: 'LATENT',
      links: []
    })
    const imageInput = { name: 'image', type: 'IMAGE', link: null }

    expect(output.isValidTarget(imageOutput)).toBe(true)
    expect(output.isValidTarget(latentOutput)).toBe(false)
    expect(output.isValidTarget(imageInput as INodeInputSlot)).toBe(false)
    expect(output.isValidTarget(subgraph.inputs[0])).toBe(true)
  })

  it('disconnects links and notifies output nodes', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'preview', type: 'IMAGE' }]
    })
    const sourceNode = new LGraphNode('Source')
    sourceNode.id = toNodeId(10)
    subgraph.add(sourceNode)
    const output = sourceNode.addOutput('image', 'IMAGE')
    const link = subgraph.outputs[0].connect(output, sourceNode)
    const removeLinkSpy = vi.spyOn(subgraph, 'removeLink')
    const connectionSpy = vi.fn()
    sourceNode.onConnectionsChange = connectionSpy

    subgraph.outputs[0].disconnect()

    expect(removeLinkSpy).toHaveBeenCalledWith(link?.id)
    expect(output.links).not.toContain(link?.id)
    expect(connectionSpy).toHaveBeenCalledWith(
      NodeSlotType.OUTPUT,
      0,
      false,
      link,
      subgraph.outputs[0]
    )
    expect(subgraph.outputs[0].linkIds).toEqual([])
  })
})
