import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'
import { graphToPrompt } from '@/utils/executionUtil'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type {
  ConnectionChangeEvent,
  DefRegistry,
  NodeCreatedEvent,
  NodeDefBuilder
} from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'

vi.mock(import('@/services/litegraphService'))

const TYPE = 'Pack/HostPath'

function canvasShowing(graph: LGraph): LGraphCanvas {
  const element = document.createElement('canvas')
  element.width = 800
  element.height = 600
  element.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  element.getBoundingClientRect = vi
    .fn()
    .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
  return new LGraphCanvas(element, graph, {
    skip_render: true,
    skip_events: true
  })
}

describe('node hooks on the host paths', () => {
  let graph: LGraph
  let defs: DefRegistry

  beforeEach(() => {
    graph = new LGraph()
    const api = createComfyApi({ getGraph: () => graph })
    defs = api.comfy.defs
    registerHostType(api.host.nodeTypeHooks, hostNodeDef(TYPE))
  })

  function extend(apply: (builder: NodeDefBuilder) => void) {
    return defs.extend(TYPE, apply)
  }

  function created(): LGraphNode {
    const node = LiteGraph.createNode(TYPE)
    assert(node)
    return node
  }

  function lifecycle() {
    const order: unknown[] = []
    extend((builder) => {
      builder.onCreated((_, event: NodeCreatedEvent) => order.push(event))
      builder.onConfigured((_, data) => order.push(`configured ${data.title}`))
    })
    return order
  }

  it('hears a pasted node join, not restored, and then its saved state', () => {
    const order = lifecycle()
    const copied = created()
    copied.title = 'Copied'

    canvasShowing(graph)._deserializeItems({ nodes: [copied.serialize()] }, {})

    expect(order).toEqual([
      { restored: false, loading: false },
      'configured Copied'
    ])
  })

  it('hears a duplicated node join, not restored, and then its saved state', () => {
    const original = created()
    original.title = 'Original'
    graph.add(original)
    const previousCanvas = LGraphCanvas.active_canvas
    onTestFinished(() => {
      LGraphCanvas.active_canvas = previousCanvas
    })
    LGraphCanvas.active_canvas = canvasShowing(graph)
    const order = lifecycle()

    LGraphCanvas.cloneNodes([original])

    expect(order).toEqual([
      { restored: false, loading: false },
      'configured Original'
    ])
  })

  describe('links restored with saved state', () => {
    function savedWithOneLinkedAndOneUnlinkedInput() {
      const saved = new LGraph()
      const source = new LGraphNode('Source')
      source.addOutput('out', '*')
      saved.add(source)
      const target = created()
      target.addInput('linked', '*')
      target.addInput('unlinked', '*')
      saved.add(target)
      source.connect(0, target, 0)
      return saved.serialize()
    }

    it('reports the linked input of a loading node, and not the unlinked one', () => {
      const events: ConnectionChangeEvent[] = []
      extend((builder) =>
        builder.onConnectionsChanged((_, event) => events.push(event))
      )

      graph.configure(savedWithOneLinkedAndOneUnlinkedInput())

      expect(
        new Set(events.map(({ name, connected }) => `${name} ${connected}`))
      ).toEqual(new Set(['linked true']))
    })
  })

  describe('a node inside a subgraph', () => {
    it('names its own input when the link from the subgraph input changes', () => {
      const events: ConnectionChangeEvent[] = []
      extend((builder) =>
        builder.onConnectionsChanged((_, event) => events.push(event))
      )
      const subgraph = createTestSubgraph({
        rootGraph: graph,
        inputs: [{ name: 'subgraph_side', type: '*' }]
      })
      graph.subgraphs.set(subgraph.id, subgraph)
      const node = created()
      node.addInput('node_side', '*')
      subgraph.add(node)

      subgraph.inputs[0].connect(node.inputs[0], node)
      node.disconnectInput(0)

      expect(events.map(({ name, connected }) => [name, connected])).toEqual([
        ['node_side', true],
        ['node_side', false]
      ])
    })
  })

  describe('a defined type in the prompt', () => {
    it('sends a backend node to the server as its type, and leaves a frontend one out', async () => {
      defs.define({ type: 'Pack/Backend', execution: 'backend' })
      defs.define({ type: 'Pack/Frontend' })
      for (const type of ['Pack/Backend', 'Pack/Frontend']) {
        const node = LiteGraph.createNode(type)
        assert(node)
        graph.add(node)
      }

      const { output } = await graphToPrompt(graph)

      expect(Object.values(output).map((entry) => entry.class_type)).toEqual([
        'Pack/Backend'
      ])
    })
  })
})
