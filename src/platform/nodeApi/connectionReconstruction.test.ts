import { assert, describe, expect, it, onTestFinished } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { enableSubgraphNodeCreation } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/litegraphTestUtils'

import { createComfyApi } from './comfyApi'
import { createDefRegistry } from './defsRegistry'
import type { ConnectionChangeEvent } from './defsRegistry'

function connectedGraph(type: string) {
  const graph = new LGraph()
  const events: ConnectionChangeEvent[] = []
  class ConnectedNode extends LGraphNode {
    constructor() {
      super(type)
      this.addInput('in', 'NUMBER')
      this.addOutput('out', 'NUMBER')
    }
  }
  const api = createComfyApi(() => graph)
  const registry = createDefRegistry()
  registry
    .forMajor((id) => api.graph.node(id)!)
    .extend(type, (builder) =>
      builder.onConnectionsChanged((_node, event) => events.push(event))
    )
  registry.applyTo(ConnectedNode, {
    name: type,
    input: { required: { in: ['NUMBER', {}] } },
    output: ['NUMBER']
  })
  LiteGraph.registerNodeType(type, ConnectedNode)
  const source = LiteGraph.createNode(type)
  const target = LiteGraph.createNode(type)
  assert.exists(source)
  assert.exists(target)
  graph.add(source)
  graph.add(target)
  source.connect(0, target, 0)
  return { graph, source, target, events }
}

describe('connection reconstruction context', () => {
  it('captures restoration at delivery and resumes ordinary edit events', () => {
    const { graph, target, events } = connectedGraph('test/restoration-context')
    expect(events.map((event) => event.reconstructing)).toEqual([false, false])
    events.length = 0

    graph.configure(graph.serialize())

    expect(events.length).toBeGreaterThan(0)
    expect(events.every((event) => event.reconstructing)).toBe(true)
    const captured = events.slice()
    graph.getNodeById(target.id)?.disconnectInput(0)
    expect(events.at(-1)?.reconstructing).toBe(false)
    expect(captured.every((event) => event.reconstructing)).toBe(true)
    expect(captured.every(Object.isFrozen)).toBe(true)
  })

  it('marks clipboard reconnections without classifying later edits as paste', () => {
    const { graph, source, target, events } =
      connectedGraph('test/paste-context')
    const canvas = createTestCanvas(graph, createMockCanvasRenderingContext2D())
    const clipboard = canvas.copyToClipboard([source, target])
    localStorage.setItem('litegrapheditor_clipboard', clipboard)
    onTestFinished(() => {
      localStorage.removeItem('litegrapheditor_clipboard')
      canvas.unbindEvents()
      graph.detachCanvas(canvas)
    })
    events.length = 0

    canvas.pasteFromClipboard()

    expect(graph.nodes).toHaveLength(4)
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((event) => event.reconstructing)).toBe(true)
    target.disconnectInput(0)
    expect(events.at(-1)?.reconstructing).toBe(false)
  })

  it('marks nested subgraph conversion and clears the context afterwards', () => {
    const { graph, source, target, events } = connectedGraph(
      'test/subgraph-context'
    )
    onTestFinished(enableSubgraphNodeCreation(graph))
    events.length = 0

    const { subgraph } = graph.convertToSubgraph(new Set([source, target]))

    expect(subgraph.nodes).toHaveLength(2)
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((event) => event.reconstructing)).toBe(true)
    subgraph.getNodeById(target.id)?.disconnectInput(0)
    expect(events.at(-1)?.reconstructing).toBe(false)
  })

  it('keeps an independent graph editable during restoration', () => {
    const restoring = connectedGraph('test/restoring-graph-context')
    const independent = connectedGraph('test/independent-graph-context')
    independent.events.length = 0
    restoring.graph.onConfigure = () => independent.target.disconnectInput(0)

    restoring.graph.configure(restoring.graph.serialize())

    expect(independent.events.length).toBeGreaterThan(0)
    expect(independent.events.every((event) => !event.reconstructing)).toBe(
      true
    )
  })

  it('clears restoration context when a configuration callback throws', () => {
    const { graph, target, events } = connectedGraph(
      'test/failed-restore-context'
    )
    graph.onConfigure = () => {
      throw new Error('failed configuration')
    }
    const data = graph.serialize()

    expect(() => graph.configure(data)).toThrow('failed configuration')

    events.length = 0
    graph.getNodeById(target.id)?.disconnectInput(0)
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((event) => !event.reconstructing)).toBe(true)
  })
})
