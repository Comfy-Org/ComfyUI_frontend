import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  InsertWorkflowOp,
  WidgetCatalog
} from '@comfyorg/comfy-multi-player'
import { assert, beforeEach, expect, it, onTestFinished } from 'vitest'
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
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { AgentCrdtProjection } from '@/workbench/extensions/agent/crdt/agentCrdtProjection'
import { FollowerDoc } from '@/workbench/extensions/agent/crdt/followerDoc'

import type { WidgetUiCallbacks } from './processedWidgetRenderModel'
import { computeProcessedWidgets } from './useProcessedWidgets'

class InteriorWidgetNode extends LGraphNode {
  constructor() {
    super('interior-widget')
    this.serialize_widgets = true
    this.addWidget('text', 'prompt', 'before insert', () => {})
  }
}

const catalog: WidgetCatalog = {
  types: {
    'interior-widget': { widget_order: ['prompt'] }
  }
}

const noopUi: WidgetUiCallbacks = {
  getTooltipConfig: () => ({}),
  handleNodeRightClick: () => {}
}

beforeEach(() => {
  LiteGraph.registerNodeType('interior-widget', InteriorWidgetNode)
})

function bindProjection(workflowId: string, graph: LGraph) {
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => graph)
  projection.bind(workflowId, follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
  })

  let sequence = 0
  return (update: Uint8Array, opIds: string[]) => {
    follower.applyRemoteUpdate(update)
    const committed = projection.applyFrame({
      workflowId,
      seq: ++sequence,
      update,
      actor: 'agent:test',
      opIds
    }).applied
    return committed
  }
}

function serializeWorkflow(graph: LGraph): InsertWorkflowOp['workflow'] {
  return JSON.parse(
    JSON.stringify(graph.serialize())
  ) as InsertWorkflowOp['workflow']
}

it('produces a live Vue widget model for an inserted subgraph-interior node', () => {
  const graph = new LGraph()
  onTestFinished(enableSubgraphNodeCreation(graph))

  const blueprint = new LGraph()
  const subgraph = createTestSubgraph({ rootGraph: blueprint })
  blueprint.subgraphs.set(subgraph.id, subgraph)

  const interior = LiteGraph.createNode('interior-widget')
  assert(interior)
  interior.id = toNodeId(42)
  subgraph.add(interior)
  assert(interior.widgets?.[0])
  interior.widgets[0].value = 'after insert'
  blueprint.add(createTestSubgraphNode(subgraph, { id: 1 }))

  const hostDoc = mint({ nodes: [], links: [] }, catalog)
  onTestFinished(() => hostDoc.destroy())
  const deliver = bindProjection('inserted-subgraph-widget', graph)
  deliver(Y.encodeStateAsUpdate(hostDoc), [])

  const operation: InsertWorkflowOp = {
    op_id: 'inserted-subgraph-widget-test-0001',
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    op: 'insert_workflow',
    workflow: serializeWorkflow(blueprint)
  }
  const vector = Y.encodeStateVector(hostDoc)
  expect(applyOps(hostDoc, [operation], catalog).outcomes).toEqual([
    { op_id: operation.op_id, outcome: 'applied' }
  ])
  expect(
    deliver(Y.encodeStateAsUpdate(hostDoc, vector), [operation.op_id])
  ).toBe(true)

  const instance = graph._nodes.find(
    (node): node is SubgraphNode => node instanceof SubgraphNode
  )
  assert(instance)
  const materialized = instance.subgraph._nodes.find(
    (node) => node.type === 'interior-widget'
  )
  assert(materialized)
  expect(String(materialized.id)).toContain(':')

  const rootGraphId = graph.rootGraph.id
  const localNodeId = stripGraphPrefix(String(materialized.id))
  assert(localNodeId)
  const widgetIds = useWidgetValueStore().getNodeWidgetIds(
    rootGraphId,
    localNodeId
  )
  const processed = computeProcessedWidgets({
    nodeData: materialized._state,
    widgetIds,
    graphId: rootGraphId,
    showAdvanced: false,
    isGraphReady: true,
    rootGraph: graph,
    ui: noopUi
  })

  expect(
    processed.map(({ visible, simplified }) => ({
      name: simplified.name,
      value: simplified.value,
      visible
    }))
  ).toEqual([{ name: 'prompt', value: 'after insert', visible: true }])

  assert(processed[0])
  processed[0].updateHandler('updated through Vue')
  expect(materialized.widgets?.[0]?.value).toBe('updated through Vue')
})
