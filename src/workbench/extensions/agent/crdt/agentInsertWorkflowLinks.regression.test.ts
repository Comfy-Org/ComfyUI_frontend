import { applyOps, linksMap, mint, project } from '@comfyorg/comfy-multi-player'
import type {
  DisconnectOp,
  InsertWorkflowOp,
  WidgetCatalog
} from '@comfyorg/comfy-multi-player'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished
} from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { graphScopeOf } from '@/types/graphScopeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'

const WORKFLOW_ID = 'wf-plain-insert'

class TestLoadImage extends LGraphNode {
  static override title = 'Test Load Image'
  constructor() {
    super('Test Load Image')
    this.addOutput('IMAGE', 'IMAGE')
    this.serialize_widgets = true
  }
}

class TestReferenceNode extends LGraphNode {
  static override title = 'Test Reference Node'
  constructor() {
    super('Test Reference Node')
    this.addInput('image', 'IMAGE')
    this.addOutput('IMAGE', 'IMAGE')
    this.serialize_widgets = true
  }
}

class TestSaveVideo extends LGraphNode {
  static override title = 'Test Save Video'
  constructor() {
    super('Test Save Video')
    this.addInput('images', 'IMAGE')
    this.serialize_widgets = true
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    TestLoadImage: { widget_order: [] },
    TestReferenceNode: { widget_order: [] },
    TestSaveVideo: { widget_order: [] }
  }
}

function insertOp(
  workflow: InsertWorkflowOp['workflow'],
  opId = 'insert-plain-chain-op'
): InsertWorkflowOp {
  return {
    op_id: opId.padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    op: 'insert_workflow',
    workflow
  }
}

function bindProjection(workflowId: string, graph: LGraph) {
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(
    createGraphMutations({
      getScope: () => graphScopeOf(graph),
      layout: { createNode: () => {}, deleteNodes: () => {} },
      placement: inertPlacementPort
    }),
    () => graph,
    () => follower.doc
  )
  projection.bind(workflowId, follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
  })

  let seq = 0
  const deliver = (update: Uint8Array, opIds: string[]): boolean => {
    follower.applyRemoteUpdate(update)
    const committed = projection.applyFrame({
      workflowId,
      seq: ++seq,
      update,
      actor: 'agent:test',
      opIds
    })
    projection.reconcileLiveGraph(workflowId)
    return committed
  }
  return deliver
}

function readInputOrigins(node: LGraphNode) {
  return node.inputs.map((input, index) => ({
    name: input.name,
    origin: node.getInputLink(index)?.origin_id ?? null
  }))
}

function docLinkIds(doc: Y.Doc): unknown[] {
  return [...linksMap(doc).values()].map((link) =>
    link instanceof Y.Array ? link.get(0) : Array.isArray(link) ? link[0] : null
  )
}

function liveLinkIds(graph: LGraph) {
  return graph.serialize().links.map(([id]) => id)
}

function expectSafeNumericLinkIds(doc: Y.Doc, count: number): void {
  const ids = docLinkIds(doc)
  expect(ids).toHaveLength(count)
  expect(
    ids.every(
      (id) => typeof id === 'number' && id >= 0 && Number.isSafeInteger(id)
    )
  ).toBe(true)
}

function findByType(graph: LGraph, type: string): LGraphNode {
  const node = graph._nodes.find((candidate) => candidate.type === type)
  if (!node) throw new Error(`no live node of type ${type} was materialized`)
  return node
}

beforeEach(() => {
  LiteGraph.registerNodeType('TestLoadImage', TestLoadImage)
  LiteGraph.registerNodeType('TestReferenceNode', TestReferenceNode)
  LiteGraph.registerNodeType('TestSaveVideo', TestSaveVideo)
})

