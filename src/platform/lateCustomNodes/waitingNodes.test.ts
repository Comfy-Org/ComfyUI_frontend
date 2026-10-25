import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { createUuidv4 } from '@/utils/uuid'

import { showPlaceholdersAsWaiting } from './waitingNodes'

class KnownNode extends LGraphNode {
  static override title = 'Known'
}

function graphWith(types: string[]): LGraph {
  const serialised: ISerialisedGraph = {
    id: createUuidv4(),
    revision: 0,
    version: 0.4,
    last_node_id: types.length,
    last_link_id: 0,
    nodes: types.map((type, i) => ({
      id: i + 1,
      type,
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

describe('showPlaceholdersAsWaiting', () => {
  beforeEach(() => {
    LiteGraph.registerNodeType('test/Known', KnownNode)
  })

  it('shows a node whose type is not registered yet as waiting, not missing', () => {
    const graph = graphWith(['LatePackNode'])
    const node = nodeOfType(graph, 'LatePackNode')
    expect(node.has_errors).toBe(true)

    showPlaceholdersAsWaiting(graph)

    expect(node.has_errors).toBe(false)
    expect(node.getTitle()).toBe('LatePackNode')
    expect(badgeTexts(node)).toEqual(['Waiting for its pack'])
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
