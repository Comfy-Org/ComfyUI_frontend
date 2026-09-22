/**
 * RED — reproduces the links dropped by a plain, non-subgraph `insert_workflow`
 * batch: the agent inserts several new nodes and the links between them in one
 * op, and the links never materialize on the live canvas even though the doc's
 * stamps ledger confirms both `insert_workflow_link` writes landed.
 *
 * This is deliberately NOT the autogrow hand-wire race
 * `agentCrdtProjection.reconnectAdoptionRace.test.ts` covers: there is no
 * existing occupant at any target slot here, and neither target node has a
 * live LiteGraph facade before this op arrives, so `graphMutations.ts`'s
 * `commit()` never takes its `detachLinkSlots` branch and the `LinkMap`
 * revision race that fix addresses never triggers. Every node and every link
 * in this batch is brand new.
 *
 * Root cause (found while writing this test, not fixed here): cmp's
 * `insert_workflow` applier mints a fresh, non-numeric doc id for every node
 * AND every link it inserts (`remap.ts`'s `derivedId`, e.g.
 * `insert:<opId>:root:link:201`) so a re-pasted/re-generated batch can never
 * collide with an existing id. `ecsFollowerAdapter.ts`'s `readSemanticLink`
 * narrows a link's doc id through `Number(tuple[0])` and requires
 * `Number.isInteger` on the result; a derived string id always fails that
 * check, so the link is treated as unreadable. On the full-reconcile path
 * (the first frame a session binds, or any frame following a rejected batch)
 * that unreadable link is silently filtered out of the batch with no error
 * reported, while every node in the same batch reads and commits fine
 * (`readSemanticNode` has no such numeric constraint) -- nodes with correct
 * widget values, zero connections, no visible error. On the incremental path
 * it is worse: the unreadable link's id also fails to convert for
 * `removeLinks`, so `graphMutations.ts`'s `prepare()` rejects the WHOLE
 * batch, including the node adds sharing it.
 */
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it } from 'vitest'
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

/** Stand-in for a real API node with one image in, one image out. */
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

function insertOp(workflow: object): Op {
  return {
    op_id: 'insert-plain-chain-op'.padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    op: 'insert_workflow',
    workflow
  } as unknown as Op
}

/** Links read back from a node's live inputs, in slot order. */
function readInputOrigins(node: LGraphNode) {
  return node.inputs.map((input, index) => ({
    name: input.name,
    origin: node.getInputLink(index)?.origin_id ?? null
  }))
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
  it('wires every node the batch inserted, not just their widget values', () => {
    const graph = new LGraph()

    // The agent's single top-level insert: three brand-new nodes and the two
    // brand-new links between them, exactly as `insert_workflow` carries a
    // pasted/generated chain -- LoadImage -> ReferenceNode -> SaveVideo. This
    // lands as the FIRST frame the session ever sees, so the follower takes
    // its full-reconcile path (`reconcileNextFrame` starts `true`) -- the
    // same path a fresh session bind or page load takes, and the one that
    // silently drops the unreadable link instead of rejecting the batch.
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
    const op = insertOp(workflow)
    expect(applyOps(host, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

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
    projection.bind(WORKFLOW_ID, follower)

    const update = Y.encodeStateAsUpdate(host)
    follower.applyRemoteUpdate(update)
    expect(
      projection.applyFrame({
        workflowId: WORKFLOW_ID,
        seq: 1,
        update,
        actor: 'agent:test',
        opIds: [op.op_id]
      })
    ).toBe(true)
    projection.reconcileLiveGraph(WORKFLOW_ID)

    const loadImage = findByType(graph, 'TestLoadImage')
    const reference = findByType(graph, 'TestReferenceNode')
    const saveVideo = findByType(graph, 'TestSaveVideo')

    expect(readInputOrigins(reference)).toEqual([
      { name: 'image', origin: loadImage.id }
    ])
    expect(readInputOrigins(saveVideo)).toEqual([
      { name: 'images', origin: reference.id }
    ])
    // The symptom reported against the live graph: a fresh serialize() of the
    // just-inserted batch should carry both links, not an empty array.
    expect(graph.serialize().links).toHaveLength(2)
  })
})
