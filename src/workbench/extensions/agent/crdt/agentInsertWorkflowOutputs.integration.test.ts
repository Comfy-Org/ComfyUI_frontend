/**
 * PM-2037 / PM-1826 / PM-1668: an agent-built graph's run output must land on
 * the canvas node that produced it.
 *
 * The node ids here are not hand-typed: a real `insert_workflow` op goes
 * through comfy-multi-player's applier and the follower projection, so the
 * canvas carries whatever id format the pinned comfy-multi-player mints. The
 * `executed` frame then names each node the way the backend does: the prompt
 * key for a root node, `<host id>:<interior id>` for a subgraph interior
 * (ExecutableNodeDTO). Output delivery and lookup run through the real
 * nodeOutputStore, graph traversal and workflow store.
 */
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  InsertWorkflowOp,
  WidgetCatalog
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
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ExecutedWsMessage } from '@/platform/remote/comfyui/execution/types'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { toNodeId } from '@/types/nodeId'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/telemetry/reportError'))

class SaveImageNode extends LGraphNode {
  constructor() {
    super('SaveImage')
    this.addInput('images', 'IMAGE')
  }
}

const CATALOG: WidgetCatalog = {
  types: { SaveImage: { widget_order: [] } }
}

function outputFor(filename: string): ExecutedWsMessage['output'] {
  return { images: [{ filename, subfolder: '', type: 'output' }] }
}

beforeEach(() => {
  LiteGraph.registerNodeType('SaveImage', SaveImageNode)
})

function saveImage(id: number): LGraphNode {
  const node = LiteGraph.createNode('SaveImage')!
  node.id = toNodeId(id)
  return node
}

function rootBlueprint(): InsertWorkflowOp['workflow'] {
  const graph = new LGraph()
  graph.add(saveImage(9))
  return JSON.parse(
    JSON.stringify(graph.serialize())
  ) as InsertWorkflowOp['workflow']
}

function subgraphBlueprint(): InsertWorkflowOp['workflow'] {
  const graph = new LGraph()
  const subgraph = createTestSubgraph({ rootGraph: graph })
  graph.subgraphs.set(subgraph.id, subgraph)
  subgraph.add(saveImage(6))
  graph.add(createTestSubgraphNode(subgraph, { id: 105 }))
  return JSON.parse(
    JSON.stringify(graph.serialize())
  ) as InsertWorkflowOp['workflow']
}

/** Insert each workflow as its own `insert_workflow` op onto a live canvas. */
function canvasFromInserts(
  ...workflows: InsertWorkflowOp['workflow'][]
): LGraph {
  const graph = new LGraph()
  onTestFinished(enableSubgraphNodeCreation(graph))
  const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => graph)
  projection.bind('wf-agent-outputs', follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
    hostDoc.destroy()
  })

  const ops: InsertWorkflowOp[] = workflows.map((workflow, index) => ({
    op_id: `agent-outputs-op-${index}`.padEnd(32, '0'),
    actor: 'agent:test',
    base_version: index + 1,
    stamp: [index + 1, 'agent:test'],
    op: 'insert_workflow',
    workflow
  }))
  expect(
    applyOps(hostDoc, ops, CATALOG).outcomes.map(({ outcome }) => outcome)
  ).toEqual(ops.map(() => 'applied'))

  const update = Y.encodeStateAsUpdate(hostDoc)
  follower.applyRemoteUpdate(update)
  expect(
    projection.applyFrame({
      workflowId: 'wf-agent-outputs',
      seq: 1,
      update,
      actor: 'agent:test',
      opIds: ops.map(({ op_id }) => op_id)
    }).applied
  ).toBe(true)

  Object.assign(app, {
    rootGraph: graph,
    nodeOutputs: {},
    nodePreviewImages: {}
  })
  return graph
}

function rootSaveImages(graph: LGraph): LGraphNode[] {
  return graph._nodes.filter((node) => node.type === 'SaveImage')
}

