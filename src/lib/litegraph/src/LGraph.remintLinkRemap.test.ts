import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { registerNodeState } from '@/core/graph/nodeShell/nodeShellState'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ISerialisedGraph,
  ISerialisedNode,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

/**
 * Pins the remint→remap contract for serialized link endpoints (ADR-0008,
 * "Collision recovery lives at the remint site").
 *
 * When `LGraph.configure` adds a payload node whose id collides with a live
 * registration, `attachNodeToStores` remints the node's id. Links restored
 * from the same payload named the node by its *requested* (serialized) id, so
 * their endpoints must follow the remint — otherwise they silently attach to
 * the incumbent that kept the old id (link theft) or dangle.
 *
 * The remap applies only to unambiguous remints: a serialized id requested by
 * more than one payload node cannot name a single node, so links referencing
 * it are left on the first claimant (status quo) rather than guessed at.
 */

const GRAPH_ID = 'aa000000-0000-4000-8000-000000000000'

class DummyNode extends LGraphNode {
  constructor() {
    super('dummy')
    this.addInput('in', 'number')
    this.addOutput('out', 'number')
  }
}

function serialisedNode(
  id: number,
  title: string,
  order: number,
  slots: { inputLink?: number; outputLinks?: number[] } = {}
): ISerialisedNode {
  return {
    id,
    type: 'dummy',
    title,
    pos: [order * 200, 0],
    size: [100, 60],
    flags: {},
    order,
    mode: 0,
    inputs: [{ name: 'in', type: 'number', link: slots.inputLink ?? null }],
    outputs: [{ name: 'out', type: 'number', links: slots.outputLinks ?? [] }],
    properties: {}
  }
}

function baseGraph(
  overrides: Partial<SerialisableGraph> & Pick<SerialisableGraph, 'nodes'>
): SerialisableGraph {
  return {
    id: GRAPH_ID,
    version: 1,
    revision: 0,
    state: { lastNodeId: 0, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 },
    links: [],
    groups: [],
    extra: {},
    ...overrides
  }
}

function legacyGraph(
  overrides: Partial<ISerialisedGraph> & Pick<ISerialisedGraph, 'nodes'>
): ISerialisedGraph {
  return {
    id: GRAPH_ID,
    version: 0.4,
    revision: 0,
    last_node_id: 0,
    last_link_id: 0,
    links: [],
    groups: [],
    extra: {},
    ...overrides
  }
}

/**
 * Merge payload whose node 1 collides with the live incumbent. Its links name
 * the payload's own node 1: 200 originates there, 201 targets it.
 */
function mergePayload(): SerialisableGraph {
  return baseGraph({
    state: { lastNodeId: 3, lastLinkId: 201, lastGroupId: 0, lastRerouteId: 0 },
    nodes: [
      serialisedNode(1, 'newcomer', 0, { outputLinks: [200], inputLink: 201 }),
      serialisedNode(3, 'merge-sink', 1, {
        inputLink: 200,
        outputLinks: [201]
      })
    ],
    links: [
      {
        id: 200,
        origin_id: 1,
        origin_slot: 0,
        target_id: 3,
        target_slot: 0,
        type: 'number'
      },
      {
        id: 201,
        origin_id: 3,
        origin_slot: 0,
        target_id: 1,
        target_slot: 0,
        type: 'number'
      }
    ]
  })
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  LiteGraph.registerNodeType('dummy', DummyNode)
})

function getNodeByTitle(graph: LGraph, title: string): LGraphNode {
  const node = graph.nodes.find((n) => n.title === title)
  if (!node) throw new Error(`node titled ${title} not found`)
  return node
}

function graphWithRegisteredNode(id: number): LGraph {
  const graph = new LGraph()
  graph.id = GRAPH_ID
  const incumbent = new DummyNode()
  incumbent.id = toNodeId(id)
  if (!registerNodeState(graph, incumbent)) {
    throw new Error(`failed to register incumbent node ${id}`)
  }
  return graph
}

