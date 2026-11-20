import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphNode,
  findUsedSubgraphIds,
  getDirectSubgraphIds
} from '@/lib/litegraph/src/litegraph'
import type {
  Subgraph,
  SubgraphNode,
  UUID
} from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'

import type { SubgraphInput } from './SubgraphInput'
import { reorderSubgraphInputs, reorderSubgraphOutputs } from './subgraphUtils'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

describe('subgraphUtils', () => {
  beforeEach(() => {
    resetSubgraphFixtureState()
  })

  describe('reorderSubgraphInputs', () => {
    it('moves every instance and both sides of each link into the new order', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'first', type: 'STRING' },
          { name: 'second', type: 'INT' },
          { name: 'third', type: 'FLOAT' }
        ]
      })
      const interior = new LGraphNode('Interior')
      interior.addInput('in', 'FLOAT')
      subgraph.add(interior)
      const innerLink = subgraph.inputs[2].connect(interior.inputs[0], interior)
      const graph = subgraph.rootGraph
      const linkedHost = createTestSubgraphNode(subgraph)
      graph.add(linkedHost)
      const otherHost = createTestSubgraphNode(subgraph)
      graph.add(otherHost)
      const source = new LGraphNode('Source')
      source.addOutput('out', 'FLOAT')
      graph.add(source)
      const outerLink = source.connect(0, linkedHost, 2)

      reorderSubgraphInputs(subgraph, [2, 0, 1])

      const order = ['third', 'first', 'second']
      expect({
        subgraph: subgraph.inputs.map(({ name }) => name),
        linkedHost: linkedHost.inputs.map(({ name }) => name),
        otherHost: otherHost.inputs.map(({ name }) => name),
        innerOriginSlot: innerLink?.origin_slot,
        outerTargetSlot: outerLink?.target_slot
      }).toEqual({
        subgraph: order,
        linkedHost: order,
        otherHost: order,
        innerOriginSlot: 0,
        outerTargetSlot: 0
      })
    })

    it('keeps an instance whose inputs differ from the subgraph in its order', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'first', type: 'STRING' },
          { name: 'second', type: 'STRING' }
        ]
      })
      const host = createTestSubgraphNode(subgraph)
      host.inputs.pop()

      reorderSubgraphInputs(subgraph, [1, 0])

      expect(host.inputs.map(({ name }) => name)).toEqual(['first'])
      expect(console.error).toHaveBeenCalledWith(
        'followSubgraphInputOrder: host inputs differ',
        { hostInputs: 1, subgraphInputs: 2 }
      )
    })

    it('keeps an instance and its links in place when endpoint updates are rejected', () => {
      const graph = new LGraph()
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'first', type: 'STRING' },
          { name: 'second', type: 'STRING' }
        ]
      })
      const host = createTestSubgraphNode(subgraph)
      graph.add(host)
      const source = new LGraphNode('Source')
      source.addOutput('out', 'STRING')
      graph.add(source)
      const link = source.connect(0, host, 0)!
      vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
        ok: false,
        error: { code: 'occupied-target', message: 'Target is occupied' }
      })
      const invalidatePromotedViews = vi.spyOn(host, 'invalidatePromotedViews')

      reorderSubgraphInputs(subgraph, [1, 0])

      expect(host.inputs.map(({ name }) => name)).toEqual(['first', 'second'])
      expect(link.target_slot).toBe(0)
      expect(invalidatePromotedViews).not.toHaveBeenCalled()
    })

    it('refuses an order that is not a permutation of the inputs', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'first', type: 'STRING' },
          { name: 'second', type: 'STRING' }
        ]
      })
      const host = createTestSubgraphNode(subgraph)

      expect(reorderSubgraphInputs(subgraph, [1, 1])).toBe(false)
      expect({
        subgraph: subgraph.inputs.map(({ name }) => name),
        host: host.inputs.map(({ name }) => name)
      }).toEqual({ subgraph: ['first', 'second'], host: ['first', 'second'] })
    })
  })

  describe('widgetless-first input order', () => {
    function connectWidget(subgraph: Subgraph, input: SubgraphInput) {
      const interior = new LGraphNode(`Interior ${input.name}`)
      const slot = interior.addInput('text', 'STRING')
      slot.widget = {
        name: interior.addWidget('text', 'text', '', () => {}).name
      }
      subgraph.add(interior)
      const link = input.connect(slot, interior)
      assert.exists(link)
      return link
    }

    function createSubgraphWithWidgetInputs() {
      const subgraph = createTestSubgraph({
        inputs: ['image', 'seed', 'mask', 'steps'].map((name) => ({
          name,
          type: 'STRING'
        }))
      })
      const [image, seed, mask, steps] = subgraph.inputs
      connectWidget(subgraph, seed)
      const stepsLink = connectWidget(subgraph, steps)
      const host = createTestSubgraphNode(subgraph)
      subgraph.rootGraph.add(host)
      return { subgraph, host, image, mask, steps, stepsLink }
    }

    function orders(subgraph: Subgraph, host: SubgraphNode) {
      return {
        subgraph: subgraph.inputs.map(({ name }) => name),
        host: host.inputs.map(({ name }) => name)
      }
    }

    it('moves an input that gains a widget to the end of the widget inputs', () => {
      const { subgraph, host, image } = createSubgraphWithWidgetInputs()
      const source = new LGraphNode('Source')
      source.addOutput('out', 'STRING')
      subgraph.rootGraph.add(source)
      const outerLink = source.connect(0, host, 0)

      connectWidget(subgraph, image)

      const order = ['mask', 'seed', 'steps', 'image']
      expect(orders(subgraph, host)).toEqual({ subgraph: order, host: order })
      expect(outerLink?.target_slot).toBe(3)
    })

    it('moves an input that loses its widget to the end of the widgetless inputs', () => {
      const { subgraph, host, stepsLink } = createSubgraphWithWidgetInputs()

      subgraph.removeLink(stepsLink.id)

      const order = ['image', 'mask', 'steps', 'seed']
      expect(orders(subgraph, host)).toEqual({ subgraph: order, host: order })
    })

    it('keeps each kind of input in the requested order when a reorder mixes them', () => {
      const { subgraph, host } = createSubgraphWithWidgetInputs()

      reorderSubgraphInputs(subgraph, [3, 1, 2, 0])

      const order = ['mask', 'image', 'steps', 'seed']
      expect(orders(subgraph, host)).toEqual({ subgraph: order, host: order })
    })

    it('removes a widget input that follows another widget input', () => {
      const { subgraph, host, steps } = createSubgraphWithWidgetInputs()

      subgraph.removeInput(steps)

      const order = ['image', 'mask', 'seed']
      expect(orders(subgraph, host)).toEqual({ subgraph: order, host: order })
    })
  })

  describe('reorderSubgraphOutputs', () => {
    it('moves every instance and both sides of each link into the new order', () => {
      const subgraph = createTestSubgraph({
        outputs: [
          { name: 'image', type: 'IMAGE' },
          { name: 'mask', type: 'MASK' },
          { name: 'count', type: 'INT' }
        ]
      })
      const interior = new LGraphNode('Interior')
      interior.addOutput('image', 'IMAGE')
      interior.addOutput('mask', 'MASK')
      interior.addOutput('count', 'INT')
      subgraph.add(interior)
      const innerLinks = subgraph.outputs.map((output, slot) =>
        output.connect(interior.outputs[slot], interior)
      )
      const graph = subgraph.rootGraph
      const linkedHost = createTestSubgraphNode(subgraph)
      graph.add(linkedHost)
      const otherHost = createTestSubgraphNode(subgraph)
      graph.add(otherHost)
      const consumer = new LGraphNode('Consumer')
      consumer.addInput('mask', 'MASK')
      consumer.addInput('count', 'INT')
      graph.add(consumer)
      const maskLink = linkedHost.connect(1, consumer, 0)
      const countLink = linkedHost.connect(2, consumer, 1)

      reorderSubgraphOutputs(subgraph, [2, 0, 1])

      const order = ['count', 'image', 'mask']
      expect({
        subgraph: subgraph.outputs.map(({ name }) => name),
        linkedHost: linkedHost.outputs.map(({ name }) => name),
        otherHost: otherHost.outputs.map(({ name }) => name),
        innerTargetSlots: innerLinks.map((link) => link?.target_slot),
        outerOriginSlots: [maskLink?.origin_slot, countLink?.origin_slot]
      }).toEqual({
        subgraph: order,
        linkedHost: order,
        otherHost: order,
        innerTargetSlots: [1, 2, 0],
        outerOriginSlots: [2, 0]
      })
    })

    it('refuses an order that is not a permutation of the outputs', () => {
      const subgraph = createTestSubgraph({
        outputs: [
          { name: 'image', type: 'IMAGE' },
          { name: 'mask', type: 'MASK' }
        ]
      })
      const host = createTestSubgraphNode(subgraph)

      expect(reorderSubgraphOutputs(subgraph, [0])).toBe(false)
      expect({
        subgraph: subgraph.outputs.map(({ name }) => name),
        host: host.outputs.map(({ name }) => name)
      }).toEqual({ subgraph: ['image', 'mask'], host: ['image', 'mask'] })
    })
  })
  describe('getDirectSubgraphIds', () => {
    it('should return empty set for graph with no subgraph nodes', () => {
      const graph = new LGraph()
      const result = getDirectSubgraphIds(graph)
      expect(result.size).toBe(0)
    })

    it('should find single subgraph node', () => {
      const graph = new LGraph()
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)
      graph.add(subgraphNode)

      const result = getDirectSubgraphIds(graph)
      expect(result.size).toBe(1)
      expect(result.has(subgraph.id)).toBe(true)
    })

    it('should find multiple unique subgraph nodes', () => {
      const graph = new LGraph()
      const subgraph1 = createTestSubgraph({ name: 'Subgraph 1' })
      const subgraph2 = createTestSubgraph({ name: 'Subgraph 2' })

      const node1 = createTestSubgraphNode(subgraph1)
      const node2 = createTestSubgraphNode(subgraph2)

      graph.add(node1)
      graph.add(node2)

      const result = getDirectSubgraphIds(graph)
      expect(result.size).toBe(2)
      expect(result.has(subgraph1.id)).toBe(true)
      expect(result.has(subgraph2.id)).toBe(true)
    })

    it('should return unique IDs when same subgraph is used multiple times', () => {
      const graph = new LGraph()
      const subgraph = createTestSubgraph()

      const node1 = createTestSubgraphNode(subgraph, { id: 1 })
      const node2 = createTestSubgraphNode(subgraph, { id: 2 })

      graph.add(node1)
      graph.add(node2)

      const result = getDirectSubgraphIds(graph)
      expect(result.size).toBe(1)
      expect(result.has(subgraph.id)).toBe(true)
    })
  })

  describe('findUsedSubgraphIds', () => {
    it('should handle graph with no subgraphs', () => {
      const graph = new LGraph()
      const registry = new Map<UUID, LGraph>()

      const result = findUsedSubgraphIds(graph, registry)
      expect(result.size).toBe(0)
    })

    it('should find nested subgraphs', () => {
      const rootGraph = new LGraph()
      const subgraph1 = createTestSubgraph({ name: 'Level 1' })
      const subgraph2 = createTestSubgraph({ name: 'Level 2' })

      // Add subgraph1 node to root
      const node1 = createTestSubgraphNode(subgraph1)
      rootGraph.add(node1)

      // Add subgraph2 node inside subgraph1
      const node2 = createTestSubgraphNode(subgraph2)
      subgraph1.add(node2)

      const registry = new Map<UUID, LGraph>([
        [subgraph1.id, subgraph1],
        [subgraph2.id, subgraph2]
      ])

      const result = findUsedSubgraphIds(rootGraph, registry)
      expect(result.size).toBe(2)
      expect(result.has(subgraph1.id)).toBe(true)
      expect(result.has(subgraph2.id)).toBe(true)
    })

    it('throws RangeError when graph.add() creates a circular subgraph reference', () => {
      const rootGraph = new LGraph()
      const subgraph1 = createTestSubgraph({ name: 'Subgraph 1' })
      const subgraph2 = createTestSubgraph({ name: 'Subgraph 2' })

      // Add subgraph1 to root
      const node1 = createTestSubgraphNode(subgraph1)
      rootGraph.add(node1)

      // Add subgraph2 to subgraph1
      const node2 = createTestSubgraphNode(subgraph2)
      subgraph1.add(node2)

      // Add subgraph1 to subgraph2 (circular reference)
      // Note: add() itself throws RangeError due to recursive forEachNode
      const node3 = createTestSubgraphNode(subgraph1, { id: 3 })
      expect(() => subgraph2.add(node3)).toThrow(RangeError)
    })

    it('should handle missing subgraphs in registry gracefully', () => {
      const rootGraph = new LGraph()
      const subgraph1 = createTestSubgraph({ name: 'Subgraph 1' })
      const subgraph2 = createTestSubgraph({ name: 'Subgraph 2' })

      // Add both subgraph nodes
      const node1 = createTestSubgraphNode(subgraph1)
      const node2 = createTestSubgraphNode(subgraph2)

      rootGraph.add(node1)
      rootGraph.add(node2)

      // Only register subgraph1
      const registry = new Map<UUID, LGraph>([[subgraph1.id, subgraph1]])

      const result = findUsedSubgraphIds(rootGraph, registry)
      expect(result.size).toBe(2)
      expect(result.has(subgraph1.id)).toBe(true)
      expect(result.has(subgraph2.id)).toBe(true) // Still found, just can't recurse into it
    })
  })
})
