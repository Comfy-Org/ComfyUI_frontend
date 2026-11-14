import { assert, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'

function addTwoHosts(subgraph: Subgraph, parent: LGraph = subgraph.rootGraph) {
  const a = createTestSubgraphNode(subgraph, { id: 11 })
  const b = createTestSubgraphNode(subgraph, { id: 29 })
  parent.add(a)
  parent.add(b)
  return { a, b }
}

async function showOnCanvas(root: LGraph) {
  stubCanvasGetContext()
  const canvas = new LGraphCanvas(document.createElement('canvas'), root, {
    skip_render: true,
    skip_events: true
  })
  useCanvasStore().canvas = canvas
  await nextTick()
  return { canvas, store: useSubgraphInputValuesStore() }
}

describe('subgraph input values instance selection', () => {
  it('keeps ambiguous direct entry unresolved', async () => {
    const subgraph = createTestSubgraph()
    addTwoHosts(subgraph)
    const { canvas, store } = await showOnCanvas(subgraph.rootGraph)

    canvas.setGraph(subgraph)

    expect(store.selected).toBeUndefined()
  })

  it('does not silently redirect editing to another host after the selected host is removed', async () => {
    const subgraph = createTestSubgraph()
    const { b } = addTwoHosts(subgraph)
    const root = subgraph.rootGraph
    const { canvas, store } = await showOnCanvas(root)
    canvas.openSubgraph(subgraph, b)

    root.remove(b)

    expect(store.selected).toBeUndefined()
  })

  it('keeps the outer host after returning from a nested subgraph', async () => {
    const outer = createTestSubgraph({ name: 'outer' })
    const root = outer.rootGraph
    const nested = createTestSubgraph({ name: 'nested', rootGraph: root })
    root.subgraphs.set(outer.id, outer)
    root.subgraphs.set(nested.id, nested)
    const { b } = addTwoHosts(outer)
    const inner = createTestSubgraphNode(nested, { id: 5, parentGraph: outer })
    outer.add(inner)
    const { canvas, store } = await showOnCanvas(root)

    canvas.openSubgraph(outer, b)
    canvas.openSubgraph(nested, inner)
    expect(store.selected?.id).toBe(inner.id)

    canvas.setGraph(outer)
    expect(store.selected?.id).toBe(b.id)
  })
})

describe('subgraph input value sources', () => {
  it('resolves each host to its own editable widget', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'number', type: 'INT' }]
    })
    const { a, b } = addTwoHosts(subgraph)
    const interior = new LGraphNode('Value')
    const input = interior.addInput('value', 'INT')
    input.widget = { name: 'value' }
    interior.addWidget('number', 'value', 1, () => {})
    subgraph.add(interior)
    subgraph.inputs[0].connect(input, interior)
    useCanvasStore().currentGraph = subgraph
    const root = subgraph.rootGraph
    const states = useNodeDataStore().getGraphNodesFor(root.id, root.id)
    const hostA = states.find((node) => node.id === a.id)
    const hostB = states.find((node) => node.id === b.id)
    assert.exists(hostA)
    assert.exists(hostB)
    const widgetA = a.inputs[0].widgetId
    const widgetB = b.inputs[0].widgetId
    assert.exists(widgetA)
    assert.exists(widgetB)
    const store = useSubgraphInputValuesStore()

    expect(store.sourcesFor(hostA).get('number')).toMatchObject({
      kind: 'editable',
      node: { id: a.id },
      widgetId: widgetA
    })
    expect(store.sourcesFor(hostB).get('number')).toMatchObject({
      kind: 'editable',
      node: { id: b.id },
      widgetId: widgetB
    })
  })
})
