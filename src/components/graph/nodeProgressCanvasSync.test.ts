import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { NodeProgressState } from '@/schemas/apiSchema'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

import { createNodeProgressCanvasSync } from './nodeProgressCanvasSync'

const SUBGRAPH_ID = '00000000-0000-0000-0000-000000000001'

function runningState(id: string, value: number): NodeProgressState {
  return {
    display_node_id: id,
    node_id: id,
    prompt_id: 'job',
    state: 'running',
    value,
    max: 100
  }
}

function createNode(id: number) {
  let progress: number | undefined
  const reads = vi.fn()
  const writes = vi.fn()
  const node = {
    id,
    graph: null,
    get progress() {
      reads()
      return progress
    },
    set progress(value: number | undefined) {
      writes(value)
      progress = value
    }
  } as unknown as LGraphNode
  return {
    node,
    reads,
    writes,
    value() {
      return progress
    }
  }
}

function createGraph(nodes: LGraphNode[], subgraphId?: string) {
  const events = new EventTarget()
  const graph = {
    id: subgraphId,
    nodes,
    events
  } as unknown as LGraph
  for (const node of nodes) node.graph = graph
  return {
    graph,
    add(node: LGraphNode) {
      node.graph = graph
      nodes.push(node)
      events.dispatchEvent(new CustomEvent('node:added', { detail: { node } }))
    },
    remove(node: LGraphNode) {
      events.dispatchEvent(
        new CustomEvent('node:before-removed', { detail: { node } })
      )
      const index = nodes.indexOf(node)
      if (index !== -1) nodes.splice(index, 1)
      node.graph = null
    }
  }
}

function createCanvas() {
  return { setDirty: vi.fn() } as unknown as LGraphCanvas
}

function locatorForNode(node: LGraphNode): NodeLocatorId {
  return createNodeLocatorId(
    node.graph?.id === SUBGRAPH_ID ? SUBGRAPH_ID : null,
    node.id
  )
}

it('does one graph build, then only looks up changed and removed keys', () => {
  const nodes = Array.from({ length: 1_000 }, (_, index) =>
    createNode(index + 1)
  )
  const { graph } = createGraph(nodes.map(({ node }) => node))
  const canvas = createCanvas()
  const conversions = vi.fn(locatorForNode)
  const lookups = vi.fn()
  const sync = createNodeProgressCanvasSync(conversions, lookups)
  const locator = createNodeLocatorId(null, toNodeId(1))
  const equalStates = { [locator]: runningState('1', 25) }

  sync.sync(equalStates, canvas, graph)
  expect(conversions).toHaveBeenCalledTimes(1_000)
  expect(nodes[0].value()).toBe(0.25)

  conversions.mockClear()
  lookups.mockClear()
  nodes.forEach(({ reads, writes }) => {
    reads.mockClear()
    writes.mockClear()
  })

  sync.sync({ ...equalStates }, canvas, graph)
  expect(conversions).not.toHaveBeenCalled()
  expect(lookups).not.toHaveBeenCalled()
  expect(
    nodes.every(
      ({ reads, writes }) =>
        !reads.mock.calls.length && !writes.mock.calls.length
    )
  ).toBe(true)

  sync.sync({ [locator]: runningState('1', 50) }, canvas, graph)
  expect(lookups).toHaveBeenCalledTimes(1)
  expect(nodes[0].writes).toHaveBeenCalledExactlyOnceWith(0.5)
  expect(nodes.slice(1).every(({ writes }) => !writes.mock.calls.length)).toBe(
    true
  )

  lookups.mockClear()
  nodes[0].writes.mockClear()
  sync.sync({}, canvas, graph)
  expect(lookups).toHaveBeenCalledTimes(1)
  expect(nodes[0].writes).toHaveBeenCalledExactlyOnceWith(undefined)

  lookups.mockClear()
  nodes[0].writes.mockClear()
  const unmatched = createNodeLocatorId(null, toNodeId(1_001))
  sync.sync({ [unmatched]: runningState('1001', 25) }, canvas, graph)
  expect(lookups).toHaveBeenCalledTimes(1)
  expect(nodes.every(({ writes }) => !writes.mock.calls.length)).toBe(true)

  lookups.mockClear()
  sync.sync({ [locator]: runningState('1', 75) }, canvas, graph)
  expect(lookups).toHaveBeenCalledTimes(2)
  expect(nodes[0].writes).toHaveBeenCalledExactlyOnceWith(0.75)
})

