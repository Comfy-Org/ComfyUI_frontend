import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { isWidgetVisibleOnSurface } from '@/types/widgetVisibility'
import type { WidgetVisibilityComponent } from '@/types/widgetVisibility'

import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './subgraph/__fixtures__/subgraphHelpers'

const SURFACES = ['canvas', 'vueNode', 'panel'] as const

function visibilityOf(widget: IBaseWidget): WidgetVisibilityComponent {
  const id = widget.widgetId
  if (!id) throw new Error(`Widget ${widget.name} is not registered`)
  const visibility = useWidgetValueStore().getWidgetVisibility(id)
  if (!visibility) throw new Error(`No visibility component for ${id}`)
  return visibility
}

function createWidgetNode(
  graph: LGraph,
  name = 'prompt',
  options: Record<string, unknown> = {}
) {
  const node = new LGraphNode('WidgetNode')
  const widget = node.addWidget('text', name, 'default', () => {}, options)
  const input = node.addInput(name, 'STRING')
  input.widget = { name }
  graph.add(node)
  return { node, widget, input }
}

function createSourceNode(graph: LGraph) {
  const node = new LGraphNode('Source')
  node.addOutput('out', 'STRING')
  graph.add(node)
  return node
}

describe('widget connection suppression', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    resetSubgraphFixtureState()
  })

  it('suppresses the widget on every surface while the slot stays connected', () => {
    const graph = new LGraph()
    const { node, widget } = createWidgetNode(graph)
    const source = createSourceNode(graph)

    source.connect(0, node, 0)

    const visibility = visibilityOf(widget)
    expect(visibility.suppression.byConnection).toBe(true)
    for (const surface of SURFACES) {
      expect(
        isWidgetVisibleOnSurface(visibility, surface, { showAdvanced: true })
      ).toBe(false)
    }
    expect(widget.hidden).toBe(true)
    expect(widget.computedDisabled).toBe(true)
    expect(node.isInputConnected(0)).toBe(true)
  })

  it('restores visibility on disconnect and preserves the advanced tier', () => {
    const graph = new LGraph()
    const { node, widget } = createWidgetNode(graph, 'prompt', {
      advanced: true
    })
    const source = createSourceNode(graph)

    source.connect(0, node, 0)
    node.disconnectInput(0)

    const visibility = visibilityOf(widget)
    expect(visibility.suppression.byConnection).toBe(false)
    expect(widget.hidden).toBe(false)
    expect(
      isWidgetVisibleOnSurface(visibility, 'vueNode', { showAdvanced: false })
    ).toBe(false)
    expect(
      isWidgetVisibleOnSurface(visibility, 'vueNode', { showAdvanced: true })
    ).toBe(true)
    expect(
      isWidgetVisibleOnSurface(visibility, 'canvas', { showAdvanced: false })
    ).toBe(true)
  })

  it('restores visibility when the upstream output disconnects', () => {
    const graph = new LGraph()
    const { widget, node } = createWidgetNode(graph)
    const source = createSourceNode(graph)

    source.connect(0, node, 0)
    source.disconnectOutput(0)

    expect(visibilityOf(widget).suppression.byConnection).toBe(false)
    expect(widget.hidden).toBe(false)
  })

  it('restores visibility when the graph removes the link', () => {
    const graph = new LGraph()
    const { widget, node } = createWidgetNode(graph)
    const source = createSourceNode(graph)
    const link = source.connect(0, node, 0)
    if (!link) throw new Error('Failed to connect nodes')

    graph.removeLink(link.id)

    expect(visibilityOf(widget).suppression.byConnection).toBe(false)
    expect(widget.hidden).toBe(false)
  })

  it('keeps the widget suppressed when a replacement link lands on an occupied input', () => {
    const graph = new LGraph()
    const { node, widget } = createWidgetNode(graph)
    const first = createSourceNode(graph)
    const second = createSourceNode(graph)

    first.connect(0, node, 0)
    second.connect(0, node, 0)

    expect(visibilityOf(widget).suppression.byConnection).toBe(true)
    expect(node.getInputLink(0)?.origin_id).toBe(second.id)
  })

  it('keeps the positional widgets_values slot while connected', () => {
    const graph = new LGraph()
    const { node, widget } = createWidgetNode(graph)
    node.serialize_widgets = true
    widget.value = 'kept value'
    const source = createSourceNode(graph)

    source.connect(0, node, 0)

    expect(node.serialize().widgets_values).toEqual(['kept value'])
  })

  it('suppresses only actually connected widgets after a configure round-trip', () => {
    const nodeType = 'test/suppression-configure'
    class ConfigureNode extends LGraphNode {
      constructor() {
        super('ConfigureNode')
        for (const name of ['linked', 'free']) {
          this.addWidget('text', name, '', () => {})
          const input = this.addInput(name, 'STRING')
          input.widget = { name }
        }
        this.addOutput('out', 'STRING')
      }
    }
    LiteGraph.registerNodeType(nodeType, ConfigureNode)

    const graph = new LGraph()
    const node = LiteGraph.createNode(nodeType)
    if (!node) throw new Error('Failed to create node')
    graph.add(node)
    const source = createSourceNode(graph)
    source.connect(0, node, 0)

    const restored = new LGraph()
    restored.configure(graph.serialize())
    const restoredNode = restored.nodes.find((n) => n.type === nodeType)
    if (!restoredNode?.widgets) throw new Error('Node not restored')
    const [linked, free] = restoredNode.widgets

    expect(visibilityOf(linked).suppression.byConnection).toBe(true)
    expect(visibilityOf(free).suppression.byConnection).toBe(false)
    expect(free.hidden).toBe(false)
  })

  it('suppresses only the connected widget, never its linked widgets', () => {
    const graph = new LGraph()
    const node = new LGraphNode('SeedNode')
    const seed = node.addWidget('number', 'seed', 0, () => {})
    const control = node.addWidget(
      'combo',
      'control_after_generate',
      'randomize',
      () => {},
      { values: ['fixed', 'randomize'] }
    )
    seed.linkedWidgets = [control]
    const input = node.addInput('seed', 'INT')
    input.widget = { name: 'seed' }
    graph.add(node)
    const source = createSourceNode(graph)
    source.addOutput('int', 'INT')

    source.connect(1, node, 0)
    expect(visibilityOf(seed).suppression.byConnection).toBe(true)
    expect(visibilityOf(control).suppression.byConnection).toBe(false)
    expect(node.isWidgetVisible(control)).toBe(true)

    node.disconnectInput(0)
    expect(visibilityOf(seed).suppression.byConnection).toBe(false)
    expect(visibilityOf(control).suppression.byConnection).toBe(false)
  })

  it('keeps the suppressed widget in canvas layout so its slot row remains anchored', () => {
    const graph = new LGraph()
    const { node, widget } = createWidgetNode(graph)
    const source = createSourceNode(graph)

    source.connect(0, node, 0)

    expect(visibilityOf(widget).suppression.byConnection).toBe(true)
    expect(node.isWidgetVisible(widget)).toBe(false)
    expect(node.isWidgetRowVisible(widget)).toBe(true)
    expect(node.getLayoutWidgets()).toContain(widget)

    node.disconnectInput(0)
    expect(node.isWidgetVisible(widget)).toBe(true)
  })

  it('keeps extension hiding independent of connection state', () => {
    const graph = new LGraph()
    const { node, widget } = createWidgetNode(graph)
    const source = createSourceNode(graph)

    widget.hidden = true
    source.connect(0, node, 0)
    node.disconnectInput(0)

    const visibility = visibilityOf(widget)
    expect(visibility.suppression.byConnection).toBe(false)
    expect(visibility.suppression.byExtension).toBe(true)
    expect(widget.hidden).toBe(true)
  })

  describe('subgraph boundary links', () => {
    it('keeps interior and promoted host suppression independent', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'prompt', type: 'STRING' }]
      })
      const { node, widget } = createWidgetNode(subgraph)

      subgraph.inputNode.slots[0].connect(node.inputs[0], node)
      const host = createTestSubgraphNode(subgraph)
      subgraph.rootGraph.add(host)

      expect(widget.computedDisabled).toBe(true)
      expect(visibilityOf(widget).suppression.byConnection).toBe(true)
      expect(widget.hidden).toBe(true)

      const hostWidget = host.widgets?.[0]
      if (!hostWidget) throw new Error('Missing promoted host widget')
      expect(visibilityOf(hostWidget).suppression.byConnection).toBe(false)

      const source = createSourceNode(subgraph.rootGraph)
      source.connect(0, host, 0)
      expect(visibilityOf(hostWidget).suppression.byConnection).toBe(true)
      expect(visibilityOf(widget).suppression.byConnection).toBe(true)

      host.disconnectInput(0)
      expect(visibilityOf(hostWidget).suppression.byConnection).toBe(false)
      expect(visibilityOf(widget).suppression.byConnection).toBe(true)

      subgraph.removeInput(subgraph.inputs[0])
      expect(visibilityOf(widget).suppression.byConnection).toBe(false)
    })
  })
})