describe('a plain insert_workflow batch materializes its links', () => {
  it('wires links on the first full reconcile', () => {
    const graph = new LGraph()

    const workflow = {
      nodes: [
        {
          id: 101,
          type: 'TestLoadImage',
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [201] }]
        },
        {
          id: 102,
          type: 'TestReferenceNode',
          inputs: [{ name: 'image', type: 'IMAGE', link: 201 }],
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [202] }]
        },
        {
          id: 103,
          type: 'TestSaveVideo',
          inputs: [{ name: 'images', type: 'IMAGE', link: 202 }]
        }
      ],
      links: [
        [201, 101, 0, 102, 0, 'IMAGE'],
        [202, 102, 0, 103, 0, 'IMAGE']
      ]
    }

    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())
    const op = insertOp(workflow)
    expect(applyOps(host, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])
    expectSafeNumericLinkIds(host, 2)
    const expectedLinkIds = docLinkIds(host)

    const deliver = bindProjection(WORKFLOW_ID, graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [op.op_id])).toBe(true)

    const loadImage = findByType(graph, 'TestLoadImage')
    const reference = findByType(graph, 'TestReferenceNode')
    const saveVideo = findByType(graph, 'TestSaveVideo')

    expect(readInputOrigins(reference)).toEqual([
      { name: 'image', origin: loadImage.id }
    ])
    expect(readInputOrigins(saveVideo)).toEqual([
      { name: 'images', origin: reference.id }
    ])
    expect(liveLinkIds(graph)).toEqual(expectedLinkIds)

    const reloadedGraph = new LGraph()
    const reload = bindProjection('wf-reloaded', reloadedGraph)
    expect(reload(Y.encodeStateAsUpdate(host), [op.op_id])).toBe(true)
    expect(liveLinkIds(reloadedGraph)).toEqual(expectedLinkIds)
  })

  it('wires a link inserted after the graph is already open, on the incremental path', () => {
    const graph = new LGraph()
    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())

    const seedOp = insertOp(
      { nodes: [{ id: 999, type: 'TestSaveVideo' }] },
      'insert-incremental-seed-op'
    )
    expect(applyOps(host, [seedOp], CATALOG).outcomes).toEqual([
      { op_id: seedOp.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-incremental', graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [seedOp.op_id])).toBe(true)
    expect(graph._nodes).toHaveLength(1)

    const before = Y.encodeStateVector(host)
    const secondOp = insertOp(
      {
        nodes: [
          {
            id: 111,
            type: 'TestLoadImage',
            outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [301] }]
          },
          {
            id: 112,
            type: 'TestReferenceNode',
            inputs: [{ name: 'image', type: 'IMAGE', link: 301 }]
          }
        ],
        links: [[301, 111, 0, 112, 0, 'IMAGE']]
      },
      'insert-incremental-second-op'
    )
    expect(applyOps(host, [secondOp], CATALOG).outcomes).toEqual([
      { op_id: secondOp.op_id, outcome: 'applied' }
    ])
    expectSafeNumericLinkIds(host, 1)
    const expectedLinkIds = docLinkIds(host)
    expect(deliver(Y.encodeStateAsUpdate(host, before), [secondOp.op_id])).toBe(
      true
    )

    const loadImage = findByType(graph, 'TestLoadImage')
    const reference = findByType(graph, 'TestReferenceNode')
    expect(readInputOrigins(reference)).toEqual([
      { name: 'image', origin: loadImage.id }
    ])
    expect(liveLinkIds(graph)).toEqual(expectedLinkIds)
  })

  it('keeps formerly colliding insertions distinct from a persisted id', () => {
    const graph = new LGraph()
    const persistedLinkId = 13_181_811_759
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'TestLoadImage',
            outputs: [
              { name: 'IMAGE', type: 'IMAGE', links: [persistedLinkId] }
            ]
          },
          {
            id: 2,
            type: 'TestSaveVideo',
            inputs: [{ name: 'images', type: 'IMAGE', link: persistedLinkId }]
          }
        ],
        links: [[persistedLinkId, 1, 0, 2, 0, 'IMAGE']]
      },
      CATALOG
    )
    onTestFinished(() => host.destroy())
    const workflow = {
      nodes: [
        {
          id: 101,
          type: 'TestLoadImage',
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [201] }]
        },
        {
          id: 102,
          type: 'TestSaveVideo',
          inputs: [{ name: 'images', type: 'IMAGE', link: 201 }]
        }
      ],
      links: [[201, 101, 0, 102, 0, 'IMAGE']]
    }
    const firstOp = insertOp(workflow, 'd7b0c03fe2abc909a5c84a6e02d80cdd')
    const secondOp = insertOp(workflow, '589889ae708156b3e33fdf39e3cfb931')
    expect(applyOps(host, [firstOp, secondOp], CATALOG).outcomes).toEqual([
      { op_id: firstOp.op_id, outcome: 'applied' },
      { op_id: secondOp.op_id, outcome: 'applied' }
    ])

    expectSafeNumericLinkIds(host, 3)
    const expectedLinkIds = docLinkIds(host)
    expect(new Set(expectedLinkIds).size).toBe(3)
    expect(expectedLinkIds).toContain(persistedLinkId)
    const deliver = bindProjection('wf-colliding-links', graph)
    expect(
      deliver(Y.encodeStateAsUpdate(host), [firstOp.op_id, secondOp.op_id])
    ).toBe(true)
    expect(new Set(liveLinkIds(graph))).toEqual(new Set(expectedLinkIds))
    expect(
      graph.serialize().links.find(([id]) => id === persistedLinkId)
    ).toEqual([persistedLinkId, 1, 0, 2, 0, 'IMAGE'])
  })

  it.for([
    { name: 'canonical numeric string', mapKey: '1', linkId: '1' },
    { name: 'negative string', mapKey: '-1', linkId: '-1' },
    { name: 'fractional string', mapKey: '1.5', linkId: '1.5' },
    {
      name: 'unsafe integer string',
      mapKey: '9007199254740992',
      linkId: '9007199254740992'
    },
    { name: 'negative number', mapKey: '-1', linkId: -1 },
    { name: 'fractional number', mapKey: '1.5', linkId: 1.5 },
    {
      name: 'unsafe integer number',
      mapKey: '9007199254740992',
      linkId: 9_007_199_254_740_992
    },
    { name: 'NaN', mapKey: 'NaN', linkId: Number.NaN },
    { name: 'infinity', mapKey: 'Infinity', linkId: Number.POSITIVE_INFINITY },
    { name: 'missing tuple id', mapKey: '1', linkId: null }
  ])('rejects a $name link id', ({ mapKey, linkId }) => {
    const graph = new LGraph()
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'TestLoadImage',
            outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [linkId] }]
          },
          {
            id: 2,
            type: 'TestSaveVideo',
            inputs: [{ name: 'images', type: 'IMAGE', link: linkId }]
          }
        ],
        links: []
      },
      CATALOG
    )
    onTestFinished(() => host.destroy())
    linksMap(host).set(mapKey, [linkId, 1, 0, 2, 0, 'IMAGE'])

    const deliver = bindProjection('wf-malformed-link', graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [])).toBe(true)
    expect(graph._nodes).toHaveLength(2)
    expect(graph.serialize().links).toHaveLength(0)
  })

  it('retires a live link when its map key and tuple id diverge', () => {
    const graph = new LGraph()
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'TestLoadImage',
            outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [9] }]
          },
          {
            id: 2,
            type: 'TestSaveVideo',
            inputs: [{ name: 'images', type: 'IMAGE', link: 9 }]
          }
        ],
        links: [[9, 1, 0, 2, 0, 'IMAGE']]
      },
      CATALOG
    )
    onTestFinished(() => host.destroy())
    const deliver = bindProjection('wf-divergent-link-id', graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [])).toBe(true)
    expect(liveLinkIds(graph)).toEqual([9])

    const before = Y.encodeStateVector(host)
    linksMap(host).set('9', [10, 1, 0, 2, 0, 'IMAGE'])
    expect(deliver(Y.encodeStateAsUpdate(host, before), [])).toBe(true)
    expect(liveLinkIds(graph)).toEqual([])
  })

  it('removes then reinserts a numeric-id link', () => {
    const graph = new LGraph()
    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())

    const workflow = {
      nodes: [
        {
          id: 121,
          type: 'TestLoadImage',
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [401] }]
        },
        {
          id: 122,
          type: 'TestReferenceNode',
          inputs: [{ name: 'image', type: 'IMAGE', link: 401 }]
        }
      ],
      links: [[401, 121, 0, 122, 0, 'IMAGE']]
    }

    const firstOp = insertOp(workflow, 'insert-reinsertion-first-op')
    expect(applyOps(host, [firstOp], CATALOG).outcomes).toEqual([
      { op_id: firstOp.op_id, outcome: 'applied' }
    ])
    const firstLinkId = docLinkIds(host)[0]
    expectSafeNumericLinkIds(host, 1)
    assert(typeof firstLinkId === 'number')

    const deliver = bindProjection('wf-reinsertion', graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [firstOp.op_id])).toBe(true)

    const loadImage = findByType(graph, 'TestLoadImage')
    const reference = findByType(graph, 'TestReferenceNode')
    expect(readInputOrigins(reference)).toEqual([
      { name: 'image', origin: loadImage.id }
    ])

    const projected = project(host, CATALOG)
    const loadNode = projected.nodes.find((n) => n.type === 'TestLoadImage')
    const refNode = projected.nodes.find((n) => n.type === 'TestReferenceNode')
    assert.exists(loadNode)
    assert.exists(refNode)
    const beforeDisconnect = Y.encodeStateVector(host)
    const disconnect = {
      op_id: 'insert-reinsertion-disconnect-op'.padEnd(32, '0'),
      actor: 'agent:test',
      base_version: 1,
      stamp: [2, 'agent:test'],
      op: 'disconnect',
      link_id: firstLinkId,
      to_node: refNode.id,
      to_slot: 0
    } satisfies DisconnectOp
    expect(applyOps(host, [disconnect], CATALOG).outcomes).toEqual([
      { op_id: disconnect.op_id, outcome: 'applied' }
    ])
    expect(
      deliver(Y.encodeStateAsUpdate(host, beforeDisconnect), [disconnect.op_id])
    ).toBe(true)
    expect(graph._nodes).toHaveLength(2)
    expect(docLinkIds(host)).toEqual([])
    expect(liveLinkIds(graph)).toEqual([])

    const beforeReinsertion = Y.encodeStateVector(host)
    const reinsertionOp = insertOp(workflow, 'insert-reinsertion-second-op')
    expect(applyOps(host, [reinsertionOp], CATALOG).outcomes).toEqual([
      { op_id: reinsertionOp.op_id, outcome: 'applied' }
    ])
    const reinsertedLinkId = docLinkIds(host)[0]
    expectSafeNumericLinkIds(host, 1)
    expect(reinsertedLinkId).not.toBe(firstLinkId)
    expect(
      deliver(Y.encodeStateAsUpdate(host, beforeReinsertion), [
        reinsertionOp.op_id
      ])
    ).toBe(true)

    expect(graph._nodes).toHaveLength(4)
    expect(liveLinkIds(graph)).toEqual([reinsertedLinkId])
  })
})
