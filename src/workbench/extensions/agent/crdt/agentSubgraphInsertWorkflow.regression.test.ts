/**
 * Pasting a subgraph blueprint arrives as an `insert_workflow` op. cmp's
 * `remapInsertedWorkflowIds` mints fresh ids for everything the op carries,
 * including a definition's interior `nodes`, `links` and each interior node's
 * `inputs[].link`. An earlier release did not rewrite the definition's OWN
 * top-level `inputs[].linkIds` (comfy-multi-player PR #230 fixed it), which
 * left the host's promoted widgets unresolvable. The live graph must resolve
 * the host's promoted widgets and carry the blueprint value onto them.
 */
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

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
import { toNodeId } from '@/types/nodeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
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
    const projection = new AgentCrdtProjection(() => graph)
    projection.bind('workflow', follower)
    onTestFinished(() => {
      projection.destroy()
      follower.destroy()
      hostDoc.destroy()
    })

    const seed = Y.encodeStateAsUpdate(hostDoc)
    follower.applyRemoteUpdate(seed)
    expect(
      projection.applyFrame({ workflowId: 'workflow', seq: 1, update: seed })
    ).not.toBeNull()

    const op = insertOp(blueprint())
    const vector = Y.encodeStateVector(hostDoc)
    expect(applyOps(hostDoc, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])
    const update = Y.encodeStateAsUpdate(hostDoc, vector)
    follower.applyRemoteUpdate(update)
    expect(
      projection.applyFrame({
        workflowId: 'workflow',
        seq: 2,
        update,
        actor: 'agent:test',
        opIds: [op.op_id]
      })
    ).not.toBeNull()

    const instance = graph.nodes.find(
      (node): node is SubgraphNode => node instanceof SubgraphNode
    )
    expect(instance).toBeDefined()

    expect(vi.mocked(reportError)).not.toHaveBeenCalled()
    expect(instance!.widgets.map((widget) => widget.name)).toEqual(['value'])
    expect(instance!.widgets[0]?.value).toBe(BLUEPRINT_VALUE)
  })
})
