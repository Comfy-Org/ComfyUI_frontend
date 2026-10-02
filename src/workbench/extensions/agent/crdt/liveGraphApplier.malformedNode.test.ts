import { applyOps, nodesMap } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { toNodeId } from '@/types/nodeId'

import { followedDoc } from './__fixtures__/followedDoc'
import { LiveGraphApplier } from './liveGraphApplier'

vi.mock(import('@/platform/telemetry/reportError'))

class TestSink extends LGraphNode {
  constructor() {
    super('Test Sink')
    this.addInput('image', 'IMAGE')
  }
}

const CATALOG: WidgetCatalog = { types: { TestSink: { widget_order: [] } } }
const CONTEXT = { actor: 'agent:test:turn-1', opIds: ['op-1'] }
const HUMAN_ACTOR = 'human:user-1:tab-1'
const NODE_ID = 149

function sinkNode(slot: Record<string, unknown>) {
  return {
    id: NODE_ID,
    type: 'TestSink',
    pos: [400, 0],
    size: [200, 100],
    inputs: [slot]
  }
}

function setup(workflow: WorkflowJSON) {
  const graph = new LGraph()
  const { doc, collector } = followedDoc(workflow, CATALOG)
  const applier = new LiveGraphApplier({ getGraph: () => graph })
  function applyCollected() {
    return applier.applyChanges(doc, collector.take(), CONTEXT)
  }
  return { graph, doc, collector, applier, applyCollected }
}

function onlyReport() {
  const calls = vi.mocked(reportError).mock.calls
  expect(calls).toHaveLength(1)
  return calls[0]
}

beforeEach(() => {
  LiteGraph.registerNodeType('TestSink', TestSink)
})

describe('LiveGraphApplier malformed node report', () => {
  it('names the node class and the importing producer, and still skips the node', () => {
    const slot = { name: 'image', link: null }
    const { graph, doc, applyCollected } = setup({
      nodes: [sinkNode(slot)],
      links: []
    })

    applyCollected()

    expect(graph.getNodeById(toNodeId(NODE_ID))).toBeNull()
    const [error, options] = onlyReport()
    expect(error).toHaveProperty(
      'message',
      'Document node 149 (TestSink) is malformed: inputs.0.type Invalid input'
    )
    expect(options).toMatchObject({
      errorType: 'agent_graph_node_malformed',
      surface: 'agent',
      context: {
        nodeId: '149',
        issues: 'inputs.0.type Invalid input',
        classType: 'TestSink',
        valueShapes: 'inputs.0.type invalid_union absent',
        producer: { origin: 'unstamped' }
      }
    })
    expect(nodesMap(doc).get('149')?.toJSON().inputs).toEqual([slot])
  })

  it.for<[Record<string, unknown>, string]>([
    [{ name: 'image' }, 'absent'],
    [{ name: 'image', type: undefined }, 'undefined'],
    [{ name: 'image', type: null }, 'null'],
    [{ name: 'image', type: true }, 'boolean'],
    [{ name: 'image', type: [] }, 'array:0'],
    [{ name: 'image', type: {} }, 'object:0'],
    [{ name: 'image', type: { name: 'IMAGE' } }, 'object:1']
  ])(
    'separates %o, which zod collapses to one message, as %s',
    ([slot, shape]) => {
      const { applyCollected } = setup({ nodes: [sinkNode(slot)], links: [] })

      applyCollected()

      const [, options] = onlyReport()
      expect(options).toMatchObject({
        context: { valueShapes: `inputs.0.type invalid_union ${shape}` }
      })
    }
  )

  it('names the stamping operation, and the actor kind without its user segments', () => {
    const { graph, doc, collector, applier } = setup({ nodes: [], links: [] })
    const add = fromPartial<Op>({
      op: 'add_node',
      op_id: 'malformed-add'.padEnd(32, '0'),
      actor: HUMAN_ACTOR,
      base_version: 1,
      stamp: [1, HUMAN_ACTOR],
      node_id: NODE_ID,
      class_type: 'TestSink',
      pos: [400, 0],
      node: sinkNode({ name: 'image', type: null })
    })
    expect(applyOps(doc, [add], CATALOG).outcomes).toEqual([
      { op_id: add.op_id, outcome: 'applied' }
    ])

    applier.applyChanges(doc, collector.take(), CONTEXT)

    expect(graph.getNodeById(toNodeId(NODE_ID))).toBeNull()
    const [, options] = onlyReport()
    expect(options).toMatchObject({
      context: {
        classType: 'TestSink',
        valueShapes: 'inputs.0.type invalid_union null',
        producer: {
          origin: 'operation',
          actorKind: 'human',
          opId: add.op_id,
          version: 1
        }
      }
    })
    // The actor's identity segments are a user id and must not be reported.
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain(
      'user-1'
    )
  })

  it('reports a node that stays malformed once, not once per frame that reads it', () => {
    const { doc, collector, applier, applyCollected } = setup({
      nodes: [sinkNode({ name: 'image', link: null })],
      links: []
    })
    applyCollected()

    doc.transact(() => {
      nodesMap(doc).get('149')?.set('title', 'renamed')
    })
    applier.applyChanges(doc, collector.take(), CONTEXT)

    onlyReport()
  })

  it('reports again after the node is repaired and malformed a second time', () => {
    const { doc, collector, applier, applyCollected } = setup({
      nodes: [sinkNode({ name: 'image', link: null })],
      links: []
    })
    applyCollected()
    onlyReport()

    /**
     * Slot changes alone are not observed — `inputs` is not a synced node
     * field — so each edit rides with a title change, which is what makes the
     * frame reach `readDocNode` at all.
     */
    const reslot = (slot: Record<string, unknown>, title: string) => {
      doc.transact(() => {
        const node = nodesMap(doc).get('149')
        node?.set('inputs', [slot])
        node?.set('title', title)
      })
      applier.applyChanges(doc, collector.take(), CONTEXT)
    }

    reslot({ name: 'image', type: 'IMAGE', link: null }, 'repaired')
    reslot({ name: 'image', type: [], link: null }, 'broken again')

    const calls = vi.mocked(reportError).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[1]?.[1]).toMatchObject({
      context: { valueShapes: 'inputs.0.type invalid_union array:0' }
    })
  })
})