function insertedSubgraphInterior(graph: LGraph): [SubgraphNode, LGraphNode] {
  const host = graph._nodes.find(
    (node): node is SubgraphNode => node instanceof SubgraphNode
  )
  if (!host) throw new Error('insert_workflow materialized no subgraph host')
  const interior = host.subgraph._nodes.find(
    (node) => node.type === 'SaveImage'
  )
  if (!interior) throw new Error('inserted subgraph has no Save Image node')
  return [host, interior]
}

function executionId(path: LGraphNode[]): NodeExecutionId {
  const id = tryNormalizeNodeExecutionId(
    path.map((node) => String(node.id)).join(':')
  )
  if (!id) throw new Error('backend execution id did not normalize')
  return id
}

describe('agent insert_workflow: executed outputs reach the inserted node', () => {
  it('pins the id class under test: inserted node ids carry the execution-path delimiter', () => {
    const graph = canvasFromInserts(rootBlueprint(), subgraphBlueprint())
    const [host, interior] = insertedSubgraphInterior(graph)

    const ids = [...rootSaveImages(graph), host, interior].map((node) =>
      String(node.id)
    )
    expect(ids).toEqual(ids.map(() => expect.stringContaining(':')))
  })

  it('lands an executed output on an inserted root Save Image node', () => {
    const graph = canvasFromInserts(rootBlueprint())
    const [node] = rootSaveImages(graph)
    const output = outputFor('root.png')

    useNodeOutputStore().setNodeOutputsByExecutionId(
      executionId([node]),
      output
    )

    expect(useNodeOutputStore().getNodeOutputs(node)).toEqual(output)
  })

  it('lands an executed output on a Save Image node inside an inserted subgraph', () => {
    const graph = canvasFromInserts(subgraphBlueprint())
    const [host, interior] = insertedSubgraphInterior(graph)
    const output = outputFor('interior.png')

    useNodeOutputStore().setNodeOutputsByExecutionId(
      executionId([host, interior]),
      output
    )

    expect(useNodeOutputStore().getNodeOutputs(interior)).toEqual(output)
  })

  it('keeps outputs of the same template inserted twice on their own copies', () => {
    const graph = canvasFromInserts(rootBlueprint(), rootBlueprint())
    const [first, second] = rootSaveImages(graph)
    expect(first.id).not.toBe(second.id)

    useNodeOutputStore().setNodeOutputsByExecutionId(
      executionId([first]),
      outputFor('first.png')
    )
    useNodeOutputStore().setNodeOutputsByExecutionId(
      executionId([second]),
      outputFor('second.png')
    )

    expect(useNodeOutputStore().getNodeOutputs(first)).toEqual(
      outputFor('first.png')
    )
    expect(useNodeOutputStore().getNodeOutputs(second)).toEqual(
      outputFor('second.png')
    )
  })

  it.for([
    {
      label: 'an inserted root node',
      blueprint: rootBlueprint,
      pathOf: (graph: LGraph): LGraphNode[] => rootSaveImages(graph)
    },
    {
      label: 'an interior node of an inserted subgraph',
      blueprint: subgraphBlueprint,
      pathOf: (graph: LGraph): LGraphNode[] => insertedSubgraphInterior(graph)
    }
  ])(
    'round-trips $label through locator and execution ids',
    ({ blueprint, pathOf }) => {
      const graph = canvasFromInserts(blueprint())
      const path = pathOf(graph)
      const node = path[path.length - 1]
      const workflowStore = useWorkflowStore()

      const locatorId = workflowStore.nodeToNodeLocatorId(node)

      expect(workflowStore.nodeLocatorIdToNodeId(locatorId)).toBe(node.id)
      expect(workflowStore.nodeLocatorIdToNodeExecutionId(locatorId)).toBe(
        executionId(path)
      )
    }
  )
})
