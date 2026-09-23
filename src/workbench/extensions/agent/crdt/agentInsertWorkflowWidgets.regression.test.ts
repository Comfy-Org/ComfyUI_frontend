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
 * applier → `EcsFollowerAdapter` → `graphMutations` →
 * `agentNodeMaterializer`) and then reads widget ids back the same way the
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
import { graphScopeOf } from '@/types/graphScopeId'

import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'

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
  const projection = new EcsFollowerAdapter(
    createGraphMutations({
      getScope: () => graphScopeOf(graph),
      layout: { createNode: () => {}, deleteNodes: () => {} },
      placement: inertPlacementPort
    })
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
    reconcileAgentAdapters(graph, [])
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

  it("two inserted nodes sharing an original id do not steal each other's widgets", () => {
    LiteGraph.registerNodeType('TestSaveImage', TestSaveImage)
    const graphA = new LGraph()
    const graphB = new LGraph()
    const hostA = mint({ nodes: [], links: [] }, CATALOG)
    const hostB = mint({ nodes: [], links: [] }, CATALOG)
    const deliverA = bindProjection('wf-a', graphA)
    const deliverB = bindProjection('wf-b', graphB)
    deliverA(Y.encodeStateAsUpdate(hostA), [])
    deliverB(Y.encodeStateAsUpdate(hostB), [])

    // Same original node id (9) in two independent insert_workflow ops, as
    // could happen for two different templates that both number their sole
    // SaveImage node "9".
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

    const vectorA = Y.encodeStateVector(hostA)
    expect(applyOps(hostA, [opA], CATALOG).outcomes[0]?.outcome).toBe('applied')
    expect(deliverA(Y.encodeStateAsUpdate(hostA, vectorA), [opA.op_id])).toBe(
      true
    )

    const vectorB = Y.encodeStateVector(hostB)
    expect(applyOps(hostB, [opB], CATALOG).outcomes[0]?.outcome).toBe('applied')
    expect(deliverB(Y.encodeStateAsUpdate(hostB, vectorB), [opB.op_id])).toBe(
      true
    )

    const nodeA = graphA._nodes.find((n) => n.type === 'TestSaveImage')
    const nodeB = graphB._nodes.find((n) => n.type === 'TestSaveImage')
    expect(nodeA).toBeDefined()
    expect(nodeB).toBeDefined()
    if (!nodeA || !nodeB) return

    expect(renderedWidgetNames(graphA.rootGraph.id, String(nodeA.id))).toEqual([
      'filename_prefix'
    ])
    expect(renderedWidgetNames(graphB.rootGraph.id, String(nodeB.id))).toEqual([
      'filename_prefix'
    ])
    expect(nodeA.widgets?.[0]?.value).toBe('a')
    expect(nodeB.widgets?.[0]?.value).toBe('b')
  })
})
