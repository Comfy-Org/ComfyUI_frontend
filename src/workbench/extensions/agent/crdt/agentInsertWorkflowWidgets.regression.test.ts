/**
 * PM-1580: an agent's `insert_workflow` batch (e.g. loading a template like
 * "Z Image Turbo") materialized nodes with correct positions, types and
 * links (PM-1562 fixed the links), but every inserted node rendered with no
 * widgets at all — the underlying widget values were present in the CRDT
 * document and in the widget store, but nothing on screen showed them.
 *
 * Root cause: comfy-multi-player's `insert_workflow` applier remaps every
 * node id it inserts to a derived string carrying colons for reasons that
 * have nothing to do with subgraph scoping
 * (`insert:<opId>:<scope>:node:<originalId>`, `remap.ts`'s `derivedId`).
 * Widget registration (`attachNodeToStores`/`BaseWidget.setNodeId`) always
 * keys on that full id. The node-rendering path
 * (`LGraphNode.vue`'s `widgetIds`, `processedWidgetRenderModel.ts`) reads
 * widget ids back through `stripGraphPrefix`, which used to strip
 * everything up to the LAST colon unconditionally — collapsing the derived
 * id down to its trailing numeric segment (e.g. `9`) instead of the id it
 * was actually registered under. The lookup then found nothing, so the
 * node rendered with zero widget rows.
 *
 * This test drives the real pipeline (comfy-multi-player's `insert_workflow`
 * applier → `AgentCrdtProjection` → `LiveGraphApplier` → the LiteGraph
 * graph API) and then reads widget ids back the same way the
 * Vue node component does, through `stripGraphPrefix` +
 * `widgetValueStore.getNodeWidgetIds`.
 */
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  InsertWorkflowOp,
  WidgetCatalog
} from '@comfyorg/comfy-multi-player'
import { describe, expect, it, onTestFinished } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'

class TestSaveImage extends LGraphNode {
  static override title = 'Test Save Image'
  constructor() {
    super('Test Save Image')
    this.addInput('images', 'IMAGE')
    this.addWidget('text', 'filename_prefix', 'ComfyUI', () => {})
    this.serialize_widgets = true
  }
}

const CATALOG: WidgetCatalog = {
  types: { TestSaveImage: { widget_order: ['filename_prefix'] } }
}

function insertOp(
  workflow: InsertWorkflowOp['workflow'],
  opId: string
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
  const projection = new AgentCrdtProjection(() => graph)
  projection.bind(workflowId, follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
  })

  let seq = 0
  const deliver = (update: Uint8Array, opIds: string[]): boolean => {
    follower.applyRemoteUpdate(update)
    const committed =
      projection.applyFrame({
        workflowId,
        seq: ++seq,
        update,
        actor: 'agent:test',
        opIds
      }) !== null
    return committed
  }
  return deliver
}

/** What `LGraphNode.vue`'s `widgetIds` computed does, read straight from the store. */
function renderedWidgetNames(graphId: string, nodeId: string): string[] {
  const widgetValueStore = useWidgetValueStore()
  const bareNodeId = stripGraphPrefix(nodeId)
  if (!bareNodeId) return []
  return widgetValueStore
    .getNodeWidgetIds(graphId as never, bareNodeId)
    .flatMap((id) => {
      const widget = widgetValueStore.getWidget(id)
      return widget ? [widget.name] : []
    })
}

describe('insert_workflow materializes a node whose widgets actually render', () => {
  it('the inserted node has a discoverable, correctly-valued widget', () => {
    LiteGraph.registerNodeType('TestSaveImage', TestSaveImage)
    const graph = new LGraph()
    const workflowId = 'wf-insert-widgets'
    const host = mint({ nodes: [], links: [] }, CATALOG)
    const deliver = bindProjection(workflowId, graph)
    deliver(Y.encodeStateAsUpdate(host), [])

    const op = insertOp(
      {
        nodes: [
          {
            id: 5,
            type: 'TestSaveImage',
            widgets_values: ['my_custom_prefix']
          }
        ],
        links: []
      },
      'insert-widget-op'
    )
    const vector = Y.encodeStateVector(host)
    expect(applyOps(host, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])
    expect(deliver(Y.encodeStateAsUpdate(host, vector), [op.op_id])).toBe(true)

    const node = graph._nodes.find(
      (candidate) => candidate.type === 'TestSaveImage'
    )
    expect(node).toBeDefined()
    if (!node) return

    // The materialized live id is comfy-multi-player's remapped id, which
    // carries colons that are not a subgraph scope prefix.
    expect(String(node.id)).toContain(':')
    expect(String(node.id)).not.toMatch(/^\d+$/)

    const names = renderedWidgetNames(graph.rootGraph.id, String(node.id))
    expect(names).toEqual(['filename_prefix'])
    expect(node.widgets?.[0]?.value).toBe('my_custom_prefix')
  })

  it("two inserted nodes sharing an original id, in the SAME graph, do not steal each other's widgets", () => {
    LiteGraph.registerNodeType('TestSaveImage', TestSaveImage)
    const graph = new LGraph()
    const host = mint({ nodes: [], links: [] }, CATALOG)
    const deliver = bindProjection('wf-collision', graph)
    deliver(Y.encodeStateAsUpdate(host), [])

    // Same original node id (9), same target graph, from two independent
    // insert_workflow ops — as could happen inserting two different
    // templates that both number their sole SaveImage node "9" into the
    // same workflow. Only the differing `op_id` disambiguates the derived
    // ids; a `stripGraphPrefix` that collapsed both down to their trailing
    // segment ("9") would collide them in this SAME graph's per-node maps,
    // unlike the cross-graph case where separate top-level graph keys would
    // mask the collision regardless of the fix.
    const opA = insertOp(
      {
        nodes: [{ id: 9, type: 'TestSaveImage', widgets_values: ['a'] }],
        links: []
      },
      'insert-op-a'
    )
    const opB = insertOp(
      {
        nodes: [{ id: 9, type: 'TestSaveImage', widgets_values: ['b'] }],
        links: []
      },
      'insert-op-b'
    )

    const vectorA = Y.encodeStateVector(host)
    expect(applyOps(host, [opA], CATALOG).outcomes[0]?.outcome).toBe('applied')
    expect(deliver(Y.encodeStateAsUpdate(host, vectorA), [opA.op_id])).toBe(
      true
    )

    const vectorB = Y.encodeStateVector(host)
    expect(applyOps(host, [opB], CATALOG).outcomes[0]?.outcome).toBe('applied')
    expect(deliver(Y.encodeStateAsUpdate(host, vectorB), [opB.op_id])).toBe(
      true
    )

    const saveImageNodes = graph._nodes.filter(
      (n) => n.type === 'TestSaveImage'
    )
    expect(saveImageNodes).toHaveLength(2)
    const [nodeA, nodeB] = saveImageNodes
    expect(nodeA.id).not.toBe(nodeB.id)

    expect(renderedWidgetNames(graph.rootGraph.id, String(nodeA.id))).toEqual([
      'filename_prefix'
    ])
    expect(renderedWidgetNames(graph.rootGraph.id, String(nodeB.id))).toEqual([
      'filename_prefix'
    ])
    expect(nodeA.widgets?.[0]?.value).toBe('a')
    expect(nodeB.widgets?.[0]?.value).toBe('b')
  })
})
