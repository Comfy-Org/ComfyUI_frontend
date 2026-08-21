import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ExportedSubgraph,
  ISerialisedGraph,
  ISerialisedNode,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import {
  LGraph,
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { RerouteId, Subgraph } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

/**
 * Characterises a workflow assembled from several copies of the same subgraph
 * definition, where node, link, reroute and group IDs collide simultaneously
 * across the root graph and three nested/shared definitions.
 *
 * Program context: invariant I4 (no ambiguous entity ownership across graphs);
 * QA-3. `LGraph.test.ts` already covers node-ID remapping and the reference
 * patching that follows it (links, promoted widgets, proxyWidgets), so this
 * file only adds what those tests do not reach: identity-preserving reference
 * remapping under a *simultaneous* collision, the scoping rule for the three
 * non-node ID spaces, and idempotence of the whole normalisation under a
 * second save/load.
 *
 * Normalisation is value-idempotent but not byte-stable on the first re-save:
 * every ID and reference is reproduced exactly, while the root `extra` object's
 * key order flips once and then settles. The last two tests pin both halves.
 */

const ROOT_ID = 'cc000000-0000-4000-8000-000000000000'
const DEF_A = '11111111-1111-4111-8111-111111111111'
const DEF_B = '22222222-2222-4222-8222-222222222222'
const DEF_C = '33333333-3333-4333-8333-333333333333'

/** Every scope below claims node 7 and node 8; A and B also claim node 9. */
const COLLIDING_NODE_IDS = [7, 8]
/** Every scope below claims link 1, reroute 1 and group 1. */
const COLLIDING_ENTITY_ID = 1

class DummyNode extends LGraphNode {
  constructor() {
    super('dummy')
    this.addInput('in', 'number')
    this.addOutput('out', 'number')
    this.addWidget('number', 'seed', 0, () => {})
    this.addWidget('string', 'prompt', '', () => {})
  }
}

/**
 * `title` records which scope and which original ID a node came from, so a
 * remapped reference can be traced back to the entity it used to name.
 */
function sourceNode(scope: string): ISerialisedNode {
  return {
    id: 7,
    type: 'dummy',
    title: `${scope}#7`,
    pos: [0, 0],
    size: [100, 60],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [{ name: 'in', type: 'number', link: null }],
    outputs: [{ name: 'out', type: 'number', links: [COLLIDING_ENTITY_ID] }],
    properties: {}
  }
}

function targetNode(scope: string): ISerialisedNode {
  return {
    id: 8,
    type: 'dummy',
    title: `${scope}#8`,
    pos: [300, 0],
    size: [100, 60],
    flags: {},
    order: 1,
    mode: 0,
    inputs: [{ name: 'in', type: 'number', link: COLLIDING_ENTITY_ID }],
    outputs: [{ name: 'out', type: 'number', links: [] }],
    properties: {}
  }
}

function instanceNode(
  id: number,
  definitionId: string,
  scope: string
): ISerialisedNode {
  return {
    id,
    type: definitionId,
    title: `${scope}#${id}`,
    pos: [600, 0],
    size: [200, 100],
    flags: {},
    order: 2,
    mode: 0,
    properties: { proxyWidgets: [['7', 'seed']] }
  }
}

function collidingLink() {
  return {
    id: COLLIDING_ENTITY_ID,
    origin_id: 7,
    origin_slot: 0,
    target_id: 8,
    target_slot: 0,
    type: 'number',
    parentId: COLLIDING_ENTITY_ID
  }
}

function collidingReroute() {
  return {
    id: COLLIDING_ENTITY_ID,
    pos: [200, 30] as [number, number],
    linkIds: [COLLIDING_ENTITY_ID]
  }
}

function collidingGroup(scope: string) {
  return {
    id: COLLIDING_ENTITY_ID,
    title: `${scope} group`,
    bounding: [0, 0, 800, 200] as [number, number, number, number],
    color: '#3f789e',
    flags: {}
  }
}

function definition(
  id: string,
  scope: string,
  nestedDefinitionId?: string
): ExportedSubgraph {
  const nodes = [sourceNode(scope), targetNode(scope)]
  if (nestedDefinitionId) {
    nodes.push(instanceNode(9, nestedDefinitionId, scope))
  }

  return {
    id,
    version: 1,
    revision: 0,
    state: {
      lastNodeId: 9,
      lastLinkId: COLLIDING_ENTITY_ID,
      lastGroupId: COLLIDING_ENTITY_ID,
      lastRerouteId: COLLIDING_ENTITY_ID
    },
    name: scope,
    config: {},
    inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [10, 100, 150, 126] },
    outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [900, 100, 140, 126] },
    inputs: [],
    outputs: [],
    widgets: [{ id: 7, name: 'seed' }],
    nodes,
    links: [collidingLink()],
    reroutes: [collidingReroute()],
    groups: [collidingGroup(scope)],
    extra: {}
  }
}

