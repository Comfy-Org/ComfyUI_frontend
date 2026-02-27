import { describe, expect, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

import { subgraphTest } from './__fixtures__/subgraphFixtures'

describe('SubgraphInput.connect triggers node:slot-links:changed', () => {
  subgraphTest(
    'fires connected event when connecting to a widget input',
    ({ simpleSubgraph }) => {
      const subgraph = simpleSubgraph
      const triggerSpy = vi.spyOn(subgraph, 'trigger')

      const node = new LGraphNode('Target')
      node.addInput('prompt', 'STRING')
      node.inputs[0].widget = { name: 'prompt' }
      subgraph.add(node)

      subgraph.inputNode.slots[0].connect(node.inputs[0], node)

      expect(triggerSpy).toHaveBeenCalledWith('node:slot-links:changed', {
        nodeId: node.id,
        slotType: NodeSlotType.INPUT,
        slotIndex: 0,
        connected: true,
        linkId: expect.any(Number)
      })
    }
  )

  subgraphTest(
    'does not fire event when connecting to a non-widget input',
    ({ simpleSubgraph }) => {
      const subgraph = simpleSubgraph
      const triggerSpy = vi.spyOn(subgraph, 'trigger')

      const node = new LGraphNode('Target')
      node.addInput('in', 'number')
      subgraph.add(node)

      subgraph.inputNode.slots[0].connect(node.inputs[0], node)

      expect(triggerSpy).not.toHaveBeenCalledWith(
        'node:slot-links:changed',
        expect.anything()
      )
    }
  )
})

describe('SubgraphInputNode._disconnectNodeInput triggers node:slot-links:changed', () => {
  subgraphTest(
    'fires disconnected event when disconnecting a widget input',
    ({ simpleSubgraph }) => {
      const subgraph = simpleSubgraph

      const node = new LGraphNode('Target')
      node.addInput('prompt', 'STRING')
      node.inputs[0].widget = { name: 'prompt' }
      subgraph.add(node)

      const link = subgraph.inputNode.slots[0].connect(node.inputs[0], node)
      expect(link).toBeDefined()

      const triggerSpy = vi.spyOn(subgraph, 'trigger')

      subgraph.inputNode._disconnectNodeInput(node, node.inputs[0], link!)

      expect(triggerSpy).toHaveBeenCalledWith('node:slot-links:changed', {
        nodeId: node.id,
        slotType: NodeSlotType.INPUT,
        slotIndex: 0,
        connected: false,
        linkId: link!.id
      })
    }
  )

  subgraphTest(
    'does not fire event when disconnecting a non-widget input',
    ({ simpleSubgraph }) => {
      const subgraph = simpleSubgraph

      const node = new LGraphNode('Target')
      node.addInput('in', 'number')
      subgraph.add(node)

      const link = subgraph.inputNode.slots[0].connect(node.inputs[0], node)
      expect(link).toBeDefined()

      const triggerSpy = vi.spyOn(subgraph, 'trigger')

      subgraph.inputNode._disconnectNodeInput(node, node.inputs[0], link!)

      expect(triggerSpy).not.toHaveBeenCalledWith(
        'node:slot-links:changed',
        expect.anything()
      )
    }
  )
})
