import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphEventMode,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { RecursionError } from '@/lib/litegraph/src/infrastructure/RecursionError'
import { graphToPrompt } from '@/utils/executionUtil'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import {
  hostNodeDef,
  registerHostType
} from '@/platform/nodeApi/v4/defs/__fixtures__/hostNodeTypes'
import type {
  Comfy,
  OutputResolution,
  PackId,
  SuppliedEdge,
  Supplier,
  SupplyView,
  UnconnectedInput
} from '@/platform/nodeApi/v4/types'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'
import { addBackendNode, addNodeOfType } from './__fixtures__/promptGraphs'

const EVERYWHERE = 'Pack/Everywhere'

describe('a supplier', () => {
  let graph: LGraph
  let comfy: Comfy
  let packId: PackId
  let host: ComfyApiHost

  beforeEach(() => {
    graph = new LGraph()
    ;({ comfy, host } = createComfyApi({ getGraph: () => graph }))
    packId = registerTestPack({ comfy, host })
    registerHostType(host.nodeTypeHooks, hostNodeDef(EVERYWHERE))
  })

  function supplyWith(supply: Supplier, type = EVERYWHERE) {
    return comfy.defs.extend(packId, type, (builder) =>
      builder.setSupply(supply)
    )
  }

  function supplyAnswering(answer: (view: SupplyView) => unknown) {
    return comfy.defs.extend(packId, EVERYWHERE, (builder) =>
      Reflect.apply(builder.setSupply, builder, [answer])
    )
  }

  function addEverywhere(target: LGraph = graph): LGraphNode {
    const node = addNodeOfType(target, EVERYWHERE)
    node.addInput('anything', 'STRING')
    node.addOutput('out', 'STRING')
    return node
  }

  function everythingTo(
    from: SuppliedEdge['from'],
    priority?: number
  ): Supplier {
    return ({ self, unconnectedInputs }) =>
      unconnectedInputs()
        .filter(({ nodeId }) => nodeId !== self.id)
        .map(({ nodeId, input }) => ({
          to: { nodeId, input },
          from,
          ...(priority === undefined ? {} : { priority })
        }))
  }

  async function promptOf(target: LGraph = graph) {
    const { output } = await graphToPrompt(target, {
      frontendExecution: host.frontendExecution
    })
    return output
  }

  async function inputsOf(node: LGraphNode, target = graph) {
    const output = await promptOf(target)
    return output[String(node.id)].inputs
  }

  describe('in the prompt', () => {
    it('feeds an unlinked input from one of its outputs', async () => {
      supplyWith(everythingTo({ output: 0 }))
      const supplier = addEverywhere()
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({ x: [String(supplier.id), 0] })
    })

    it('fails the build with the circular reference error of the host on a cycle through forwarded inputs', async () => {
      supplyWith(everythingTo({ forwardInput: 0 }))
      addEverywhere()
      addEverywhere()

      await expect(promptOf()).rejects.toThrow(RecursionError)
    })

    it('feeds an unlinked input from whatever feeds one of its inputs', async () => {
      supplyWith(everythingTo({ forwardInput: 0 }))
      const source = addBackendNode(graph, 'Source', { outputs: ['text'] })
      const supplier = addEverywhere()
      source.connect(0, supplier, 0)
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({ x: [String(source.id), 0] })
    })

    it('feeds the socket form of a widget in place of the widget value', async () => {
      supplyWith(everythingTo({ output: 0 }))
      const supplier = addEverywhere()
      const consumer = addBackendNode(graph, 'Consumer')
      consumer.addWidget('number', 'seed', 4, () => {})
      consumer.addInput('seed', 'STRING', { widget: { name: 'seed' } })

      expect(await inputsOf(consumer)).toEqual({
        seed: [String(supplier.id), 0]
      })
    })

    it('leaves a linked input to its link, beside an input it feeds', async () => {
      supplyWith(everythingTo({ output: 0 }))
      const supplier = addEverywhere()
      const source = addBackendNode(graph, 'Source', { outputs: ['text'] })
      const consumer = addBackendNode(graph, 'Consumer', {
        inputs: ['x', 'y']
      })
      source.connect(0, consumer, 0)

      expect(await inputsOf(consumer)).toEqual({
        x: [String(source.id), 0],
        y: [String(supplier.id), 0]
      })
    })

    it('feeds through a bypassed node whose input it supplies', async () => {
      supplyWith(({ unconnectedInputs }) =>
        unconnectedInputs()
          .filter(({ nodeType }) => nodeType === 'Bypassed')
          .map(({ nodeId, input }) => ({
            to: { nodeId, input },
            from: { output: 0 }
          }))
      )
      const supplier = addEverywhere()
      const bypassed = addBackendNode(graph, 'Bypassed', {
        inputs: ['in'],
        outputs: ['out']
      })
      bypassed.mode = LGraphEventMode.BYPASS
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      bypassed.connect(0, consumer, 0)

      expect(await inputsOf(consumer)).toEqual({ x: [String(supplier.id), 0] })
    })

    it("passes the fed input's type on, so a bypassed node behind the supply picks the input of that type", async () => {
      supplyWith(everythingTo({ forwardInput: 0 }))
      const text = addBackendNode(graph, 'Text', { outputs: ['text'] })
      const wanted = addBackendNode(graph, 'Number')
      wanted.addOutput('number', 'INT')
      const choice = addBackendNode(graph, 'Choice')
      choice.addInput('text', 'STRING')
      choice.addInput('number', 'INT')
      choice.addOutput('out', 'INT')
      choice.mode = LGraphEventMode.BYPASS
      text.connect(0, choice, 0)
      wanted.connect(0, choice, 1)
      const supplier = addNodeOfType(graph, EVERYWHERE)
      supplier.addInput('anything', '*')
      choice.connect(0, supplier, 0)
      const consumer = addBackendNode(graph, 'Consumer')
      consumer.addInput('x', 'INT')

      expect(await inputsOf(consumer)).toEqual({ x: [String(wanted.id), 0] })
    })

    it("feeds a resolved frontend node's answer when it supplies from its own output", async () => {
      comfy.defs.define(packId, {
        type: 'Pack/Constant',
        execution: 'frontend',
        outputs: [{ name: 'out', type: 'STRING' }],
        resolve: () => ({ 0: { literal: 'constant' } })
      })
      supplyWith(everythingTo({ output: 0 }), 'Pack/Constant')
      addNodeOfType(graph, 'Pack/Constant')
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({ x: 'constant' })
    })

    it('feeds the inputs of its own graph only, in each placement from its own sources', async () => {
      supplyWith(everythingTo({ forwardInput: 0 }))
      const rootConsumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      const { subgraph, consumer } = subgraphWithSupplier()
      const placements = [1, 2].map(() => {
        const source = addBackendNode(graph, 'Source', { outputs: ['text'] })
        const placement = createTestSubgraphNode(subgraph)
        graph.add(placement)
        source.connect(0, placement, 0)
        return { source, placement }
      })

      const output = await promptOf()

      expect(output[String(rootConsumer.id)].inputs).toEqual({})
      for (const { source, placement } of placements) {
        expect(output[`${placement.id}:${consumer.id}`].inputs).toEqual({
          x: [String(source.id), 0]
        })
      }
    })

    it('stops feeding once its extension is unsubscribed', async () => {
      const stop = supplyWith(everythingTo({ output: 0 }))
      addEverywhere()
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      stop()

      expect(await inputsOf(consumer)).toEqual({})
    })
  })

  describe('claims on one input', () => {
    function twoSuppliers(first: Supplier, second: Supplier) {
      registerHostType(host.nodeTypeHooks, hostNodeDef('Pack/Second'))
      supplyWith(first)
      supplyWith(second, 'Pack/Second')
      const one = addEverywhere()
      const other = addNodeOfType(graph, 'Pack/Second')
      other.addOutput('out', 'STRING')
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      return { one, other, consumer }
    }

    it('feeds the input from the highest claim', async () => {
      const { other, consumer } = twoSuppliers(
        everythingTo({ output: 0 }, 5),
        everythingTo({ output: 0 }, 6)
      )

      expect(await inputsOf(consumer)).toEqual({ x: [String(other.id), 0] })
    })

    it.for([
      { other: -1, winner: 'the claim with no priority' },
      { other: 0.5, winner: 'the other' }
    ])(
      'counts a claim with no priority as 0, so against $other $winner feeds',
      async ({ other }) => {
        const {
          one,
          other: second,
          consumer
        } = twoSuppliers(
          everythingTo({ output: 0 }),
          everythingTo({ output: 0 }, other)
        )
        const winner = other < 0 ? one : second

        expect(await inputsOf(consumer)).toEqual({
          x: [String(winner.id), 0]
        })
      }
    )

    it('feeds nothing on equal highest claims, and reports it', async () => {
      const { consumer } = twoSuppliers(
        everythingTo({ output: 0 }, 2),
        everythingTo({ output: 0 }, 2)
      )

      expect(await inputsOf(consumer)).toEqual({})
      expect(reportError).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'node_api_supply_conflict',
          tags: { input: `${consumer.id}:0` }
        })
      )
    })

    it('feeds an input that one supplier claims twice the same way', async () => {
      const claimTwice: Supplier = (view) => [
        ...everythingTo({ output: 0 })(view),
        ...everythingTo({ output: 0 })(view)
      ]
      supplyWith(claimTwice)
      const supplier = addEverywhere()
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({ x: [String(supplier.id), 0] })
      expect(reportError).not.toHaveBeenCalled()
    })

    it('feeds nothing when one supplier claims an input two ways', async () => {
      const claimTwoWays: Supplier = (view) => [
        ...everythingTo({ output: 0 })(view),
        ...everythingTo({ forwardInput: 0 })(view)
      ]
      supplyWith(claimTwoWays)
      const source = addBackendNode(graph, 'Source', { outputs: ['text'] })
      source.connect(0, addEverywhere(), 0)
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({})
    })

    it('feeds nothing when one supplier claims an input from two of its outputs', async () => {
      const claimTwoOutputs: Supplier = (view) => [
        ...everythingTo({ output: 0 })(view),
        ...everythingTo({ output: 1 })(view)
      ]
      supplyWith(claimTwoOutputs)
      addEverywhere().addOutput('second', 'STRING')
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({})
    })
  })

  describe('when it is asked', () => {
    it('is asked once per node in a build, with that node', async () => {
      const supply = vi.fn<Supplier>(() => [])
      supplyWith(supply)
      const supplier = addEverywhere()
      addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      await promptOf()

      expect(supply).toHaveBeenCalledOnce()
      expect(supply.mock.calls[0][0].self.id).toBe(String(supplier.id))
      expect(Object.isFrozen(supply.mock.calls[0][0])).toBe(true)
      expect(Object.isFrozen(supply.mock.calls[0][0].unconnectedInputs)).toBe(
        true
      )
      expect(supply.mock.calls[0][0].unconnectedInputs).not.toHaveProperty(
        'prototype'
      )
    })

    it('is not asked for a node that joined before its extension was made, and is for one that joins after', async () => {
      comfy.defs.extend(packId, EVERYWHERE, (builder) =>
        builder.onCreated(() => {})
      )
      addEverywhere()
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      const supply = vi.fn(everythingTo({ output: 0 }))
      supplyWith(supply)

      expect(await inputsOf(consumer)).toEqual({})
      expect(supply).not.toHaveBeenCalled()

      const late = addEverywhere()

      expect(await inputsOf(consumer)).toEqual({ x: [String(late.id), 0] })
      expect(supply.mock.calls.map(([view]) => view.self.id)).toEqual([
        String(late.id)
      ])
    })

    it('is not asked for a node of a class registered over the type it extends', async () => {
      const supply = vi.fn(everythingTo({ output: 0 }))
      supplyWith(supply)
      class Legacy extends LGraphNode {}
      LiteGraph.registerNodeType(EVERYWHERE, Legacy)
      addEverywhere()
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({})
      expect(supply).not.toHaveBeenCalled()
    })

    it.for([
      { mode: 'muted', value: LGraphEventMode.NEVER },
      { mode: 'bypassed', value: LGraphEventMode.BYPASS }
    ])('is not asked for a $mode node', async ({ value }) => {
      const supply = vi.fn(everythingTo({ output: 0 }))
      supplyWith(supply)
      const supplier = addEverywhere()
      supplier.mode = value
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({})
      expect(supply).not.toHaveBeenCalled()
    })

    it('reports a supplier that throws, and keeps the others feeding', async () => {
      registerHostType(host.nodeTypeHooks, hostNodeDef('Pack/Second'))
      supplyWith(() => {
        throw new Error('broken')
      })
      supplyWith(everythingTo({ output: 0 }), 'Pack/Second')
      addEverywhere()
      const other = addNodeOfType(graph, 'Pack/Second')
      other.addOutput('out', 'STRING')
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({ x: [String(other.id), 0] })
      expect(reportError).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'broken' }),
        expect.objectContaining({ tags: { event: 'setSupply' } })
      )
    })

    it('reports the rejection of an async supplier as well as the refusal of its promise', async () => {
      const rejected = new Error('later')
      Reflect.apply(supplyWith, undefined, [
        async () => {
          throw rejected
        }
      ])
      addEverywhere()
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({})
      await Promise.resolve()
      expect(reportError).toHaveBeenCalledTimes(2)
      expect(reportError).toHaveBeenCalledWith(
        rejected,
        expect.objectContaining({ tags: { event: 'setSupply' } })
      )
    })

    it.for([
      { name: 'an answer that is not a list', answer: () => ({}) },
      { name: 'an edge that is not an object', answer: () => ['edge'] },
      {
        name: 'an edge with another field',
        answer: (view: SupplyView) => [{ ...edgeTo(view), note: 1 }]
      },
      {
        name: 'a to that is not an unconnected input',
        answer: (view: SupplyView) => [
          { ...edgeTo(view), to: { ...edgeTo(view).to, input: 5 } }
        ]
      },
      {
        name: 'a to with another field',
        answer: (view: SupplyView) => [
          { ...edgeTo(view), to: { ...edgeTo(view).to, graphId: 'g' } }
        ]
      },
      {
        name: 'a to that is not an object',
        answer: (view: SupplyView) => [{ ...edgeTo(view), to: 'x' }]
      },
      {
        name: 'a from that is not an object',
        answer: (view: SupplyView) => [{ ...edgeTo(view), from: 0 }]
      },
      {
        name: 'a from of an output the supplier lacks',
        answer: (view: SupplyView) => [{ ...edgeTo(view), from: { output: 1 } }]
      },
      {
        name: 'a from of an input the supplier lacks',
        answer: (view: SupplyView) => [
          { ...edgeTo(view), from: { forwardInput: 1 } }
        ]
      },
      {
        name: 'a from of a negative output',
        answer: (view: SupplyView) => [
          { ...edgeTo(view), from: { output: -1 } }
        ]
      },
      {
        name: 'a from of a fractional output',
        answer: (view: SupplyView) => [
          { ...edgeTo(view), from: { output: 0.5 } }
        ]
      },
      {
        name: 'a from of a literal',
        answer: (view: SupplyView) => [
          { ...edgeTo(view), from: { literal: 1 } }
        ]
      },
      {
        name: 'a from of two kinds',
        answer: (view: SupplyView) => [
          { ...edgeTo(view), from: { output: 0, forwardInput: 0 } }
        ]
      },
      {
        name: 'a priority that is not a number',
        answer: (view: SupplyView) => [{ ...edgeTo(view), priority: '1' }]
      },
      {
        name: 'a priority that is not finite',
        answer: (view: SupplyView) => [{ ...edgeTo(view), priority: Infinity }]
      }
    ])('reports $name, and feeds nothing from it', async ({ answer }) => {
      supplyAnswering(answer)
      addEverywhere()
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({})
      expect(reportError).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('setSupply needs')
        }),
        expect.anything()
      )
    })

    it('feeds from a well-formed edge, the control for the refusals above', async () => {
      supplyAnswering((view) => [edgeTo(view)])
      const supplier = addEverywhere()
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(await inputsOf(consumer)).toEqual({ x: [String(supplier.id), 0] })
      expect(reportError).not.toHaveBeenCalled()
    })

    it('refuses a supplier that is not a function', () => {
      let refusal: unknown
      comfy.defs.extend(packId, EVERYWHERE, (builder) => {
        try {
          Reflect.apply(builder.setSupply, builder, [{}])
        } catch (error) {
          refusal = error
        }
      })

      expect(refusal).toBeInstanceOf(TypeError)
    })
  })

  describe('the unconnected inputs', () => {
    async function inputsSeen(setUp: () => void) {
      let seen: readonly UnconnectedInput[] | undefined
      supplyWith(({ unconnectedInputs }) => {
        seen = unconnectedInputs()
        return []
      })
      addEverywhere()
      setUp()
      await promptOf()
      assert(seen)
      return seen
    }

    it('lists each input no link feeds, of the nodes sent to the backend, in graph order', async () => {
      let first: LGraphNode | undefined
      let second: LGraphNode | undefined
      const seen = await inputsSeen(() => {
        first = addBackendNode(graph, 'First', { inputs: ['a', 'b'] })
        second = addBackendNode(graph, 'Second', { inputs: ['c'] })
        const source = addBackendNode(graph, 'Source', { outputs: ['text'] })
        source.connect(0, first, 0)
        comfy.defs.define(packId, {
          type: 'Pack/Frontend',
          execution: 'frontend',
          inputs: [{ name: 'f', type: 'STRING' }]
        })
        addNodeOfType(graph, 'Pack/Frontend')
        const subgraph = createTestSubgraph({
          rootGraph: graph,
          inputs: [{ name: 's', type: 'STRING' }]
        })
        graph.subgraphs.set(subgraph.id, subgraph)
        graph.add(createTestSubgraphNode(subgraph))
      })
      assert(first && second)

      expect(seen.map(({ nodeId, name }) => [nodeId, name])).toEqual([
        [String(graph.nodes[0].id), 'anything'],
        [String(first.id), 'b'],
        [String(second.id), 'c']
      ])
      expect(Object.isFrozen(seen)).toBe(true)
      expect(Object.isFrozen(seen[1])).toBe(true)
    })

    it('describes the input and its node', async () => {
      const seen = await inputsSeen(() => {
        const node = addBackendNode(graph, 'Target')
        node.title = 'My target'
        node.color = '#222'
        node.properties.optIn = { seed: true }
        node.addInput('seed', 'INT', {
          widget: { name: 'seed' },
          localized_name: 'Graine'
        })
        node.pos = [10, 10]
        node.size = [40, 40]
        const group = new LGraphGroup('Area')
        group.pos = [0, 0]
        group.size = [300, 300]
        graph.add(group)
      })
      const target = graph.nodes.find((node) => node.type === 'Target')
      assert(target)

      expect(seen.at(-1)).toEqual({
        nodeId: String(target.id),
        nodeType: 'Target',
        nodeTitle: 'My target',
        nodeMode: 'always',
        nodeColor: '#222',
        nodeGroups: [{ id: String(graph.groups[0].id), title: 'Area' }],
        nodeProperties: { optIn: { seed: true } },
        input: 0,
        name: 'seed',
        label: 'Graine',
        type: 'INT',
        isWidgetInput: true
      })
      expect(Object.isFrozen(seen.at(-1)?.nodeProperties.optIn)).toBe(true)
    })

    it('marks a plain input as not the socket of a widget', async () => {
      const seen = await inputsSeen(() => {
        addBackendNode(graph, 'Target', { inputs: ['x'] })
      })

      expect(seen.at(-1)).toMatchObject({ name: 'x', isWidgetInput: false })
    })

    it('gives every supplier of a graph the same list in a build', async () => {
      const lists: (readonly UnconnectedInput[])[] = []
      registerHostType(host.nodeTypeHooks, hostNodeDef('Pack/Second'))
      const listing: Supplier = ({ unconnectedInputs }) => {
        lists.push(unconnectedInputs())
        return []
      }
      supplyWith(listing)
      supplyWith(listing, 'Pack/Second')
      addEverywhere()
      addNodeOfType(graph, 'Pack/Second')

      await promptOf()

      expect(lists).toHaveLength(2)
      expect(lists[0]).toBe(lists[1])
    })
  })

  describe('resolvedSupplies', () => {
    it('gives the winning supplies of the graph on screen, in input order, as frozen data', () => {
      supplyWith(everythingTo({ output: 0 }))
      const supplier = addEverywhere()
      const first = addBackendNode(graph, 'Consumer', { inputs: ['x', 'y'] })

      const supplies = comfy.graph.resolvedSupplies()

      const from = { kind: 'output', nodeId: String(supplier.id), output: 0 }
      expect(supplies).toEqual([
        {
          supplierNodeId: String(supplier.id),
          to: { nodeId: String(first.id), input: 0 },
          from
        },
        {
          supplierNodeId: String(supplier.id),
          to: { nodeId: String(first.id), input: 1 },
          from
        }
      ])
      assert(supplies)
      expect(Object.isFrozen(supplies)).toBe(true)
      expect(Object.isFrozen(supplies[0])).toBe(true)
      expect(Object.isFrozen(supplies[0].to)).toBe(true)
      expect(Object.isFrozen(supplies[0].from)).toBe(true)
    })

    it('gives the output that feeds a forwarded input', () => {
      supplyWith(everythingTo({ forwardInput: 0 }))
      const source = addBackendNode(graph, 'Source', {
        outputs: ['first', 'second']
      })
      source.connect(1, addEverywhere(), 0)
      addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(comfy.graph.resolvedSupplies()[0].from).toEqual({
        kind: 'output',
        nodeId: String(source.id),
        output: 1
      })
    })

    it('gives the source of a forwarded input, followed through resolved nodes', () => {
      comfy.defs.define(packId, {
        type: 'Pack/Wire',
        execution: 'frontend',
        inputs: [{ name: 'in', type: 'STRING' }],
        outputs: [{ name: 'out', type: 'STRING' }],
        resolve: ({ self }) => ({
          0: { forwardTo: { nodeId: self.id, input: 0 } }
        })
      })
      supplyWith(everythingTo({ forwardInput: 0 }))
      const source = addBackendNode(graph, 'Source', { outputs: ['text'] })
      const wire = addNodeOfType(graph, 'Pack/Wire')
      const supplier = addEverywhere()
      source.connect(0, wire, 0)
      wire.connect(0, supplier, 0)
      addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(comfy.graph.resolvedSupplies()[0].from).toEqual({
        kind: 'output',
        nodeId: String(source.id),
        output: 0
      })
    })

    it.for<{ answer: OutputResolution; kind: string }>([
      { answer: { literal: 'text' }, kind: 'literal' },
      { answer: { omit: true }, kind: 'omitted' }
    ])(
      'gives a $kind source for a resolved node that answers so',
      ({ answer, kind }) => {
        comfy.defs.define(packId, {
          type: 'Pack/Answer',
          execution: 'frontend',
          outputs: [{ name: 'out', type: 'STRING' }],
          resolve: () => ({ 0: answer })
        })
        supplyWith(everythingTo({ forwardInput: 0 }))
        const answering = addNodeOfType(graph, 'Pack/Answer')
        const supplier = addEverywhere()
        answering.connect(0, supplier, 0)
        addBackendNode(graph, 'Consumer', { inputs: ['x'] })

        const from = comfy.graph.resolvedSupplies()[0].from
        expect(from).toEqual({ kind })
        expect(Object.isFrozen(from)).toBe(true)
      }
    )

    it('gives the output of a bypassed resolved node, which a link can start at', () => {
      comfy.defs.define(packId, {
        type: 'Pack/Answer',
        execution: 'frontend',
        outputs: [{ name: 'out', type: 'STRING' }],
        resolve: () => ({ 0: { omit: true } })
      })
      supplyWith(everythingTo({ forwardInput: 0 }))
      const answering = addNodeOfType(graph, 'Pack/Answer')
      answering.mode = LGraphEventMode.BYPASS
      const supplier = addEverywhere()
      answering.connect(0, supplier, 0)
      addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(comfy.graph.resolvedSupplies()[0].from).toEqual({
        kind: 'output',
        nodeId: String(answering.id),
        output: 0
      })
    })

    it('gives an omitted source for a forwarded input no link feeds', () => {
      supplyWith(everythingTo({ forwardInput: 0 }))
      addEverywhere()
      addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(comfy.graph.resolvedSupplies()[0].from).toEqual({
        kind: 'omitted'
      })
    })

    it('gives an omitted source for a cycle through resolved nodes', () => {
      comfy.defs.define(packId, {
        type: 'Pack/Wire',
        execution: 'frontend',
        inputs: [{ name: 'in', type: 'STRING' }],
        outputs: [{ name: 'out', type: 'STRING' }],
        resolve: ({ self }) => ({
          0: { forwardTo: { nodeId: self.id, input: 0 } }
        })
      })
      supplyWith(everythingTo({ forwardInput: 0 }))
      const first = addNodeOfType(graph, 'Pack/Wire')
      const second = addNodeOfType(graph, 'Pack/Wire')
      first.connect(0, second, 0)
      second.connect(0, first, 0)
      first.connect(0, addEverywhere(), 0)
      addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(comfy.graph.resolvedSupplies()[0].from).toEqual({
        kind: 'omitted'
      })
    })

    it("gives a subgraph's own supplies through its scope, an input from outside it omitted", () => {
      supplyWith(everythingTo({ forwardInput: 0 }))
      const { subgraph, consumer, supplier } = subgraphWithSupplier()
      const scope = comfy.graph.subgraphs().find(({ id }) => id === subgraph.id)
      assert(scope)

      expect(scope.resolvedSupplies()).toEqual([
        {
          supplierNodeId: String(supplier.id),
          to: { nodeId: String(consumer.id), input: 0 },
          from: { kind: 'omitted' }
        }
      ])
      expect(comfy.graph.resolvedSupplies()).toEqual([])
    })

    it('reports a supplier that reads properties a workflow cannot save, and drops its answer', () => {
      supplyWith((view) => {
        void view.self.properties
        return everythingTo({ output: 0 })(view)
      })
      Reflect.set(addEverywhere().properties, 'big', 1n)
      addBackendNode(graph, 'Consumer', { inputs: ['x'] })

      expect(comfy.graph.resolvedSupplies()).toEqual([])
      expect(reportError).toHaveBeenCalledOnce()
    })

    it('asks the suppliers again on each read', () => {
      const supply = vi.fn<Supplier>(() => [])
      supplyWith(supply)
      addEverywhere()

      comfy.graph.resolvedSupplies()
      comfy.graph.resolvedSupplies()

      expect(supply).toHaveBeenCalledTimes(2)
    })

    it('reads nothing with no graph on screen, or from a scope that is gone', () => {
      supplyWith(everythingTo({ output: 0 }))
      const root = comfy.graph.root()
      assert(root)
      graph.clear()
      const replaced = new LGraph()

      expect(root.resolvedSupplies()).toBeUndefined()
      graph = replaced
      expect(comfy.graph.resolvedSupplies()).toEqual([])
      ;({ comfy } = createComfyApi({ getGraph: () => null }))
      expect(comfy.graph.resolvedSupplies()).toEqual([])
    })
  })

  function subgraphWithSupplier(): {
    subgraph: Subgraph
    consumer: LGraphNode
    supplier: LGraphNode
  } {
    const subgraph = createTestSubgraph({
      rootGraph: graph,
      inputs: [{ name: 'text', type: 'STRING' }]
    })
    graph.subgraphs.set(subgraph.id, subgraph)
    const supplier = addNodeOfType(subgraph, EVERYWHERE)
    supplier.addInput('anything', 'STRING')
    subgraph.inputNode.slots[0].connect(supplier.inputs[0], supplier)
    const consumer = addBackendNode(subgraph, 'Consumer', { inputs: ['x'] })
    return { subgraph, consumer, supplier }
  }
})

function edgeTo(view: SupplyView): SuppliedEdge {
  const target = view
    .unconnectedInputs()
    .find(({ nodeType }) => nodeType === 'Consumer')
  assert(target)
  return {
    to: { nodeId: target.nodeId, input: target.input },
    from: { output: 0 }
  }
}
