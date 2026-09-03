/**
 * Conformance vectors against the PINNED package (plan 3.5): every assumption
 * the write leg builds on, asserted against the applier the doc host actually
 * runs. These were staged "once the compatible pin lands" - the 0.2.0 pin
 * exposes the outcome union, so they run now and re-assert automatically at
 * any future pin swap.
 *
 * Each vector names the leg behavior that depends on it. Applier facts the
 * probes established and these tests pin: a write to a MISSING node is a
 * protocol-level `no-op` (delete-wins), never a rejection; `reset_doc` is
 * rejected `op_deferred` (vocabulary §1.6); `readGraph` projects nodes as an
 * id-keyed record with NAME-KEYED widgets.
 */
import { describe, expect, it } from 'vitest'

import type {
  Op,
  SetWidgetOp,
  WidgetCatalog,
  WireOp,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'

import {
  applyOps,
  compareStampKeys,
  hasAppliedOp,
  mint,
  readGraph,
  stampKey
} from '@comfyorg/comfy-multi-player'

import type { GraphOperation } from './graphOperations'
import { mintOpId, mintWireOps } from './opEnvelope'

const CATALOG: WidgetCatalog = {
  types: {
    TestNode: { widget_order: ['seed'] },
    OtherNode: { widget_order: ['text'] }
  }
}

const SEED_WORKFLOW: WorkflowJSON = {
  nodes: [
    {
      id: 1,
      type: 'TestNode',
      pos: [0, 0],
      widgets_values: [3],
      inputs: [{ name: 'in', type: 'IMAGE', link: null }],
      outputs: []
    },
    {
      id: 2,
      type: 'OtherNode',
      pos: [9, 9],
      widgets_values: ['hi'],
      inputs: [],
      outputs: [{ name: 'out', type: 'IMAGE', links: [] }]
    }
  ],
  links: []
}

function seedDoc() {
  return mint(SEED_WORKFLOW, CATALOG)
}

function envelope(actor = 'human:u1:tab', baseVersion = 1) {
  return {
    op_id: mintOpId(),
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor] as [number, string]
  }
}

function setWidget(
  value: unknown,
  overrides: Partial<SetWidgetOp> = {}
): SetWidgetOp {
  return {
    ...envelope(),
    op: 'set_widget',
    node_id: 1,
    widget: 'seed',
    value,
    ...overrides
  } as SetWidgetOp
}

function addNode(id: number): Op {
  return {
    ...envelope(),
    op: 'add_node',
    node_id: id,
    class_type: 'OtherNode',
    pos: [10, 10],
    node: { id, type: 'OtherNode', pos: [10, 10], widgets_values: ['hi'] }
  }
}

/** A guaranteed-rejecting wire op: `reset_doc` is deferred (vocabulary §1.6). */
function deferredResetDoc(): WireOp {
  return {
    ...envelope(),
    op: 'reset_doc',
    workflow: { nodes: [], links: [] }
  }
}

type ProjectedNodes = Record<string, { widgets?: Record<string, unknown> }>

function nodesOf(doc: ReturnType<typeof seedDoc>): ProjectedNodes {
  return readGraph(doc).nodes as ProjectedNodes
}

function seedWidgetValue(doc: ReturnType<typeof seedDoc>): unknown {
  return nodesOf(doc)['1']?.widgets?.seed
}