it('keeps duplicate locator entries and node add/remove lifecycle in sync', () => {
  const first = createNode(1)
  const duplicate = createNode(1)
  const graphFixture = createGraph([first.node])
  const canvas = createCanvas()
  const conversions = vi.fn(locatorForNode)
  const sync = createNodeProgressCanvasSync(conversions)
  const locator = createNodeLocatorId(null, toNodeId(1))

  sync.sync({ [locator]: runningState('1', 25) }, canvas, graphFixture.graph)
  conversions.mockClear()
  graphFixture.add(duplicate.node)
  expect(conversions).toHaveBeenCalledExactlyOnceWith(duplicate.node)
  expect(duplicate.value()).toBe(0.25)

  first.writes.mockClear()
  duplicate.writes.mockClear()
  sync.sync({ [locator]: runningState('1', 50) }, canvas, graphFixture.graph)
  expect(first.writes).toHaveBeenCalledExactlyOnceWith(0.5)
  expect(duplicate.writes).toHaveBeenCalledExactlyOnceWith(0.5)

  graphFixture.remove(first.node)
  first.writes.mockClear()
  duplicate.writes.mockClear()
  sync.sync({ [locator]: runningState('1', 75) }, canvas, graphFixture.graph)
  expect(first.writes).not.toHaveBeenCalled()
  expect(duplicate.writes).toHaveBeenCalledExactlyOnceWith(0.75)
})

it('evicts detached nodes when a real graph is cleared and reused', () => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  const graph = new LGraph()
  const staleNode = new LGraphNode('stale')
  staleNode.id = toNodeId(1)
  graph.add(staleNode)
  const canvas = createCanvas()
  const sync = createNodeProgressCanvasSync(locatorForNode)
  const locator = createNodeLocatorId(null, staleNode.id)

  sync.sync({ [locator]: runningState('1', 25) }, canvas, graph)
  expect(staleNode.progress).toBe(0.25)

  graph.clear()
  const replacementNode = new LGraphNode('replacement')
  replacementNode.id = toNodeId(1)
  graph.add(replacementNode)
  sync.sync({ [locator]: runningState('1', 50) }, canvas, graph)

  expect(staleNode.progress).toBe(0.25)
  expect(replacementNode.progress).toBe(0.5)
})

it('rebuilds scope on graph replacement and detaches old graph listeners', () => {
  const rootNode = createNode(1)
  const subgraphNode = createNode(1)
  const oldLateNode = createNode(2)
  const root = createGraph([rootNode.node])
  const subgraph = createGraph([subgraphNode.node], SUBGRAPH_ID)
  const canvas = createCanvas()
  const conversions = vi.fn(locatorForNode)
  const sync = createNodeProgressCanvasSync(conversions)
  const rootLocator = createNodeLocatorId(null, toNodeId(1))
  const subgraphLocator = createNodeLocatorId(SUBGRAPH_ID, toNodeId(1))

  sync.sync({ [rootLocator]: runningState('1', 25) }, canvas, root.graph)
  expect(rootNode.value()).toBe(0.25)

  conversions.mockClear()
  sync.sync(
    { [subgraphLocator]: runningState('1', 50) },
    canvas,
    subgraph.graph
  )
  expect(conversions).toHaveBeenCalledExactlyOnceWith(subgraphNode.node)
  expect(subgraphNode.value()).toBe(0.5)

  conversions.mockClear()
  root.add(oldLateNode.node)
  expect(conversions).not.toHaveBeenCalled()

  sync.sync({}, canvas, root.graph)
  expect(rootNode.value()).toBeUndefined()
  expect(oldLateNode.value()).toBeUndefined()

  conversions.mockClear()
  sync.dispose()
  root.add(createNode(3).node)
  expect(conversions).not.toHaveBeenCalled()
})