describe('LGraph.configure remint link remap', () => {
  it('remaps payload link endpoints to follow a reminted node', () => {
    const graph = graphWithRegisteredNode(1)

    graph.configure(mergePayload(), true)

    const newcomer = getNodeByTitle(graph, 'newcomer')
    // The collision itself: the payload's node 1 must have been reminted.
    expect(newcomer.id).not.toBe(toNodeId(1))

    const origin = graph.links.get(toLinkId(200))
    expect(origin?.origin_id).toBe(newcomer.id)
    expect(origin?.target_id).toBe(toNodeId(3))

    const target = graph.links.get(toLinkId(201))
    expect(target?.origin_id).toBe(toNodeId(3))
    expect(target?.target_id).toBe(newcomer.id)
  })

  it('remaps legacy array-link endpoints to follow a reminted node', () => {
    const graph = graphWithRegisteredNode(1)

    graph.configure(
      legacyGraph({
        last_node_id: 4,
        last_link_id: 201,
        nodes: [
          serialisedNode(1, 'legacy-newcomer', 0, {
            outputLinks: [200],
            inputLink: 201
          }),
          serialisedNode(4, 'legacy-sink', 1, {
            inputLink: 200,
            outputLinks: [201]
          })
        ],
        links: [
          [200, 1, 0, 4, 0, 'number'],
          [201, 4, 0, 1, 0, 'number']
        ]
      }),
      true
    )

    const newcomer = getNodeByTitle(graph, 'legacy-newcomer')
    expect(newcomer.id).not.toBe(toNodeId(1))

    const origin = graph.links.get(toLinkId(200))
    expect(origin?.origin_id).toBe(newcomer.id)
    expect(origin?.target_id).toBe(toNodeId(4))

    const target = graph.links.get(toLinkId(201))
    expect(target?.origin_id).toBe(toNodeId(4))
    expect(target?.target_id).toBe(newcomer.id)
  })

  it('remaps floating link endpoints to follow a reminted node', () => {
    const graph = graphWithRegisteredNode(1)

    const payload = baseGraph({
      state: {
        lastNodeId: 1,
        lastLinkId: 400,
        lastGroupId: 0,
        lastRerouteId: 0
      },
      nodes: [serialisedNode(1, 'newcomer', 0)],
      floatingLinks: [
        {
          id: 400,
          origin_id: 1,
          origin_slot: 0,
          target_id: -1,
          target_slot: -1,
          type: 'number'
        }
      ]
    })
    graph.configure(payload, true)

    const newcomer = getNodeByTitle(graph, 'newcomer')
    expect(newcomer.id).not.toBe(toNodeId(1))

    const floating = [...graph.floatingLinks.values()].find(
      (link) => link.id === toLinkId(400)
    )
    expect(floating?.origin_id).toBe(newcomer.id)
  })

  it('keeps unassigned floating endpoints when a payload node requests -1', () => {
    const graph = new LGraph()

    graph.configure(
      baseGraph({
        state: {
          lastNodeId: 2,
          lastLinkId: 400,
          lastGroupId: 0,
          lastRerouteId: 0
        },
        nodes: [serialisedNode(-1, 'unassigned-newcomer', 0)],
        floatingLinks: [
          {
            id: 400,
            origin_id: -1,
            origin_slot: -1,
            target_id: 2,
            target_slot: 0,
            type: 'number'
          }
        ]
      })
    )

    const floating = graph.floatingLinks.get(toLinkId(400))
    expect(floating?.origin_id).toBe(toNodeId(-1))
    expect(floating?.target_id).toBe(toNodeId(2))
  })

  it('resolves chained remints once against each requested id', () => {
    const graph = graphWithRegisteredNode(1)

    const payload = baseGraph({
      state: {
        lastNodeId: 2,
        lastLinkId: 501,
        lastGroupId: 0,
        lastRerouteId: 0
      },
      nodes: [
        serialisedNode(1, 'first-remint', 0, { inputLink: 500 }),
        serialisedNode(3, 'second-remint', 1, { inputLink: 501 }),
        serialisedNode(9, 'origin', 2, { outputLinks: [500, 501] })
      ],
      links: [
        {
          id: 500,
          origin_id: 9,
          origin_slot: 0,
          target_id: 1,
          target_slot: 0,
          type: 'number'
        },
        {
          id: 501,
          origin_id: 9,
          origin_slot: 0,
          target_id: 3,
          target_slot: 0,
          type: 'number'
        }
      ]
    })

    graph.configure(payload, true)

    const first = getNodeByTitle(graph, 'first-remint')
    const second = getNodeByTitle(graph, 'second-remint')
    expect(first.id).toBe(toNodeId(3))
    expect(second.id).toBe(toNodeId(4))

    const firstLink = graph.links.get(toLinkId(500))
    expect(firstLink?.origin_id).toBe(toNodeId(9))
    expect(firstLink?.target_id).toBe(first.id)

    const secondLink = graph.links.get(toLinkId(501))
    expect(secondLink?.origin_id).toBe(toNodeId(9))
    expect(secondLink?.target_id).toBe(second.id)
  })

  it('does not remap links whose serialized id is claimed by two payload nodes', () => {
    const graph = new LGraph()
    const payload = baseGraph({
      state: {
        lastNodeId: 6,
        lastLinkId: 300,
        lastGroupId: 0,
        lastRerouteId: 0
      },
      nodes: [
        serialisedNode(5, 'first-claimant', 0, { outputLinks: [300] }),
        serialisedNode(5, 'second-claimant', 1),
        serialisedNode(6, 'sink', 2, { inputLink: 300 })
      ],
      links: [
        {
          id: 300,
          origin_id: 5,
          origin_slot: 0,
          target_id: 6,
          target_slot: 0,
          type: 'number'
        }
      ]
    })

    graph.configure(payload)

    const first = getNodeByTitle(graph, 'first-claimant')
    const second = getNodeByTitle(graph, 'second-claimant')
    expect(first.id).toBe(toNodeId(5))
    expect(second.id).not.toBe(toNodeId(5))

    // Ambiguous claim: the link stays with the first claimant instead of
    // being guessed onto the remint.
    const link = graph.links.get(toLinkId(300))
    expect(link?.origin_id).toBe(toNodeId(5))
    expect(link?.target_id).toBe(toNodeId(6))
  })
})