describe('applier conformance (the pinned package the doc host runs)', () => {
  it('converges under both arrival orders (the follower can trail the sender)', () => {
    const opA = setWidget(10)
    const opB = addNode(7)

    const forward = seedDoc()
    applyOps(forward, [opA], CATALOG)
    applyOps(forward, [opB], CATALOG)

    const reversed = seedDoc()
    applyOps(reversed, [opB], CATALOG)
    applyOps(reversed, [opA], CATALOG)

    expect(readGraph(forward)).toEqual(readGraph(reversed))
  })

  it('treats a byte-identical op_id resend as a no-op (the sender retry contract)', () => {
    const doc = seedDoc()
    const op = setWidget(10)

    const first = applyOps(doc, [op], CATALOG)
    const second = applyOps(doc, [op], CATALOG)

    expect(first.outcomes).toEqual([{ op_id: op.op_id, outcome: 'applied' }])
    expect(second.outcomes).toEqual([{ op_id: op.op_id, outcome: 'no-op' }])
  })

  it('rejects changed-payload op_id reuse (why the sender never re-mints)', () => {
    const doc = seedDoc()
    const op = setWidget(10)
    applyOps(doc, [op], CATALOG)

    const tampered = { ...op, value: 999 } as SetWidgetOp
    const result = applyOps(doc, [tampered], CATALOG)

    expect(result.outcomes[0].outcome).toBe('rejected')
    expect(seedWidgetValue(doc)).toBe(10)
  })

  it('rejects the deferred reset_doc with doc state unchanged (vocabulary §1.6)', () => {
    const doc = seedDoc()
    const before = readGraph(doc)

    const result = applyOps(doc, [deferredResetDoc() as Op], CATALOG)

    expect(result.outcomes[0].outcome).toBe('rejected')
    expect(
      result.outcomes[0].outcome === 'rejected' &&
        result.outcomes[0].reason.code
    ).toBe('op_deferred')
    expect(readGraph(doc)).toEqual(before)
  })

  it.for([
    ['FIRST', 0],
    ['MIDDLE', 1],
    ['LAST', 2]
  ] as const)(
    'aborts the remainder with the valid prefix kept - failure at %s',
    ([_position, failingIndex]) => {
      const doc = seedDoc()
      const good = [addNode(7), addNode(8), addNode(9)]
      const bad = deferredResetDoc()
      const batch = [...good] as Op[]
      batch.splice(failingIndex, 0, bad as Op)

      const result = applyOps(doc, batch, CATALOG)

      // Every submitted op gets an outcome: the failure by its own code, the
      // unprocessed tail as `batch_aborted` - the code the sender's future
      // prefix-abort reconcile keys on to tell the tail from real rejections.
      expect(result.outcomes).toHaveLength(batch.length)
      expect(result.outcomes[failingIndex].outcome).toBe('rejected')
      for (let index = 0; index < failingIndex; index++) {
        expect(result.outcomes[index].outcome).toBe('applied')
        expect(hasAppliedOp(doc, batch[index].op_id)).toBe(true)
      }
      for (let index = failingIndex + 1; index < batch.length; index++) {
        const outcome = result.outcomes[index]
        expect(outcome.outcome === 'rejected' && outcome.reason.code).toBe(
          'batch_aborted'
        )
        expect(hasAppliedOp(doc, batch[index].op_id)).toBe(false)
      }

      // The sender's reconcile contract: resend the WHOLE batch minus the
      // fixed op with the SAME op_ids - the prefix converges via the op_id
      // gate, the tail applies exactly once.
      const resend = batch.filter((op) => op !== bad)
      const retried = applyOps(doc, resend, CATALOG)
      expect(retried.outcomes.map((outcome) => outcome.outcome)).toEqual([
        ...Array(failingIndex).fill('no-op'),
        ...Array(resend.length - failingIndex).fill('applied')
      ])
    }
  )

  it('drops the older stamp on a contested register and says so (lww-dropped)', () => {
    const doc = seedDoc()
    const newer = setWidget(20, {
      stamp: [5, 'human:u1:tab']
    } as Partial<SetWidgetOp>)
    const older = setWidget(10, {
      stamp: [2, 'human:u1:tab']
    } as Partial<SetWidgetOp>)

    applyOps(doc, [newer], CATALOG)
    const result = applyOps(doc, [older], CATALOG)

    expect(result.outcomes[0].outcome).toBe('lww-dropped')
    expect(seedWidgetValue(doc)).toBe(20)
  })

  it('orders by the stamp FIELD, exact ties broken by op_id (KA-2 offline order)', () => {
    const actor = 'human:u1:tab'
    const low = setWidget(1, { stamp: [3, actor] } as Partial<SetWidgetOp>)
    const high = setWidget(2, { stamp: [3, actor] } as Partial<SetWidgetOp>)

    const winner =
      compareStampKeys(stampKey(low), stampKey(high)) > 0 ? low : high
    const doc = seedDoc()
    applyOps(doc, [low], CATALOG)
    applyOps(doc, [high], CATALOG)

    expect(seedWidgetValue(doc)).toBe(winner.value)
  })

  it('treats a write to a deleted node as a protocol-level no-op (delete-wins)', () => {
    const doc = seedDoc()
    const del: Op = {
      ...envelope('human:u1:tab', 5),
      op: 'delete_node',
      node_id: 2,
      removed_links: []
    }
    applyOps(doc, [del], CATALOG)

    const lateWrite = {
      ...envelope('human:u2:tab', 2),
      op: 'set_widget',
      node_id: 2,
      widget: 'text',
      value: 'late'
    } as SetWidgetOp
    const result = applyOps(doc, [lateWrite], CATALOG)

    // Delete-wins is an apply, never an error: the sender must not treat it
    // as a failure, and the op_id is consumed (a retry stays idempotent).
    expect(result.outcomes[0].outcome).toBe('no-op')
    expect(nodesOf(doc)['2']).toBeUndefined()
    expect(hasAppliedOp(doc, lateWrite.op_id)).toBe(true)
  })

  it('accepts every op family the mint ports emit, end to end through our envelope', () => {
    const doc = seedDoc()
    const context = { actor: 'human:u1:tab', baseVersion: 1 }
    const legOps: GraphOperation[] = [
      {
        op: 'connect',
        link_id: 41,
        from_node: 2,
        from_slot: 0,
        to_node: 1,
        to_slot: 0,
        link_type: 'IMAGE'
      },
      { op: 'set_widget', node_id: 1, widget: 'seed', value: 42, old: 3 },
      { op: 'delete_node', node_id: 2, removed_links: [41] },
      {
        op: 'add_node',
        node_id: 7,
        class_type: 'OtherNode',
        pos: [5, 5],
        node: { id: 7, type: 'OtherNode', pos: [5, 5], widgets_values: ['x'] }
      }
    ]
    // The clear mints against a LATER observed seq, as the real leg would
    // (lastSeq advances on every doc_update): an equal-stamp clear can LOSE
    // the per-node register to a same-base add by op_id tiebreak - that is
    // LWW working, not a bug, and the leg avoids it by construction.
    const clearOps: GraphOperation[] = [{ op: 'clear', removed_nodes: [1, 7] }]

    const result = applyOps(doc, mintWireOps(legOps, context), CATALOG)
    const clearResult = applyOps(
      doc,
      mintWireOps(clearOps, { ...context, baseVersion: 2 }),
      CATALOG
    )

    expect(result.outcomes.map((outcome) => outcome.outcome)).toEqual([
      'applied',
      'applied',
      'applied',
      'applied'
    ])
    expect(clearResult.outcomes.map((outcome) => outcome.outcome)).toEqual([
      'applied'
    ])
    expect(nodesOf(doc)).toEqual({})
  })
})
