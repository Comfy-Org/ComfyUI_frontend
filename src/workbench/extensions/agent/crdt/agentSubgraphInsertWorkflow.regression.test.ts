/**
 * RED — expected to fail against `@comfyorg/comfy-multi-player@0.3.0`.
 *
 * Pasting a subgraph blueprint arrives as an `insert_workflow` op. cmp's
 * `remapInsertedWorkflowIds` (`src/remap.ts`) mints fresh ids for everything
 * the op carries, including a definition's interior `nodes`, `links` and each
 * interior node's `inputs[].link`. It does not rewrite the definition's OWN
 * top-level `inputs[].linkIds` — the promoted-widget declarations naming which
 * interior links feed each declared input — and it drops a definition-interior
 * link whose origin is the subgraph IO node (-10) as dangling.
 *
 * `promotedWidgetNames()` (`agentSubgraphHostSlots.ts`) resolves those
 * `linkIds` against the definition's own remapped `links`, so every declared
 * input reads back as unpromoted. The host still carries its blueprint
 * `widgets_values` positionally, so `readSemanticNode` sees N opaque values
 * against 0 promoted names, reports
 * `error_reconciling_agent_subgraph_host_widgets`, and drops the values rather
 * than risk landing them on the wrong widget.
 *
 * Nothing in this repo is wrong: the reader is behaving exactly as designed
 * for a definition whose declarations do not match its links. The fix belongs
 * upstream (comfy-multi-player PR #230) and this test goes green when the
 * dependency is bumped past the release that carries it.
 */
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from './graphMutations'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import {
  LGraph,
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { reportError } from '@/platform/telemetry/reportError'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { readSubgraphDefinitions } from './agentSubgraphDefinitions'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

class PromotedWidgetNode extends LGraphNode {
  constructor() {
    super('promoted-widget')
    const input = this.addInput('value', 'NUMBER')
    input.widget = { name: 'value' }
    this.addWidget('number', 'value', 1, () => {})
  }
}

class SourceNode extends LGraphNode {
  constructor() {
    super('source')
    this.addOutput('value', 'NUMBER')
  }
}

/** The value the pasted blueprint carries on its promoted host widget. */
const BLUEPRINT_VALUE = 7

const CATALOG: WidgetCatalog = {
  types: {
    'promoted-widget': { widget_order: ['value'] },
    source: { widget_order: [] }
  }
}

/**
 * A pasteable blueprint: one subgraph definition declaring a `value` input
 * wired to an interior node's widget-bearing input, plus one host instance of
 * it carrying a promoted value. Built by serializing a real litegraph graph,
 * the same shape the paste path hands the op layer.
 */
function blueprint(): WorkflowJSON {
  const graph = new LGraph()
  const subgraph = createTestSubgraph({
    rootGraph: graph,
    inputs: [{ name: 'value', type: 'NUMBER' }]
  })
  // createTestSubgraph never registers on the root; serialize() only emits
  // definitions for subgraphs present in graph.subgraphs (LGraph.ts ~2761).
  graph.subgraphs.set(subgraph.id, subgraph)
  // `new PromotedWidgetNode()` leaves `type` unset; only `createNode` stamps
  // it, and cmp's insert path drops nodes whose serialized `type` is empty.
  const interior = LiteGraph.createNode('promoted-widget')!
  interior.id = toNodeId(7)
  subgraph.add(interior)
  // The declared input feeds the interior widget: this is what makes `value` a
  // genuinely promoted widget on the host.
  subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)

  const host = createTestSubgraphNode(subgraph, { id: 1 })
  graph.add(host)
  host.widgets[0].value = BLUEPRINT_VALUE

  // The op travels as JSON, so round-trip it: litegraph serializes some
  // optional fields as `undefined`, which the op layer rejects as
  // non-serializable before the wire ever sees them.
  return JSON.parse(JSON.stringify(graph.serialize())) as WorkflowJSON
}

function insertOp(workflow: WorkflowJSON): Op {
  return {
    op_id: 'insert-blueprint-op'.padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    op: 'insert_workflow',
    workflow
  } as unknown as Op
}

beforeEach(() => {
  LiteGraph.registerNodeType('promoted-widget', PromotedWidgetNode)
  LiteGraph.registerNodeType('source', SourceNode)
})

describe('pasting a subgraph blueprint through insert_workflow', () => {
  it('promotes the host widgets the definition declares', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    // An existing document the blueprint is pasted into.
    const hostDoc = mint(
      {
        nodes: [
          {
            id: 2,
            type: 'source',
            outputs: [{ name: 'value', type: 'NUMBER', links: [] }]
          }
        ],
        links: []
      },
      CATALOG
    )
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(
      createGraphMutations({
        placement: inertPlacementPort,
        getScope: () => graphScopeOf(graph),
        layout: { createNode: () => {}, deleteNodes: () => {} }
      })
    )
    adapter.bind('workflow', follower)
    onTestFinished(() => {
      adapter.destroy()
      follower.destroy()
      hostDoc.destroy()
    })

    const seed = Y.encodeStateAsUpdate(hostDoc)
    follower.applyRemoteUpdate(seed)
    expect(
      adapter.applyFrame({ workflowId: 'workflow', seq: 1, update: seed })
    ).toBe(true)

    const op = insertOp(blueprint())
    const vector = Y.encodeStateVector(hostDoc)
    expect(applyOps(hostDoc, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])
    const update = Y.encodeStateAsUpdate(hostDoc, vector)
    follower.applyRemoteUpdate(update)
    expect(
      adapter.applyFrame({
        workflowId: 'workflow',
        seq: 2,
        update,
        actor: 'agent:test',
        opIds: [op.op_id]
      })
    ).toBe(true)
    reconcileAgentAdapters(graph, readSubgraphDefinitions(follower.doc))

    const instance = graph.nodes.find(
      (node): node is SubgraphNode => node instanceof SubgraphNode
    )
    expect(instance).toBeDefined()

    // Today the reader sees no promoted surface, so it drops the host's
    // opaque values and reports the drift instead of re-keying them.
    expect(vi.mocked(reportError)).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorType: 'error_reconciling_agent_subgraph_host_widgets'
      })
    )
    expect(instance!.widgets.map((widget) => widget.name)).toEqual(['value'])
    expect(instance!.widgets[0]?.value).toBe(BLUEPRINT_VALUE)
  })
})
