import { reportError } from '@comfyorg/telemetry/reportError'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphEventMode,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphToPrompt } from '@/utils/executionUtil'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type {
  Comfy,
  ResolveView,
  ResolvedNodeView,
  Resolver
} from '@/platform/nodeApi/v4/types'
import { addBackendNode, addNodeOfType } from './__fixtures__/promptGraphs'

const WIRE = 'Pack/Wire'

describe('a frontend node type with a resolver', () => {
  let graph: LGraph
  let comfy: Comfy
  let host: ComfyApiHost

  beforeEach(() => {
    graph = new LGraph()
    ;({ comfy, host } = createComfyApi({ getGraph: () => graph }))
  })

  function defineWire(resolve: Resolver, type = WIRE) {
    return comfy.defs.define({
      type,
      execution: 'frontend',
      inputs: [
        { name: 'in', type: 'STRING' },
        { name: 'other', type: 'STRING' }
      ],
      outputs: [
        { name: 'out', type: 'STRING' },
        { name: 'second', type: 'STRING' }
      ],
      resolve
    })
  }

  function defineWireAnswering(answerFor: (wireId: string) => unknown) {
    Reflect.apply(comfy.defs.define, comfy.defs, [
      {
        type: WIRE,
        execution: 'frontend',
        inputs: [{ name: 'in', type: 'STRING' }],
        outputs: [{ name: 'out', type: 'STRING' }],
        resolve: (view: ResolveView) => answerFor(view.self.id)
      }
    ])
  }

  async function promptOf(target: LGraph = graph) {
    const { output } = await graphToPrompt(target, {
      frontendExecution: host.frontendExecution
    })
    return output
  }

  function sourceWireConsumer(target: LGraph = graph) {
    const source = addBackendNode(target, 'Source', { outputs: ['text'] })
    const wire = addNodeOfType(target, WIRE)
    const consumer = addBackendNode(target, 'Consumer', { inputs: ['x'] })
    source.connect(0, wire, 0)
    wire.connect(0, consumer, 0)
    return { source, wire, consumer }
  }

  async function consumerInput(consumer: LGraphNode, target = graph) {
    const output = await promptOf(target)
    return output[String(consumer.id)].inputs.x
  }

  describe('forwardTo', () => {
    it('feeds the consumer from whatever feeds the input the output forwards to', async () => {
      defineWire(({ self }) => ({
        0: { forwardTo: { nodeId: self.id, input: 0 } }
      }))
      const { source, wire, consumer } = sourceWireConsumer()

      const output = await promptOf()

      expect(output[String(consumer.id)].inputs.x).toEqual([
        String(source.id),
        0
      ])
      expect(output).not.toHaveProperty(String(wire.id))
    })

    it('forwards to an input of another node of its graph', async () => {
      defineWire(({ nodesOfType }) => {
        const input = nodesOfType('Pack/Setter').at(0)?.input('value')
        return { out: input ? { forwardTo: input } : { omit: true } }
      })
      comfy.defs.define({
        type: 'Pack/Setter',
        execution: 'frontend',
        inputs: [{ name: 'value', type: 'STRING' }]
      })
      const source = addBackendNode(graph, 'Source', { outputs: ['text'] })
      const setter = addNodeOfType(graph, 'Pack/Setter')
      source.connect(0, setter, 0)
      const wire = addNodeOfType(graph, WIRE)
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      wire.connect(0, consumer, 0)

      expect(await consumerInput(consumer)).toEqual([String(source.id), 0])
    })

    it('follows a chain of resolved nodes', async () => {
      defineWire(({ self }) => ({
        0: { forwardTo: { nodeId: self.id, input: 0 } }
      }))
      const { source, wire, consumer } = sourceWireConsumer()
      const between = addNodeOfType(graph, WIRE)
      source.connect(0, between, 0)
      between.connect(0, wire, 0)

      expect(await consumerInput(consumer)).toEqual([String(source.id), 0])
    })

    it('feeds nothing when the input it forwards to has no link', async () => {
      defineWire(({ self }) => ({
        0: { forwardTo: { nodeId: self.id, input: 1 } }
      }))
      const { consumer } = sourceWireConsumer()

      expect(await consumerInput(consumer)).toBeUndefined()
    })

    it('fails the build on a cycle through resolvers, as a cycle of links does', async () => {
      defineWire(({ self }) => ({
        0: { forwardTo: { nodeId: self.id, input: 0 } }
      }))
      const first = addNodeOfType(graph, WIRE)
      const second = addNodeOfType(graph, WIRE)
      first.connect(0, second, 0)
      second.connect(0, first, 0)
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      second.connect(0, consumer, 0)

      await expect(promptOf()).rejects.toThrow('Circular reference')
    })
  })

  describe('literal and omit', () => {
    it('feeds the consumer a literal', async () => {
      defineWire(() => ({ 0: { literal: 'a cat' } }))
      const { consumer } = sourceWireConsumer()

      expect(await consumerInput(consumer)).toBe('a cat')
    })

    it('wraps a list literal as the prompt wraps a list value', async () => {
      defineWire(() => ({ 0: { literal: ['a', 'b'] } }))
      const { consumer } = sourceWireConsumer()

      expect(await consumerInput(consumer)).toEqual({ __value__: ['a', 'b'] })
    })

    it('gives each consumer its own unfrozen copy of an object literal', async () => {
      defineWire(() => ({ 0: { literal: { width: 2 } } }))
      const { wire, consumer } = sourceWireConsumer()
      const second = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      wire.connect(0, second, 0)

      const output = await promptOf()
      const first = output[String(consumer.id)].inputs.x
      const other = output[String(second.id)].inputs.x

      expect(first).toEqual({ width: 2 })
      expect(first).not.toBe(other)
      expect(Object.isFrozen(first)).toBe(false)
    })

    it('leaves the consumer input out for an omitted output', async () => {
      defineWire(() => ({ 0: { omit: true } }))
      const { consumer } = sourceWireConsumer()

      const output = await promptOf()

      expect(output[String(consumer.id)].inputs).not.toHaveProperty('x')
    })

    it('names an output by name as well as by index', async () => {
      defineWire(() => ({ second: { literal: 2 }, out: { literal: 1 } }))
      const { wire, consumer } = sourceWireConsumer()
      const fromSecond = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      wire.connect(1, fromSecond, 0)

      expect(await consumerInput(consumer)).toBe(1)
      expect(await consumerInput(fromSecond)).toBe(2)
    })
  })

  describe('an output the answer does not name', () => {
    it('is built as for a frontend node with no resolver', async () => {
      defineWire(() => ({ 1: { omit: true } }))
      const { source, consumer } = sourceWireConsumer()

      expect(await consumerInput(consumer)).toEqual([String(source.id), 0])
    })

    it('matches a frontend node with no resolver at all', async () => {
      comfy.defs.define({
        type: WIRE,
        execution: 'frontend',
        inputs: [{ name: 'in', type: 'STRING' }],
        outputs: [{ name: 'out', type: 'STRING' }]
      })
      const { source, consumer } = sourceWireConsumer()

      expect(await consumerInput(consumer)).toEqual([String(source.id), 0])
    })
  })

  describe('modes', () => {
    it('is not asked for a muted node, which feeds nothing', async () => {
      const resolve = vi.fn(() => ({ 0: { literal: 'x' } }))
      defineWire(resolve)
      const { wire, consumer } = sourceWireConsumer()
      wire.mode = LGraphEventMode.NEVER

      expect(await consumerInput(consumer)).toBeUndefined()
      expect(resolve).not.toHaveBeenCalled()
    })

    it('is not asked for a bypassed node, which passes its input through', async () => {
      const resolve = vi.fn(() => ({ 0: { literal: 'x' } }))
      defineWire(resolve)
      const { source, wire, consumer } = sourceWireConsumer()
      wire.mode = LGraphEventMode.BYPASS

      expect(await consumerInput(consumer)).toEqual([String(source.id), 0])
      expect(resolve).not.toHaveBeenCalled()
    })

    it('is asked for a node that runs, the control for the two above', async () => {
      const resolve = vi.fn(() => ({ 0: { literal: 'x' } }))
      defineWire(resolve)
      const { consumer } = sourceWireConsumer()

      expect(await consumerInput(consumer)).toBe('x')
      expect(resolve).toHaveBeenCalledOnce()
    })
  })

  describe('when it is asked', () => {
    it('is asked once per node in a build, however many consumers it has', async () => {
      const resolve = vi.fn(() => ({ 0: { literal: 'x' } }))
      defineWire(resolve)
      const { wire } = sourceWireConsumer()
      wire.connect(0, addBackendNode(graph, 'Consumer', { inputs: ['x'] }), 0)

      await promptOf()
      expect(resolve).toHaveBeenCalledOnce()

      await promptOf()
      expect(resolve).toHaveBeenCalledTimes(2)
    })

    it('is not asked when nothing in the prompt reads its outputs', async () => {
      const resolve = vi.fn(() => ({ 0: { literal: 'x' } }))
      defineWire(resolve)
      addNodeOfType(graph, WIRE)

      await promptOf()

      expect(resolve).not.toHaveBeenCalled()
    })

    it('stops answering once the definition is unsubscribed', async () => {
      const stop = defineWire(() => ({ 0: { literal: 'x' } }))
      const { source, consumer } = sourceWireConsumer()

      stop()

      expect(await consumerInput(consumer)).toEqual([String(source.id), 0])
    })

    it('keeps the resolver of a later definition of the type when an earlier one is unsubscribed', async () => {
      const stopEarlier = defineWire(() => ({ 0: { literal: 'earlier' } }))
      LiteGraph.unregisterNodeType(WIRE)
      defineWire(() => ({ 0: { literal: 'later' } }))
      const { consumer } = sourceWireConsumer()

      stopEarlier()

      expect(await consumerInput(consumer)).toBe('later')
    })
  })

  describe('failures', () => {
    it('reports a resolver that throws, and builds the node as if it had none', async () => {
      defineWire(() => {
        throw new Error('preset missing')
      })
      const { source, consumer } = sourceWireConsumer()

      expect(await consumerInput(consumer)).toEqual([String(source.id), 0])
      expect(reportError).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'preset missing' }),
        expect.objectContaining({ tags: { event: 'resolve' } })
      )
    })

    it('keeps another node resolving when one resolver throws', async () => {
      defineWire(() => {
        throw new Error('broken')
      })
      defineWire(() => ({ 0: { literal: 'fine' } }), 'Pack/Fine')
      sourceWireConsumer()
      const fine = addNodeOfType(graph, 'Pack/Fine')
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      fine.connect(0, consumer, 0)

      expect(await consumerInput(consumer)).toBe('fine')
    })

    it.for([
      { name: 'an answer that is not an object', answer: () => 'out' },
      { name: 'a list', answer: () => [{ omit: true }] },
      {
        name: 'an output it does not have',
        answer: () => ({ 3: { omit: true } })
      },
      {
        name: 'an output name it does not have',
        answer: () => ({ nope: { omit: true } })
      },
      {
        name: 'an output named twice',
        answer: () => ({ 0: { omit: true }, out: { omit: true } })
      },
      {
        name: 'a resolution that is not an object',
        answer: () => ({ 0: 'omit' })
      },
      {
        name: 'a resolution of two kinds',
        answer: () => ({ 0: { omit: true, literal: 1 } })
      },
      { name: 'omit that is not true', answer: () => ({ 0: { omit: false } }) },
      {
        name: 'a resolution of no known kind',
        answer: () => ({ 0: { source: 1 } })
      },
      {
        name: 'a forwardTo to a node not in its graph',
        answer: () => ({ 0: { forwardTo: { nodeId: '999', input: 0 } } })
      },
      {
        name: 'a forwardTo to an input the node lacks',
        answer: (self: string) => ({
          0: { forwardTo: { nodeId: self, input: 1 } }
        })
      },
      {
        name: 'a forwardTo to a negative input',
        answer: (self: string) => ({
          0: { forwardTo: { nodeId: self, input: -1 } }
        })
      },
      {
        name: 'a forwardTo to a fractional input',
        answer: (self: string) => ({
          0: { forwardTo: { nodeId: self, input: 0.5 } }
        })
      },
      {
        name: 'a forwardTo with a numeric node id',
        answer: (self: string) => ({
          0: { forwardTo: { nodeId: Number(self), input: 0 } }
        })
      },
      {
        name: 'a forwardTo with a text input',
        answer: (self: string) => ({
          0: { forwardTo: { nodeId: self, input: '0' } }
        })
      },
      {
        name: 'a forwardTo with another field',
        answer: (self: string) => ({
          0: { forwardTo: { nodeId: self, input: 0, graphId: 'g' } }
        })
      },
      {
        name: 'a forwardTo that is not an object',
        answer: (self: string) => ({ 0: { forwardTo: self } })
      },
      {
        name: 'a literal a workflow cannot save',
        answer: () => ({ 0: { literal: () => 1 } })
      },
      {
        name: 'an undefined literal',
        answer: () => ({ 0: { literal: undefined } })
      },
      { name: 'a literal BigInt', answer: () => ({ 0: { literal: 1n } }) }
    ])(
      'reports $name, and builds the node as if it had no resolver',
      async ({ answer }) => {
        defineWireAnswering(answer)
        const { source, consumer } = sourceWireConsumer()

        expect(await consumerInput(consumer)).toEqual([String(source.id), 0])
        expect(reportError).toHaveBeenCalledOnce()
      }
    )

    it('accepts a forwardTo to its own input, the control for the refusals above', async () => {
      defineWireAnswering((self) => ({
        0: { forwardTo: { nodeId: self, input: 0 } }
      }))
      const { source, consumer } = sourceWireConsumer()

      expect(await consumerInput(consumer)).toEqual([String(source.id), 0])
      expect(reportError).not.toHaveBeenCalled()
    })
  })

  describe('in a subgraph', () => {
    function subgraphWithWire(rootGraph: LGraph): {
      subgraph: Subgraph
      consumer: LGraphNode
    } {
      const subgraph = createTestSubgraph({
        rootGraph,
        inputs: [{ name: 'text', type: 'STRING' }]
      })
      rootGraph.subgraphs.set(subgraph.id, subgraph)
      const wire = addNodeOfType(subgraph, WIRE)
      subgraph.inputNode.slots[0].connect(wire.inputs[0], wire)
      const consumer = addBackendNode(subgraph, 'Consumer', { inputs: ['x'] })
      wire.connect(0, consumer, 0)
      return { subgraph, consumer }
    }

    it('resolves each placement of a subgraph from its own sources', async () => {
      const resolve = vi.fn<Resolver>(({ self }) => ({
        0: { forwardTo: { nodeId: self.id, input: 0 } }
      }))
      defineWire(resolve)
      const { subgraph, consumer } = subgraphWithWire(graph)
      const placements = [1, 2].map(() => {
        const source = addBackendNode(graph, 'Source', { outputs: ['text'] })
        const placement = createTestSubgraphNode(subgraph)
        graph.add(placement)
        source.connect(0, placement, 0)
        return { source, placement }
      })

      const output = await promptOf()

      for (const { source, placement } of placements) {
        expect(output[`${placement.id}:${consumer.id}`].inputs.x).toEqual([
          String(source.id),
          0
        ])
      }
      expect(resolve).toHaveBeenCalledOnce()
    })

    it('gives the value of a promoted widget for a subgraph input the widget feeds (B-09)', async () => {
      defineWire(({ self }) => ({
        0: { forwardTo: { nodeId: self.id, input: 0 } }
      }))
      const { subgraph, consumer } = subgraphWithWire(graph)
      const placement = createTestSubgraphNode(subgraph)
      graph.add(placement)
      const id = widgetId(graph.id, placement.id, 'text')
      useWidgetValueStore().registerWidget(id, {
        type: 'text',
        value: 'from the widget',
        options: {}
      })
      placement.inputs[0].widgetId = id

      const output = await promptOf()

      expect(output[`${placement.id}:${consumer.id}`].inputs.x).toBe(
        'from the widget'
      )
    })

    it('lists only the nodes of its own graph in nodesOfType', async () => {
      const seen: string[][] = []
      defineWire(({ nodesOfType }) => {
        seen.push(nodesOfType('Consumer').map(({ id }) => id))
        return { 0: { omit: true } }
      })
      const { subgraph, consumer } = subgraphWithWire(graph)
      const rootConsumer = new LGraphNode('Consumer')
      rootConsumer.type = 'Consumer'
      rootConsumer.id = toNodeId(500)
      graph.add(rootConsumer)
      const placement = createTestSubgraphNode(subgraph)
      graph.add(placement)

      await promptOf()

      expect(seen).toEqual([[String(consumer.id)]])
    })
  })

  describe('the view', () => {
    async function viewSeenBy(
      setUp: (wire: LGraphNode) => void = () => {}
    ): Promise<{ view: ResolveView; wire: LGraphNode }> {
      let seen: ResolveView | undefined
      defineWire((view) => {
        seen = view
        return { 0: { omit: true } }
      })
      const { wire } = sourceWireConsumer()
      setUp(wire)
      await promptOf()
      assert(seen)
      return { view: seen, wire }
    }

    it('describes the node', async () => {
      const { view, wire } = await viewSeenBy((node) => {
        node.color = '#123'
        node.mode = LGraphEventMode.ON_EVENT
      })

      expect(view.self).toMatchObject({
        id: String(wire.id),
        type: WIRE,
        mode: 'on-event',
        color: '#123'
      })
      expect(Object.isFrozen(view)).toBe(true)
      expect(Object.isFrozen(view.self)).toBe(true)
    })

    it('has no colour for a node with the default one', async () => {
      const { view } = await viewSeenBy()

      expect(view.self.color).toBeUndefined()
    })

    it('gives the inputs with what feeds them, and the outputs', async () => {
      const { view } = await viewSeenBy((wire) => {
        wire.inputs[1].label = 'Shown'
        wire.outputs[0].localized_name = 'Sortie'
      })
      const sourceId = String(graph.nodes[0].id)

      expect(view.self.inputs).toEqual([
        {
          index: 0,
          name: 'in',
          label: 'in',
          connectedType: 'STRING',
          sourceNodeId: sourceId
        },
        {
          index: 1,
          name: 'other',
          label: 'Shown',
          connectedType: undefined,
          sourceNodeId: undefined
        }
      ])
      expect(view.self.outputs).toEqual([
        { index: 0, name: 'out', label: 'Sortie', type: 'STRING' },
        { index: 1, name: 'second', label: 'second', type: 'STRING' }
      ])
      expect(Object.isFrozen(view.self.inputs[0])).toBe(true)
      expect(Object.isFrozen(view.self.outputs)).toBe(true)
    })

    it('gives a frozen copy of the properties, which a change to does not reach', async () => {
      const { view, wire } = await viewSeenBy((node) => {
        node.properties.choice = { value: 1 }
      })

      expect(view.self.properties).toEqual({ choice: { value: 1 } })
      expect(Object.isFrozen(view.self.properties.choice)).toBe(true)
      expect(view.self.properties.choice).not.toBe(wire.properties.choice)
    })

    it('gives the groups that hold the node, in draw order', async () => {
      const { view } = await viewSeenBy((wire) => {
        wire.pos = [100, 100]
        wire.size = [50, 50]
        for (const [title, bounds] of [
          ['outer', [0, 0, 400, 400]],
          ['elsewhere', [1000, 1000, 100, 100]],
          ['inner', [50, 50, 200, 200]]
        ] as const) {
          const group = new LGraphGroup(title)
          group.pos = [bounds[0], bounds[1]]
          group.size = [bounds[2], bounds[3]]
          graph.add(group)
        }
      })

      expect(view.self.groups.map(({ title }) => title)).toEqual([
        'outer',
        'inner'
      ])
      expect(view.self.groups[0]).toEqual({
        id: String(graph.groups[0].id),
        title: 'outer'
      })
    })

    it('gives a frozen copy of a widget value, and nothing for a widget it lacks', async () => {
      const { view, wire } = await viewSeenBy((node) => {
        node.addWidget('combo', 'choice', 'b', () => {}, {
          values: ['a', 'b']
        })
        const tags = node.addWidget('text', 'tags', '', () => {})
        tags.value = ['x']
      })

      expect(view.self.widgetValue('choice')).toBe('b')
      expect(view.self.widgetValue('tags')).toEqual(['x'])
      expect(Object.isFrozen(view.self.widgetValue('tags'))).toBe(true)
      expect(view.self.widgetValue('tags')).not.toBe(wire.widgets?.[1].value)
      expect(view.self.widgetValue('missing')).toBeUndefined()
    })

    it('names an input by index or by name', async () => {
      const { view, wire } = await viewSeenBy()
      const ref = { nodeId: String(wire.id), input: 1 }

      expect(view.self.input(1)).toEqual(ref)
      expect(view.self.input('other')).toEqual(ref)
      expect(Object.isFrozen(view.self.input(1))).toBe(true)
      expect(view.self.input(2)).toBeUndefined()
      expect(view.self.input(-1)).toBeUndefined()
      expect(view.self.input('missing')).toBeUndefined()
    })

    it('lists the nodes of a type in the graph order, and none of a type it lacks', async () => {
      const { view } = await viewSeenBy(() => {
        addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      })
      const consumers = graph.nodes.filter((node) => node.type === 'Consumer')

      expect(consumers).toHaveLength(2)
      expect(view.nodesOfType('Consumer').map(({ id }) => id)).toEqual(
        consumers.map(({ id }) => String(id))
      )
      expect(view.nodesOfType('Nothing')).toEqual([])
      expect(Object.isFrozen(view.nodesOfType('Consumer'))).toBe(true)
    })

    it('gives the same view of a node however it is reached', async () => {
      const { view } = await viewSeenBy()

      const [wireView] = view.nodesOfType(WIRE)

      expect(wireView).toBe(view.self)
    })

    it.for([
      {
        name: 'an input that is a fraction',
        read: (self: ResolvedNodeView) => self.input(0.5)
      },
      {
        name: 'an input that is not a name or index',
        read: (self: ResolvedNodeView) =>
          Reflect.apply(self.input, self, [null])
      },
      {
        name: 'a widget name that is not text',
        read: (self: ResolvedNodeView) =>
          Reflect.apply(self.widgetValue, self, [1])
      }
    ])('refuses $name with a TypeError', async ({ read }) => {
      const { view } = await viewSeenBy()

      expect(() => read(view.self)).toThrow(TypeError)
    })

    it('refuses a type that is not text in nodesOfType', async () => {
      const { view } = await viewSeenBy()

      expect(() => Reflect.apply(view.nodesOfType, view, [3])).toThrow(
        TypeError
      )
    })
  })

  it('resolves only the nodes of a type with a resolver', async () => {
    defineWire(() => ({ 0: { literal: 'x' } }))
    comfy.defs.define({
      type: 'Pack/Plain',
      execution: 'frontend',
      inputs: [{ name: 'in', type: 'STRING' }],
      outputs: [{ name: 'out', type: 'STRING' }]
    })
    const { consumer } = sourceWireConsumer()
    const source = addBackendNode(graph, 'Source', { outputs: ['text'] })
    const plain = addNodeOfType(graph, 'Pack/Plain')
    const plainConsumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
    source.connect(0, plain, 0)
    plain.connect(0, plainConsumer, 0)

    expect(await consumerInput(consumer)).toBe('x')
    expect(await consumerInput(plainConsumer)).toEqual([String(source.id), 0])
  })
})