/**
 * Root graph holding two instances of definition A plus one of B. A and B each
 * nest C, so C is shared. Root, A, B and C all claim nodes 7/8, link 1,
 * reroute 1 and group 1.
 */
function collidingWorkflow(): SerialisableGraph {
  return {
    id: ROOT_ID,
    version: 1,
    revision: 0,
    state: {
      lastNodeId: 103,
      lastLinkId: COLLIDING_ENTITY_ID,
      lastGroupId: COLLIDING_ENTITY_ID,
      lastRerouteId: COLLIDING_ENTITY_ID
    },
    nodes: [
      sourceNode('root'),
      targetNode('root'),
      instanceNode(101, DEF_A, 'root'),
      instanceNode(102, DEF_A, 'root'),
      instanceNode(103, DEF_B, 'root')
    ],
    links: [collidingLink()],
    reroutes: [collidingReroute()],
    groups: [collidingGroup('root')],
    definitions: {
      subgraphs: [
        definition(DEF_A, 'A', DEF_C),
        definition(DEF_B, 'B', DEF_C),
        definition(DEF_C, 'C')
      ]
    },
    extra: {}
  }
}

/**
 * Registers a host node type per definition as it is created, so root and
 * nested SubgraphNode instances resolve. `registerTestSubgraphNodeTypes` in
 * `subgraph/__fixtures__/subgraphHelpers` does the same thing, but unregisters
 * unconditionally on test teardown — this file loads two graphs per test, and
 * the second teardown would throw on the already-unregistered type.
 */
function registerDefinitionHostTypes(rootGraph: LGraph): void {
  rootGraph.events.addEventListener('subgraph-created', (event) => {
    const { subgraph } = event.detail
    class DefinitionHostNode extends SubgraphNode {
      constructor() {
        super(rootGraph, subgraph, {
          id: -1,
          type: subgraph.id,
          pos: [0, 0],
          size: [100, 100],
          inputs: [],
          outputs: [],
          flags: {},
          order: 0,
          mode: 0
        })
      }
    }
    LiteGraph.registerNodeType(subgraph.id, DefinitionHostNode)
  })
}

function load(data: SerialisableGraph | ISerialisedGraph): LGraph {
  const graph = new LGraph()
  registerDefinitionHostTypes(graph)
  graph.configure(data)
  return graph
}

function configureColliding(): LGraph {
  return load(collidingWorkflow())
}

function scopesOf(graph: LGraph): { name: string; graph: LGraph | Subgraph }[] {
  return [
    { name: 'root', graph },
    { name: 'A', graph: graph.subgraphs.get(DEF_A)! },
    { name: 'B', graph: graph.subgraphs.get(DEF_B)! },
    { name: 'C', graph: graph.subgraphs.get(DEF_C)! }
  ]
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  LiteGraph.registerNodeType('dummy', DummyNode)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  for (const id of [DEF_A, DEF_B, DEF_C]) {
    if (LiteGraph.registered_node_types[id]) LiteGraph.unregisterNodeType(id)
  }
})

