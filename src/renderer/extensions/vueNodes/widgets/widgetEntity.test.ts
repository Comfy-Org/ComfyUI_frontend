import { assert, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, watchEffect } from 'vue'

import { BaseWidget, LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  setupComplexPromotionFixture
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  setWidgetValue,
  widgetLinkedUpstream,
  widgetLive,
  widgetNodeLocatorId,
  widgetOptions,
  widgetValue
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'

vi.mock(import('@/scripts/app'))

function nodeWithNumberWidget(graph: LGraph, title: string) {
  const node = new LGraphNode(title)
  node.addInput('steps', 'INT', { widget: { name: 'steps' } })
  node.addWidget('number', 'steps', 20, () => {}, { min: 1, max: 100 })
  graph.add(node)
  return node
}

describe('widgetEntity', () => {
  it('renders a widget whose input is linked as disabled, naming its upstream node', () => {
    const graph = new LGraph()
    vi.mocked(app).rootGraph = graph
    const source = new LGraphNode('Source')
    source.addOutput('value', 'INT')
    graph.add(source)
    const target = nodeWithNumberWidget(graph, 'Target')
    source.connect(0, target, 0)

    const id = widgetId(graph.id, target.id, 'steps')

    expect(widgetOptions(id)).toMatchObject({
      min: 1,
      max: 100,
      disabled: true
    })
    expect(widgetLinkedUpstream(id)).toEqual({
      nodeId: source.id,
      outputName: 'value'
    })
  })

  it('ignores a live node that shares the node id of a widget from another graph', () => {
    const graph = new LGraph()
    vi.mocked(app).rootGraph = graph
    const source = new LGraphNode('Source')
    source.addOutput('value', 'INT')
    graph.add(source)
    const liveTarget = nodeWithNumberWidget(graph, 'Target')
    source.connect(0, liveTarget, 0)
    const otherGraphWidget = widgetId(new LGraph().id, liveTarget.id, 'steps')
    useWidgetValueStore().registerWidget(otherGraphWidget, {
      type: 'number',
      value: 5,
      options: { min: 0, max: 10 }
    })

    expect(widgetValue(otherGraphWidget)).toBe(5)
    expect(widgetOptions(otherGraphWidget)).toEqual({ min: 0, max: 10 })
    expect(widgetLinkedUpstream(otherGraphWidget)).toBeUndefined()
    expect(widgetLive(otherGraphWidget)).toBeUndefined()
  })

  it('locates a widget inside a subgraph by that subgraph', () => {
    const subgraph = createTestSubgraph()
    subgraph.rootGraph.subgraphs.set(subgraph.id, subgraph)
    vi.mocked(app).rootGraph = subgraph.rootGraph
    const interior = nodeWithNumberWidget(subgraph, 'Interior')

    expect(
      widgetNodeLocatorId(widgetId(subgraph.rootGraph.id, interior.id, 'steps'))
    ).toBe(createNodeLocatorId(subgraph.id, interior.id))
  })

  it("clears a subgraph widget's validation error when the view writes a value", () => {
    const subgraph = createTestSubgraph()
    const { rootGraph } = subgraph
    rootGraph.subgraphs.set(subgraph.id, subgraph)
    vi.mocked(app).rootGraph = rootGraph
    const subgraphNode = createTestSubgraphNode(subgraph)
    rootGraph.add(subgraphNode)
    const interior = nodeWithNumberWidget(subgraph, 'Interior')
    const executionId = createNodeExecutionId([subgraphNode.id, interior.id])
    const errors = useExecutionErrorStore()
    errors.recordNodeErrors({
      [executionId]: {
        errors: [
          {
            type: 'required_input_missing',
            message: 'steps is required',
            details: '',
            extra_info: { input_name: 'steps' }
          }
        ],
        class_type: 'Interior',
        dependent_outputs: []
      }
    })
    expect(errors.lastNodeErrors?.[executionId]).toBeDefined()

    setWidgetValue(widgetId(rootGraph.id, interior.id, 'steps'), 50)

    expect(errors.lastNodeErrors?.[executionId]).toBeUndefined()
  })

  it('writes a value through to the live widget and its callback', () => {
    const graph = new LGraph()
    vi.mocked(app).rootGraph = graph
    const node = new LGraphNode('Target')
    const callback = vi.fn()
    const steps = node.addWidget('number', 'steps', 20, callback, {
      min: 1,
      max: 100
    })
    graph.add(node)
    const id = widgetId(graph.id, node.id, 'steps')

    setWidgetValue(id, 42)

    expect(widgetValue(id)).toBe(42)
    expect(steps.value).toBe(42)
    expect(callback).toHaveBeenCalledWith(42, app.canvas, node)
  })

  it('shows combo options a sibling widget callback replaced in place', async () => {
    const graph = new LGraph()
    vi.mocked(app).rootGraph = graph
    const node = new LGraphNode('Sampler')
    const sampler = node.addWidget('combo', 'sampler_name', 'euler', () => {}, {
      values: ['euler']
    })
    const steps = node.addWidget(
      'number',
      'steps',
      20,
      () => {
        sampler.options.values = ['euler', 'heun']
      },
      { min: 1, max: 100 }
    )
    graph.add(node)
    assert(steps instanceof BaseWidget)
    const samplerOptions = computed(() =>
      widgetOptions(widgetId(graph.id, node.id, 'sampler_name'))
    )
    const rendered: unknown[] = []
    watchEffect(() => rendered.push(samplerOptions.value.values))

    steps.setValue(25)
    await nextTick()

    expect(rendered).toEqual([['euler'], ['euler', 'heun']])
  })

  it('locates a promoted host widget by the interior node it edits', () => {
    const { graph, subgraph, hostNode } = setupComplexPromotionFixture()
    vi.mocked(app).rootGraph = graph
    const id = hostNode.widgets[0]?.widgetId ?? hostNode.inputs[0]?.widgetId
    assert.exists(id)

    expect(widgetNodeLocatorId(id)).toBe(
      createNodeLocatorId(subgraph.id, toNodeId(20))
    )
  })
})
