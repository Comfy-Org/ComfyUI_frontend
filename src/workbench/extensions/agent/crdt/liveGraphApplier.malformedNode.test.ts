import {
  applyOps,
  nodesMap,
  OPAQUE_WIDGETS_KEY
} from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

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
const DIAGNOSTIC_BUDGET = 1024

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

function onlyReportContext(): Record<string, unknown> {
  const [, options] = onlyReport()
  assert(options.context)
  return options.context
}

function diagnosticStringChars(value: unknown): number {
  if (typeof value === 'string') return value.length
  if (Array.isArray(value)) {
    return value.reduce(
      (total, entry) => total + diagnosticStringChars(entry),
      0
    )
  }
  if (value === null || typeof value !== 'object') return 0
  return Object.values(value).reduce(
    (total, entry) => total + diagnosticStringChars(entry),
    0
  )
}

beforeEach(() => {
  LiteGraph.registerNodeType('TestSink', TestSink)
})

describe('LiveGraphApplier malformed node report', () => {
  it('names the node class and unstamped producer, and still skips the node', () => {
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

  it('creates a node whose slot type is a list of types', () => {
    const { graph, applyCollected } = setup({
      nodes: [sinkNode({ name: 'image', type: ['IMAGE', 'MASK'], link: null })],
      links: []
    })

    applyCollected()

    expect(graph.getNodeById(toNodeId(NODE_ID))?.inputs[0]?.type).toEqual([
      'IMAGE',
      'MASK'
    ])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports an opaque widget record with a length key instead of configuring from it', () => {
    const { graph, doc, applyCollected } = setup({
      nodes: [sinkNode({ name: 'image', type: 'IMAGE', link: null })],
      links: []
    })
    const node = nodesMap(doc).get(String(NODE_ID))
    assert(node instanceof Y.Map)
    node.set(OPAQUE_WIDGETS_KEY, { length: 3, video: 'clip.mp4' })

    applyCollected()

    expect(graph.getNodeById(toNodeId(NODE_ID))).toBeNull()
    const [, options] = onlyReport()
    expect(options).toMatchObject({
      context: { valueShapes: `${OPAQUE_WIDGETS_KEY} custom object:2` }
    })
  })

  it.for<[Record<string, unknown>, string]>([
    [{ name: 'image' }, 'invalid_union absent'],
    [{ name: 'image', type: undefined }, 'invalid_union undefined'],
    [{ name: 'image', type: null }, 'invalid_union null'],
    [{ name: 'image', type: true }, 'invalid_union boolean'],
    [{ name: 'image', type: [] }, 'too_small array:0[]'],
    [{ name: 'image', type: {} }, 'invalid_union object:0'],
    [{ name: 'image', type: { name: 'IMAGE' } }, 'invalid_union object:1'],
    [{ name: 'image', type: [0, 0] }, 'invalid_union array:2[number,number]'],
    [
      { name: 'image', type: [null, 'IMAGE'] },
      'invalid_union array:2[null,string]'
    ],
    [
      { name: 'image', type: ['IMAGE', [1]] },
      'invalid_union array:2[string,array]'
    ]
  ])(
    'separates %o, which zod collapses to one message, as %s',
    ([slot, issue]) => {
      const { applyCollected } = setup({ nodes: [sinkNode(slot)], links: [] })

      applyCollected()

      const [, options] = onlyReport()
      expect(options).toMatchObject({
        context: { valueShapes: `inputs.0.type ${issue}` }
      })
    }
  )

  it('keeps the real array length while shaping a bounded number of elements', () => {
    const { applyCollected } = setup({
      nodes: [
        sinkNode({ name: 'image', type: Array.from({ length: 40 }, () => 0) })
      ],
      links: []
    })

    applyCollected()

    const shapes = String(onlyReportContext().valueShapes)
    expect(shapes).toContain('array:40[')
    expect(shapes).toContain('+24]')
    expect(shapes.split('number').length - 1).toBe(16)
  })

  it('bounds an oversized diagnostic context instead of forwarding it whole', () => {
    const { doc, applyCollected } = setup({
      nodes: [
        {
          ...sinkNode({ name: 'image' }),
          inputs: Array.from({ length: 60 }, (_, index) => ({
            name: `slot${index}`
          }))
        }
      ],
      links: []
    })
    doc
      .getMap('__stamps')
      .set(JSON.stringify(['node', String(NODE_ID)]), [
        1,
        HUMAN_ACTOR,
        'op'.repeat(800)
      ])

    applyCollected()

    const context = onlyReportContext()
    expect(diagnosticStringChars(context)).toBeLessThanOrEqual(
      DIAGNOSTIC_BUDGET
    )
    expect(context).toMatchObject({ nodeId: '149', classType: 'TestSink' })
    expect(context.valueShapes).toBe('')
    expect(context.producer).toMatchObject({
      origin: 'operation',
      actorKind: 'human',
      opId: expect.stringMatching(/\+\d+$/)
    })
  })

  it('does not add omission markers after short strings exhaust the budget', () => {
    const applier = new LiveGraphApplier({ getGraph: () => new LGraph() })
    const reportOnce = Reflect.get(applier, 'reportOnce')
    assert(typeof reportOnce === 'function')

    Reflect.apply(reportOnce, applier, [
      'many-short-strings',
      'many short strings',
      'agent_graph_many_short_strings',
      { values: Array.from({ length: 600 }, () => 'aa') }
    ])

    expect(diagnosticStringChars(onlyReportContext())).toBeLessThanOrEqual(
      DIAGNOSTIC_BUDGET
    )
  })

  it('names the stamping operation, and the actor kind without its user segments', () => {
    const { graph, doc, collector, applier } = setup({ nodes: [], links: [] })
    const add = {
      op: 'add_node',
      op_id: 'malformed-add'.padEnd(32, '0'),
      actor: HUMAN_ACTOR,
      base_version: 1,
      stamp: [1, HUMAN_ACTOR],
      node_id: NODE_ID,
      class_type: 'TestSink',
      pos: [400, 0],
      node: sinkNode({ name: 'image', type: null })
    } satisfies Op
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
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain(
      'user-1'
    )
  })

  it('still reports when the producer ledger is unreadable', () => {
    const { doc, applyCollected } = setup({
      nodes: [sinkNode({ name: 'image', link: null })],
      links: []
    })
    doc.getMap('meta').set('schema_version', 'unreadable')

    applyCollected()

    const [, options] = onlyReport()
    expect(options).toMatchObject({
      context: { producer: { origin: 'unreadable' } }
    })
  })

  it.for<[string, unknown]>([
    ['a non-array stamp', 'malformed'],
    ['a stamp whose version is not a number', ['1', 'agent:a:b', 'op-1']]
  ])('reports %s as an unreadable producer', ([, stamp]) => {
    const { doc, applyCollected } = setup({
      nodes: [sinkNode({ name: 'image', link: null })],
      links: []
    })
    doc.getMap('__stamps').set(JSON.stringify(['node', String(NODE_ID)]), stamp)

    applyCollected()

    const [, options] = onlyReport()
    expect(options).toMatchObject({
      context: { producer: { origin: 'unreadable' } }
    })
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
    function reslot(slot: Record<string, unknown>, title: string) {
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
      context: { valueShapes: 'inputs.0.type too_small array:0[]' }
    })
  })
})