describe('LGraph.configure with simultaneous cross-scope ID collisions', () => {
  it('gives every node a globally unique id across root and all three definitions', () => {
    const graph = configureColliding()
    const scopes = scopesOf(graph)

    const allIds = scopes.flatMap((scope) =>
      scope.graph.nodes.map((node) => node.id)
    )
    expect(allIds).toHaveLength(13)
    expect(new Set(allIds).size).toBe(allIds.length)

    // Root keeps the IDs it declared; the definitions are the ones that move.
    const rootIds = graph.nodes.map((node) => Number(node.id))
    expect(rootIds).toEqual(expect.arrayContaining(COLLIDING_NODE_IDS))

    for (const definitionId of [DEF_A, DEF_B, DEF_C]) {
      const definitionIds = graph.subgraphs
        .get(definitionId)!
        .nodes.map((node) => Number(node.id))
      for (const claimed of COLLIDING_NODE_IDS) {
        expect(definitionIds).not.toContain(claimed)
      }
    }
  })

  it('repoints links, promoted widgets and proxyWidgets at the entity each collided id became', () => {
    const graph = configureColliding()

    for (const { name, graph: scope } of scopesOf(graph)) {
      const links = [...scope.links.values()]
      expect(links).toHaveLength(1)

      const [link] = links
      expect(scope.getNodeById(link.origin_id)?.title).toBe(`${name}#7`)
      expect(scope.getNodeById(link.target_id)?.title).toBe(`${name}#8`)
    }

    for (const definitionId of [DEF_A, DEF_B, DEF_C]) {
      const subgraph = graph.subgraphs.get(definitionId)!
      const [promoted] = subgraph.widgets
      expect(subgraph.getNodeById(toNodeId(promoted.id))?.title).toBe(
        `${subgraph.name}#7`
      )
    }

    // A host node's legacy proxyWidgets must follow its own definition's
    // remap, not another definition's.
    for (const host of graph.nodes) {
      const definitionId = String(host.type)
      const subgraph = graph.subgraphs.get(definitionId)
      if (!subgraph) continue

      const proxyWidgets = host.properties?.proxyWidgets
      expect(Array.isArray(proxyWidgets)).toBe(true)
      for (const entry of proxyWidgets as unknown[][]) {
        expect(subgraph.getNodeById(toNodeId(String(entry[0])))?.title).toBe(
          `${subgraph.name}#7`
        )
      }
    }
  })

  it('leaves link, reroute and group ids colliding across scopes because each scope owns its own id space', () => {
    const graph = configureColliding()
    const scopes = scopesOf(graph)

    for (const { graph: scope } of scopes) {
      expect([...scope.links.keys()]).toEqual([COLLIDING_ENTITY_ID])
      expect([...scope.reroutes.keys()]).toEqual([COLLIDING_ENTITY_ID])
      expect(scope.groups.map((group) => group.id)).toEqual([
        COLLIDING_ENTITY_ID
      ])

      // The reroute survives normalisation attached to its own scope's link,
      // rather than being dropped as broken.
      const reroute = scope.reroutes.get(COLLIDING_ENTITY_ID as RerouteId)!
      expect([...reroute.linkIds]).toEqual([COLLIDING_ENTITY_ID])
    }
  })

  it('normalisation is value-idempotent: the second save reproduces every id, reference and entity of the first', () => {
    const first = configureColliding().serialize()
    const second = load(structuredClone(first)).serialize()

    expect(second).toEqual(first)
  })

  it('normalisation is NOT byte-stable on the first re-save: root `extra` key order flips, then settles', () => {
    const first = configureColliding().serialize()
    const second = load(structuredClone(first)).serialize()
    const third = load(structuredClone(second)).serialize()

    expect(JSON.stringify(second)).not.toEqual(JSON.stringify(first))

    // The whole difference is the key order of root `extra`. `_configureBase`
    // deletes `extra.linkExtensions` on load, so `serialize` re-appends it
    // after `extra.reroutes` instead of before it.
    expect(first.extra).toBeDefined()
    expect(second.extra).toBeDefined()
    expect(Object.keys(first.extra ?? {})).toEqual([
      'linkExtensions',
      'reroutes'
    ])
    expect(Object.keys(second.extra ?? {})).toEqual([
      'reroutes',
      'linkExtensions'
    ])

    const withoutExtra = (data: ISerialisedGraph) =>
      JSON.stringify({ ...data, extra: {} })
    expect(withoutExtra(second)).toEqual(withoutExtra(first))

    // A fixed point is reached at the second save.
    expect(JSON.stringify(third)).toEqual(JSON.stringify(second))
  })
})
