import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { createUuidv4 } from '@/utils/uuid'

import { showPlaceholdersAsWaiting } from './waitingNodes'

class KnownNode extends LGraphNode {
  static override title = 'Known'
}

function graphWith(types: string[], title?: string): LGraph {
  const serialised: ISerialisedGraph = {
    id: createUuidv4(),
    revision: 0,
    version: 0.4,
    last_node_id: types.length,
    last_link_id: 0,
    nodes: types.map((type, i) => ({
      id: i + 1,
      type,
      title,
      pos: [0, i * 100],
      size: [200, 60],
      flags: {},
      order: i,
      mode: 0,
      properties: {}
    })),
    links: [],
    groups: []
  }
  const graph = new LGraph()
  graph.configure(serialised)
  return graph
}

function nodeOfType(graph: LGraph, type: string): LGraphNode {
  const node = graph.nodes.find((candidate) => candidate.type === type)
  if (!node) throw new Error(`no ${type} node in the graph`)
  return node
}

function badgeTexts(node: LGraphNode): string[] {
  return node.badges.map((badge) =>
    typeof badge === 'function' ? badge().text : badge.text
  )
}

function strokes(node: LGraphNode) {
  return Object.values(node.strokeStyles)
    .map((style) => style.call(node))
    .filter(Boolean)
}

describe('showPlaceholdersAsWaiting', () => {
  beforeEach(() => {
    LiteGraph.registerNodeType('test/Known', KnownNode)
  })

  it('shows a node whose type is not registered yet as waiting, not missing, and keeps it a placeholder', () => {
    const graph = graphWith(['LatePackNode'])
    const node = nodeOfType(graph, 'LatePackNode')
    expect(strokes(node)).not.toEqual([])

    showPlaceholdersAsWaiting(graph)

    expect(strokes(node)).toEqual([])
    expect(node.has_errors).toBe(true)
    expect(node.getTitle()).toBe('LatePackNode')
    expect(badgeTexts(node)).toEqual(['Waiting for its pack'])
  })

  it('keeps the title the workflow gave the node', () => {
    const graph = graphWith(['LatePackNode'], 'My sampler')

    showPlaceholdersAsWaiting(graph)

    expect(nodeOfType(graph, 'LatePackNode').getTitle()).toBe('My sampler')
  })

  it('shows the title the artist gives a waiting node that had none', () => {
    const graph = graphWith(['LatePackNode'])
    const node = nodeOfType(graph, 'LatePackNode')
    showPlaceholdersAsWaiting(graph)

    node.title = 'My sampler'

    expect(node.getTitle()).toBe('My sampler')
  })

  it('shows a node inside a subgraph as waiting', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    const nested = new LGraphNode('', 'LatePackNode')
    nested.last_serialization = nested.serialize()
    nested.has_errors = true
    subgraph.add(nested)
    rootGraph.add(createTestSubgraphNode(subgraph))

    showPlaceholdersAsWaiting(rootGraph)

    expect(badgeTexts(nested)).toEqual(['Waiting for its pack'])
    expect(strokes(nested)).toEqual([])
  })

  it('leaves nodes of registered types alone', () => {
    const graph = graphWith(['test/Known'])
    const node = nodeOfType(graph, 'test/Known')

    showPlaceholdersAsWaiting(graph)

    expect(node.badges).toHaveLength(0)
    expect(node.getTitle()).toBe('Known')
  })

  it('leaves a node built by its own class alone after its type was unregistered', () => {
    const graph = graphWith(['test/Known'])
    LiteGraph.unregisterNodeType('test/Known')

    showPlaceholdersAsWaiting(graph)

    expect(nodeOfType(graph, 'test/Known').badges).toHaveLength(0)
  })

  it('adds the badge once however often the graph is shown again', () => {
    const graph = graphWith(['LatePackNode'])

    showPlaceholdersAsWaiting(graph)
    showPlaceholdersAsWaiting(graph)

    expect(badgeTexts(nodeOfType(graph, 'LatePackNode'))).toHaveLength(1)
  })

  it('changes nothing the placeholder saves', () => {
    const graph = graphWith(['LatePackNode'])
    const before = nodeOfType(graph, 'LatePackNode').serialize()

    showPlaceholdersAsWaiting(graph)

    expect(nodeOfType(graph, 'LatePackNode').serialize()).toEqual(before)
  })
})
