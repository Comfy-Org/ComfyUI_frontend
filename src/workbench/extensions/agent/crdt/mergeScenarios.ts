/**
 * A merge laboratory: run an ordered op stream through the REAL applier and
 * report, per op, what the document decided and why.
 *
 * The point is that this is not a model of the merge rules — it IS the merge
 * rules. `applyOps` here is byte-for-byte the function the cloud doc host
 * runs, so a verdict shown in the panel is the verdict production would
 * produce for that arrival order. A simulator that merely *described* the
 * semantics would drift from them the first time the pin moved, and a tester
 * shown a drifted explanation is worse off than one shown nothing.
 *
 * Everything is local and synchronous: no socket, no backend, no shared doc.
 */
import {
  applyOps,
  hasAppliedOp,
  hasNode,
  mint,
  readGraph,
  readStamps,
  stampTargetKey
} from '@comfyorg/comfy-multi-player'
import type {
  ApplyOutcome,
  Op,
  StampKey,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type { MergeTraceEntry, MergeVerdict } from './mergeTrace'
import { opNodeId, traceEntry } from './mergeTrace'
import type { GraphOperation } from './graphOperations'
import { mintWireOps } from './opEnvelope'

export interface MergeScenario {
  id: string
  title: string
  /** What a tester is meant to learn from running it. */
  question: string
  workflow: WorkflowJSON
  catalog: WidgetCatalog
  /**
   * Ops grouped into the batches the host would receive, in arrival order.
   *
   * Batching is explicit because it is load-bearing, not incidental: the
   * applier aborts the remainder of a BATCH on a rejection, so a scenario
   * about abort-remainder is only honest if its ops actually share one.
   * `opSender` chunks real traffic the same way.
   */
  batches: Op[][]
}

export interface MergeSimulation {
  entries: MergeTraceEntry[]
  /** Node ids surviving in the document after the whole stream. */
  survivingNodeIds: string[]
  /** Widget values that survived, keyed `nodeId.widget`. */
  survivingWidgets: Record<string, unknown>
}

function stampKeyOf(value: unknown): StampKey | null {
  if (!Array.isArray(value) || value.length < 3) return null
  const [baseVersion, actor, opId] = value
  if (
    typeof baseVersion !== 'number' ||
    typeof actor !== 'string' ||
    typeof opId !== 'string'
  ) {
    return null
  }
  return [baseVersion, actor, opId]
}

/**
 * Turn the applier's outcome into a verdict that says WHY.
 *
 * `applyOps` reports a bare `no-op` both for a resend it has already seen and
 * for a write to a node someone deleted. The two are distinguishable only
 * from the document as it stood BEFORE the op, which is why this is probed
 * per op rather than reconstructed afterwards.
 */
function verdictFor(
  outcome: ApplyOutcome,
  wasDuplicate: boolean,
  nodePresentAfter: boolean | null,
  incumbentStamp: StampKey | null
): MergeVerdict {
  switch (outcome.outcome) {
    case 'applied':
      return { kind: 'applied' }
    case 'lww-dropped':
      return { kind: 'lww-dropped', incumbent: incumbentStamp }
    case 'rejected':
      return outcome.reason.code === 'batch_aborted'
        ? { kind: 'not-reached', code: outcome.reason.code }
        : {
            kind: 'rejected',
            code: outcome.reason.code,
            message: outcome.reason.message
          }
    case 'no-op':
      if (wasDuplicate) return { kind: 'no-op', because: 'duplicate-op-id' }
      if (nodePresentAfter === false)
        return { kind: 'no-op', because: 'delete-wins' }
      return { kind: 'no-op', because: 'unknown' }
  }
}

/**
 * `mint` clones the workflow with `structuredClone`, which throws on a
 * Proxy — and a caller holding the scenario in Vue reactive state hands one
 * over without ever knowing. Round-tripping through JSON is the cheapest way
 * to guarantee the plain data the applier's contract assumes.
 */
function asPlainJson(workflow: WorkflowJSON): WorkflowJSON {
  return JSON.parse(JSON.stringify(workflow)) as WorkflowJSON
}

/**
 * Replay `batches` against a fresh document minted from `workflow`.
 *
 * Duplicate detection, node presence and register ownership are sampled at
 * each op's position. The real batch still determines the final outcome; a
 * prefix replay on a clone captures the stamp visible when that op settled.
 */
function simulateOpStream(
  workflow: WorkflowJSON,
  catalog: WidgetCatalog,
  batches: readonly Op[][]
): MergeSimulation {
  const doc = mint(asPlainJson(workflow), catalog)
  const entries: MergeTraceEntry[] = []
  let index = 0

  for (const batch of batches) {
    const nodeIds = batch.map(opNodeId)
    // Both facts must be evaluated at the op's OWN position in the batch, not
    // at the batch boundary: a resend and the op it repeats can share a batch,
    // and so can a delete and the write it defeats.
    const spentOpIds = new Set(
      batch.filter((op) => hasAppliedOp(doc, op.op_id)).map((op) => op.op_id)
    )
    const present = new Map<string, boolean>()
    for (const id of nodeIds) {
      if (id !== null && !present.has(id)) present.set(id, hasNode(doc, id))
    }

    const beforeBatch = Y.encodeStateAsUpdate(doc)
    const result = applyOps(doc, batch, catalog)
    const stampsByPosition = batch.map((_, position) => {
      const prefixDoc = new Y.Doc()
      Y.applyUpdate(prefixDoc, beforeBatch)
      applyOps(prefixDoc, batch.slice(0, position + 1), catalog)
      return readStamps(prefixDoc)
    })

    batch.forEach((op, position) => {
      const outcome = result.outcomes.at(position)
      const nodeId = nodeIds[position]
      const verdict: MergeVerdict = outcome
        ? verdictFor(
            outcome,
            spentOpIds.has(op.op_id),
            nodeId === null ? null : (present.get(nodeId) ?? false),
            stampKeyOf(stampsByPosition[position][stampTargetKey(op)])
          )
        : { kind: 'no-op', because: 'unknown' }

      spentOpIds.add(op.op_id)
      if (nodeId !== null && outcome?.outcome === 'applied') {
        if (op.op === 'add_node') present.set(nodeId, true)
        else if (op.op === 'delete_node') present.set(nodeId, false)
      }

      entries.push(traceEntry(op, index, verdict))
      index++
    })
  }

  const graph = readGraph(doc)
  const survivingWidgets: Record<string, unknown> = {}
  for (const [id, node] of Object.entries(graph.nodes)) {
    const widgets = node.widgets
    if (typeof widgets !== 'object' || widgets === null) continue
    for (const [name, value] of Object.entries(widgets)) {
      survivingWidgets[`${id}.${name}`] = value
    }
  }

  return {
    entries,
    survivingNodeIds: Object.keys(graph.nodes),
    survivingWidgets
  }
}

export function runScenario(scenario: MergeScenario): MergeSimulation {
  return simulateOpStream(scenario.workflow, scenario.catalog, scenario.batches)
}

/** Each op arrives in its own batch — the ordinary frame-by-frame case. */
function separately(...ops: Op[]): Op[][] {
  return ops.map((op) => [op])
}

// ── canned scenarios ──────────────────────────────────────────────────────

const CATALOG: WidgetCatalog = {
  types: {
    CLIPTextEncode: { widget_order: ['text'] },
    KSampler: { widget_order: ['seed', 'steps'] }
  }
}

const SEED_WORKFLOW: WorkflowJSON = {
  nodes: [
    {
      id: 'A',
      type: 'CLIPTextEncode',
      pos: [0, 0],
      widgets_values: ['a cat'],
      inputs: [],
      outputs: []
    },
    {
      id: 'B',
      type: 'KSampler',
      pos: [200, 0],
      widgets_values: [1, 20],
      inputs: [],
      outputs: []
    }
  ],
  links: []
}

/**
 * Mint one scenario op through the SAME envelope code the real write leg
 * uses, so a scenario cannot accidentally demonstrate stamp semantics the
 * production sender would never produce.
 */
function op(body: GraphOperation, actor: string, baseVersion: number): Op {
  const [minted] = mintWireOps([body], { actor, baseVersion })
  return minted
}

const ALICE = 'human:alice:tab1'
const BOB = 'human:bob:tab2'

function addNodeA(actor: string, baseVersion: number): Op {
  return op(
    {
      op: 'add_node',
      node_id: 'A',
      class_type: 'CLIPTextEncode',
      pos: [0, 0],
      node: {
        id: 'A',
        type: 'CLIPTextEncode',
        pos: [0, 0],
        widgets_values: ['a dog']
      }
    },
    actor,
    baseVersion
  )
}

/**
 * The scenarios a tester runs to build intuition. Each is a question, not a
 * demo: the title says what is contested and the `question` says what the
 * outcome is supposed to teach.
 */
let mergeScenarios: readonly MergeScenario[] | undefined

export function getMergeScenarios(): readonly MergeScenario[] {
  return (mergeScenarios ??= [
    {
      id: 'delete-then-write-then-add',
      title: 'delete A → set widget on A → add A',
      question:
        'Does an edit made while a node is deleted survive if the node comes back?',
      workflow: SEED_WORKFLOW,
      catalog: CATALOG,
      batches: separately(
        op({ op: 'delete_node', node_id: 'A', removed_links: [] }, ALICE, 1),
        op(
          { op: 'set_widget', node_id: 'A', widget: 'text', value: 'a bird' },
          BOB,
          1
        ),
        addNodeA(BOB, 2)
      )
    },
    {
      id: 'write-then-delete-then-write',
      title: 'set widget → delete A → set widget again',
      question:
        'Where exactly does the delete cut the timeline for a node\u2019s values?',
      workflow: SEED_WORKFLOW,
      catalog: CATALOG,
      batches: separately(
        op(
          { op: 'set_widget', node_id: 'A', widget: 'text', value: 'first' },
          ALICE,
          1
        ),
        op({ op: 'delete_node', node_id: 'A', removed_links: [] }, BOB, 2),
        op(
          { op: 'set_widget', node_id: 'A', widget: 'text', value: 'second' },
          ALICE,
          3
        )
      )
    },
    {
      id: 'concurrent-widget-writes',
      title: 'two people set the same widget concurrently',
      question:
        'Both were minted against the same document version, and the one that arrives SECOND loses. What decided it?',
      workflow: SEED_WORKFLOW,
      catalog: CATALOG,
      batches: separately(
        op(
          { op: 'set_widget', node_id: 'B', widget: 'seed', value: 222 },
          BOB,
          4
        ),
        op(
          { op: 'set_widget', node_id: 'B', widget: 'seed', value: 111 },
          ALICE,
          4
        )
      )
    },
    {
      id: 'stale-write-loses',
      title: 'a stale write arrives after a newer one',
      question:
        'Does arrival order or stamp order decide a widget register contest?',
      workflow: SEED_WORKFLOW,
      catalog: CATALOG,
      batches: separately(
        op(
          { op: 'set_widget', node_id: 'B', widget: 'steps', value: 50 },
          ALICE,
          9
        ),
        op(
          { op: 'set_widget', node_id: 'B', widget: 'steps', value: 4 },
          BOB,
          2
        )
      )
    },
    {
      id: 'idempotent-resend',
      title: 'the same op is sent twice',
      question:
        'Is a retry safe, and how is it distinguishable from a conflict?',
      workflow: SEED_WORKFLOW,
      catalog: CATALOG,
      batches: (() => {
        const once = op(
          { op: 'set_widget', node_id: 'B', widget: 'seed', value: 7 },
          ALICE,
          1
        )
        return separately(once, once)
      })()
    },
    {
      id: 'batch-abort',
      title: 'a rejected op in the middle of ONE batch',
      question:
        'All three ship together. What happens to the ops queued behind the rejection?',
      workflow: SEED_WORKFLOW,
      catalog: CATALOG,
      batches: [
        [
          op(
            { op: 'set_widget', node_id: 'B', widget: 'seed', value: 99 },
            ALICE,
            1
          ),
          op(
            {
              op: 'set_widget',
              node_id: 'B',
              widget: 'not_a_widget',
              value: 1
            },
            ALICE,
            2
          ),
          op(
            { op: 'set_widget', node_id: 'B', widget: 'steps', value: 3 },
            ALICE,
            3
          )
        ]
      ]
    }
  ])
}
