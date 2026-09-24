import type { Op, OpBase } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import type { BatchOutcome } from './opSender'
import type { PendingOpTrackerEvent } from './pendingOpTracker'
import {
  LEDGER_SETTLE_TIMEOUT_MS,
  createPendingOpTracker
} from './pendingOpTracker'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const ACTOR = 'human:test-user:tab-1'

function envelope(opId: string): OpBase {
  return { op_id: opId, actor: ACTOR, base_version: 41, stamp: [41, ACTOR] }
}

function addNode(opId: string, nodeId: number): Op {
  return {
    ...envelope(opId),
    op: 'add_node',
    node_id: nodeId,
    class_type: 'TestNode',
    pos: [0, 0],
    node: { id: nodeId, type: 'TestNode' }
  }
}

function deleteNode(opId: string, nodeId: number): Op {
  return {
    ...envelope(opId),
    op: 'delete_node',
    node_id: nodeId,
    removed_links: []
  }
}

function connect(opId: string, linkId: number): Op {
  return {
    ...envelope(opId),
    op: 'connect',
    link_id: linkId,
    from_node: 1,
    from_slot: 0,
    to_node: 2,
    to_slot: 0,
    link_type: 'IMAGE'
  }
}

function setWidget(opId: string, nodeId: number): Op {
  return {
    ...envelope(opId),
    op: 'set_widget',
    node_id: nodeId,
    widget: 'seed',
    value: 42
  }
}

function clearOp(opId: string): Op {
  return { ...envelope(opId), op: 'clear', removed_nodes: [] }
}

function unacknowledged(ops: Op[]): BatchOutcome {
  return { state: 'unacknowledged', ops }
}

function acknowledged(
  ops: Op[],
  result: Extract<BatchOutcome, { state: 'acknowledged' }>['result']
): BatchOutcome {
  return { state: 'acknowledged', ops, result }
}

describe('createPendingOpTracker', () => {
  let events: PendingOpTrackerEvent[]
  let tracker: ReturnType<typeof createPendingOpTracker>
  let ops: Op[]

  beforeEach(() => {
    events = []
    tracker = createPendingOpTracker({ onEvent: (event) => events.push(event) })
    ops = [addNode('op-1', 1), addNode('op-2', 2), addNode('op-3', 3)]
  })

  it('registers minted ops before anything is sent', () => {
    tracker.onBatchMinted(ops)

    expect(tracker.entries().map((entry) => entry.state)).toEqual([
      'queued',
      'queued',
      'queued'
    ])
  })

  it('marks transmitted ops in flight and counts each attempt', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    expect(tracker.entries().every((entry) => entry.state === 'inflight')).toBe(
      true
    )

    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled(
      acknowledged(ops, {
        ok: true,
        applied: ['op-1', 'op-2', 'op-3'],
        skipped: []
      })
    )
    expect(tracker.entries().every((entry) => entry.state === 'applied')).toBe(
      true
    )
  })

  it('keeps an applied entry until its document effect arrives', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled(
      acknowledged(ops, {
        ok: true,
        applied: ['op-1', 'op-2', 'op-3'],
        skipped: []
      })
    )

    expect(events).toEqual([])

    tracker.onDocEffect(['op-2'])
    expect(tracker.entries().map((entry) => entry.opId)).toEqual([
      'op-1',
      'op-3'
    ])
    expect(events).toEqual([{ type: 'cleared', opIds: ['op-2'] }])

    tracker.onDocEffect(['someone-else'])
    expect(events).toHaveLength(1)
  })

  it('a skipped op whose effect frame does arrive still clears on that effect', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled(
      acknowledged(ops, {
        ok: true,
        applied: ['op-1', 'op-3'],
        skipped: ['op-2'],
        seq: 50
      })
    )
    expect(tracker.entries().find((e) => e.opId === 'op-2')?.state).toBe(
      'skipped'
    )
    tracker.onDocEffect(['op-1', 'op-2', 'op-3'])
    expect(tracker.entries()).toEqual([])
    tracker.onAuthoritativeState(50)
    expect(events.map((e) => e.type)).toEqual(['skipped_awaiting', 'cleared'])
  })

  describe('s3-opt-2: skipped duplicates resolve on a covering projection, never on the ack', () => {
    it('clears immediately when the projected seq already covers the ack seq', () => {
      tracker = createPendingOpTracker({
        currentSeq: () => 42,
        onEvent: (event) => events.push(event)
      })
      tracker.onBatchMinted(ops)
      tracker.onBatchTransmitted(ops)
      tracker.onBatchSettled(
        acknowledged(ops, {
          ok: true,
          applied: [],
          skipped: ['op-1', 'op-2', 'op-3'],
          seq: 42
        })
      )
      expect(tracker.entries()).toEqual([])
      expect(events).toEqual([
        { type: 'skipped_cleared', seq: 42, opIds: ['op-1', 'op-2', 'op-3'] }
      ])
    })

    it('waits for a covering projection transition, never clearing on the ack', () => {
      tracker.onBatchMinted(ops)
      tracker.onBatchTransmitted(ops)
      tracker.onBatchSettled(
        acknowledged(ops, {
          ok: true,
          applied: ['op-1'],
          skipped: ['op-2', 'op-3'],
          seq: 45
        })
      )
      expect(tracker.entries()).toHaveLength(3)
      expect(events).toEqual([
        { type: 'skipped_awaiting', seq: 45, opIds: ['op-2', 'op-3'] }
      ])

      tracker.onAuthoritativeState(44)
      expect(tracker.entries()).toHaveLength(3)
      expect(events).toHaveLength(1)

      tracker.onAuthoritativeState(45)
      expect(tracker.entries().map((e) => e.opId)).toEqual(['op-1'])
      expect(events[1]).toEqual({
        type: 'skipped_cleared',
        seq: 45,
        opIds: ['op-2', 'op-3']
      })
    })

    it('treats a seq-less ack as satisfied by any later authoritative transition', () => {
      tracker.onBatchMinted(ops)
      tracker.onBatchTransmitted(ops)
      tracker.onBatchSettled(
        acknowledged(ops, { ok: true, applied: [], skipped: ['op-1'] })
      )
      expect(events).toEqual([
        { type: 'skipped_awaiting', seq: null, opIds: ['op-1'] }
      ])
      tracker.onAuthoritativeState(null)
      expect(tracker.entries().map((e) => e.opId)).toEqual(['op-2', 'op-3'])
      expect(events[1]).toEqual({
        type: 'skipped_cleared',
        seq: null,
        opIds: ['op-1']
      })
    })

    it('does not let a seq-less transition satisfy a numbered requirement', () => {
      tracker.onBatchMinted(ops)
      tracker.onBatchTransmitted(ops)
      tracker.onBatchSettled(
        acknowledged(ops, {
          ok: true,
          applied: [],
          skipped: ['op-1'],
          seq: 45
        })
      )
      tracker.onAuthoritativeState(null)
      expect(tracker.entries().find((e) => e.opId === 'op-1')?.state).toBe(
        'skipped'
      )
      tracker.onAuthoritativeState(46)
      expect(tracker.entries().find((e) => e.opId === 'op-1')).toBeUndefined()
    })

    it('a redelivered ack cannot double-resolve or re-park an already cleared id', () => {
      tracker.onBatchMinted(ops)
      tracker.onBatchTransmitted(ops)
      const ack = acknowledged(ops, {
        ok: true,
        applied: [],
        skipped: ['op-1', 'op-2', 'op-3'],
        seq: 45
      })
      tracker.onBatchSettled(ack)
      tracker.onAuthoritativeState(45)
      expect(tracker.entries()).toEqual([])
      const seen = events.length

      tracker.onBatchSettled(ack)
      tracker.onAuthoritativeState(46)
      expect(tracker.entries()).toEqual([])
      expect(events).toHaveLength(seen)
    })

    it('reset drops awaiting bookkeeping so a stale ack cannot clear after doc_reset', () => {
      tracker.onBatchMinted(ops)
      tracker.onBatchTransmitted(ops)
      tracker.onBatchSettled(
        acknowledged(ops, {
          ok: true,
          applied: [],
          skipped: ['op-1'],
          seq: 45
        })
      )
      tracker.reset()
      const seen = events.length
      tracker.onAuthoritativeState(45)
      expect(events).toHaveLength(seen)
    })
  })

  it('reverts the failed op and everything the host never reached; keeps the applied prefix', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled(
      acknowledged(ops, {
        ok: false,
        applied: ['op-1'],
        skipped: [],
        failure: { op_id: 'op-2' }
      })
    )

    expect(tracker.entries().map((entry) => [entry.opId, entry.state])).toEqual(
      [['op-1', 'applied']]
    )
    expect(events).toEqual([
      {
        type: 'reverted',
        reason: 'failed',
        opIds: ['op-2'],
        ops: [ops[1]]
      },
      {
        type: 'reverted',
        reason: 'unprocessed',
        opIds: ['op-3'],
        ops: [ops[2]]
      }
    ])
  })

  it('reverts a mixed-kind unprocessed sweep as one event carrying every op', () => {
    const mixed = [
      setWidget('op-1', 9),
      addNode('op-2', 1),
      connect('op-3', 41)
    ]
    tracker.onBatchMinted(mixed)
    tracker.onBatchTransmitted(mixed)
    tracker.onBatchSettled(
      acknowledged(mixed, {
        ok: false,
        applied: [],
        skipped: [],
        failure: { op_id: 'op-1' }
      })
    )

    expect(tracker.entries()).toEqual([])
    expect(events).toEqual([
      {
        type: 'reverted',
        reason: 'failed',
        opIds: ['op-1'],
        ops: [mixed[0]]
      },
      // A single sweep reverts BOTH the unreached add_node and the unreached
      // connect together, in one event carrying both ops: a consumer
      // (pendingOpRevert.ts) derives "could this undo an add" from `ops`
      // itself, so the mixed kinds cannot mask the add's removal.
      {
        type: 'reverted',
        reason: 'unprocessed',
        opIds: ['op-2', 'op-3'],
        ops: [mixed[1], mixed[2]]
      }
    ])
  })

  it('an anonymous ok:false names nothing, so the whole in-flight batch is reverted and reported', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled(
      acknowledged(ops, { ok: false, applied: [], skipped: [] })
    )

    expect(tracker.entries()).toEqual([])
    expect(events).toEqual([
      {
        type: 'reverted',
        reason: 'unattributed',
        opIds: ['op-1', 'op-2', 'op-3'],
        ops
      }
    ])
    // ADR-CRDT-RECONCILE-0035 (a): every host rejection is reported, even an
    // anonymous batch-level one with no per-op failure detail to draw a code
    // from — `unattributed` stands in for it.
    expect(vi.mocked(reportError).mock.calls).toEqual(
      ops.map((op) => [
        new Error('Agent host rejected a human operation'),
        {
          errorType: 'agent_crdt_human_op_rejected',
          context: {
            opId: op.op_id,
            opKind: op.op,
            nodeId: 'node_id' in op ? String(op.node_id) : undefined,
            failureCode: 'unattributed'
          }
        }
      ])
    )
  })

  it('reverts an undeliverable batch even though it never flew (no doc bound)', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchSettled({ state: 'undeliverable', ops })

    expect(tracker.entries()).toEqual([])
    expect(events).toEqual([
      {
        type: 'reverted',
        reason: 'undeliverable',
        opIds: ['op-1', 'op-2', 'op-3'],
        ops
      }
    ])
  })

  it('retains an unacknowledged batch until an authoritative effect arrives', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled({ state: 'unacknowledged', ops })

    expect(tracker.entries()).toHaveLength(3)
    expect(events).toEqual([
      { type: 'delivery_unknown', opIds: ['op-1', 'op-2', 'op-3'] }
    ])

    tracker.onDocEffect(['op-1', 'op-2', 'op-3'])
    expect(tracker.entries()).toEqual([])
  })

  it('reports only still-tracked ops as delivery unknown after a partial effect', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onDocEffect(['op-1'])
    tracker.onBatchSettled({ state: 'unacknowledged', ops })

    expect(events).toEqual([
      { type: 'cleared', opIds: ['op-1'] },
      { type: 'delivery_unknown', opIds: ['op-2', 'op-3'] }
    ])
  })

  it('keeps an unconfirmed transmitted batch pending because the host may have applied it', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)

    tracker.onBatchSettled({ state: 'unconfirmed', ops })

    expect(tracker.entries()).toHaveLength(3)
    expect(events).toEqual([
      {
        type: 'delivery_unknown',
        opIds: ['op-1', 'op-2', 'op-3']
      }
    ])
  })

  it('emits no delivery-unknown event when effects already settled the batch', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onDocEffect(['op-1', 'op-2', 'op-3'])
    tracker.onBatchSettled({ state: 'unacknowledged', ops })

    expect(events).toEqual([
      { type: 'cleared', opIds: ['op-1', 'op-2', 'op-3'] }
    ])
  })

  it('reconciles a rejected suffix reported after delivery became unknown', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled({ state: 'unacknowledged', ops })

    tracker.onBatchSettled(
      acknowledged(ops, {
        ok: false,
        applied: ['op-1'],
        skipped: [],
        failure: { op_id: 'op-2' }
      })
    )

    expect(tracker.entries().map((entry) => [entry.opId, entry.state])).toEqual(
      [['op-1', 'applied']]
    )
    expect(events.slice(1)).toEqual([
      {
        type: 'reverted',
        reason: 'failed',
        opIds: ['op-2'],
        ops: [ops[1]]
      },
      {
        type: 'reverted',
        reason: 'unprocessed',
        opIds: ['op-3'],
        ops: [ops[2]]
      }
    ])
  })

  describe('ADR-CRDT-RECONCILE-0035 (a): every host rejection is reported', () => {
    it('reports a host-rejected op via reportError, with only bounded fields', () => {
      tracker.onBatchMinted(ops)
      tracker.onBatchTransmitted(ops)
      tracker.onBatchSettled(
        acknowledged(ops, {
          ok: false,
          applied: ['op-1'],
          skipped: [],
          failure: { op_id: 'op-2', code: 'refused', message: 'nope' }
        })
      )

      expect(reportError).toHaveBeenCalledTimes(1)
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        errorType: 'agent_crdt_human_op_rejected',
        context: {
          opId: 'op-2',
          opKind: 'add_node',
          nodeId: '2',
          failureCode: 'refused'
        }
      })
    })

    it('does not report a batch the host never rejected', () => {
      tracker.onBatchMinted(ops)
      tracker.onBatchTransmitted(ops)
      tracker.onBatchSettled(
        acknowledged(ops, {
          ok: true,
          applied: ops.map((op) => op.op_id),
          skipped: []
        })
      )

      expect(reportError).not.toHaveBeenCalled()
    })

    it('reports every rejected op id even when the failure code and op kind repeat', () => {
      const first = [addNode('op-1', 1)]
      tracker.onBatchMinted(first)
      tracker.onBatchTransmitted(first)
      tracker.onBatchSettled(
        acknowledged(first, {
          ok: false,
          applied: [],
          skipped: [],
          failure: { op_id: 'op-1', code: 'refused', message: 'nope' }
        })
      )

      const second = [addNode('op-2', 2)]
      tracker.onBatchMinted(second)
      tracker.onBatchTransmitted(second)
      tracker.onBatchSettled(
        acknowledged(second, {
          ok: false,
          applied: [],
          skipped: [],
          failure: { op_id: 'op-2', code: 'refused', message: 'different' }
        })
      )

      expect(reportError).toHaveBeenCalledTimes(2)
      expect(reportError).toHaveBeenNthCalledWith(1, expect.any(Error), {
        errorType: 'agent_crdt_human_op_rejected',
        context: {
          opId: 'op-1',
          opKind: 'add_node',
          nodeId: '1',
          failureCode: 'refused'
        }
      })
      expect(reportError).toHaveBeenNthCalledWith(2, expect.any(Error), {
        errorType: 'agent_crdt_human_op_rejected',
        context: {
          opId: 'op-2',
          opKind: 'add_node',
          nodeId: '2',
          failureCode: 'refused'
        }
      })
    })

    it('reports again for a different failure code or a different op kind', () => {
      const rejectedAddNode = [addNode('op-1', 1)]
      tracker.onBatchMinted(rejectedAddNode)
      tracker.onBatchTransmitted(rejectedAddNode)
      tracker.onBatchSettled(
        acknowledged(rejectedAddNode, {
          ok: false,
          applied: [],
          skipped: [],
          failure: { op_id: 'op-1', code: 'refused' }
        })
      )

      const rejectedOtherCode = [addNode('op-2', 2)]
      tracker.onBatchMinted(rejectedOtherCode)
      tracker.onBatchTransmitted(rejectedOtherCode)
      tracker.onBatchSettled(
        acknowledged(rejectedOtherCode, {
          ok: false,
          applied: [],
          skipped: [],
          failure: { op_id: 'op-2', code: 'conflict' }
        })
      )

      const rejectedOtherKind = [deleteNode('op-3', 3)]
      tracker.onBatchMinted(rejectedOtherKind)
      tracker.onBatchTransmitted(rejectedOtherKind)
      tracker.onBatchSettled(
        acknowledged(rejectedOtherKind, {
          ok: false,
          applied: [],
          skipped: [],
          failure: { op_id: 'op-3', code: 'refused' }
        })
      )

      expect(reportError).toHaveBeenCalledTimes(3)
    })
  })

  describe('ADR-CRDT-RECONCILE-0035 (a): delivery-unknown parking and catch-up resolution', () => {
    it('parks a non-clear op as delivery_unknown, distinct from inflight', () => {
      const op = addNode('op-1', 1)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      expect(tracker.entries()).toEqual([
        { opId: 'op-1', state: 'delivery_unknown', shadow: op }
      ])
    })

    it('never parks a clear op: it stays inflight, exactly as before', () => {
      const op = clearOp('op-1')
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      expect(tracker.entries()).toEqual([
        { opId: 'op-1', state: 'inflight', shadow: op }
      ])

      tracker.resolveDeliveryUnknown(() => {
        throw new Error('must not be consulted for a clear op')
      })
      expect(tracker.entries()).toEqual([
        { opId: 'op-1', state: 'inflight', shadow: op }
      ])
    })

    it('clears a parked add_node whose node id reached the doc', () => {
      const op = addNode('op-1', 1)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      tracker.resolveDeliveryUnknown(() => true)

      expect(tracker.entries()).toEqual([])
      expect(events.at(-1)).toEqual({ type: 'cleared', opIds: ['op-1'] })
    })

    it('leaves a parked add_node whose node id never reached the doc parked, never reverted', () => {
      // ADR-CRDT-RECONCILE-0035 (a), round 8 (DrJKL, review 5298630064):
      // absence never reverts, for any kind — only an explicit host
      // rejection, a lineage break, or destruction moves it out of
      // `delivery_unknown` again.
      const op = addNode('op-1', 1)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      tracker.resolveDeliveryUnknown(() => false)

      expect(tracker.entries()).toEqual([
        { opId: 'op-1', state: 'delivery_unknown', shadow: op }
      ])
      expect(events.some((event) => event.type === 'reverted')).toBe(false)
    })

    it('leaves a parked delete_node the doc still shows parked, since absence — not presence — is its success condition', () => {
      // The caller's `effectPresent` already negates its own doc lookup for
      // `delete_node` (present === "the node is gone"), so `false` here
      // means the delete never took (yet) — round 8: that is not a revert.
      const op = deleteNode('op-1', 1)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      tracker.resolveDeliveryUnknown(() => false)
      expect(tracker.entries()).toEqual([
        { opId: 'op-1', state: 'delivery_unknown', shadow: op }
      ])
      expect(events.some((event) => event.type === 'reverted')).toBe(false)
    })

    it('clears a parked delete_node once the doc shows it gone', () => {
      const op = deleteNode('op-1', 1)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      tracker.resolveDeliveryUnknown(() => true)
      expect(tracker.entries()).toEqual([])
      expect(events.at(-1)).toEqual({ type: 'cleared', opIds: ['op-1'] })
    })

    it('clears a parked connect whose link id reached the doc', () => {
      const op = connect('op-1', 41)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      tracker.resolveDeliveryUnknown(() => true)
      expect(tracker.entries()).toEqual([])
    })

    it('clears a parked set_widget whose target value matches the op', () => {
      const op = setWidget('op-1', 1)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      tracker.resolveDeliveryUnknown(() => true)

      expect(tracker.entries()).toEqual([])
      expect(events.at(-1)).toEqual({ type: 'cleared', opIds: ['op-1'] })
    })

    it('leaves a parked set_widget whose target value differs parked, never clearing unconditionally', () => {
      // ADR-CRDT-RECONCILE-0035 (a): last-writer-wins does not make an
      // arbitrary document value proof that THIS op landed, so set_widget is
      // checked like every other kind now — and round 8: a mismatch never
      // reverts either, it just stays parked.
      const op = setWidget('op-1', 1)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      tracker.resolveDeliveryUnknown(() => false)

      expect(tracker.entries()).toEqual([
        { opId: 'op-1', state: 'delivery_unknown', shadow: op }
      ])
    })

    it('leaves an unresolvable check (null) parked for the next catch-up', () => {
      const op = addNode('op-1', 1)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      tracker.resolveDeliveryUnknown(() => null)
      expect(tracker.entries()).toEqual([
        { opId: 'op-1', state: 'delivery_unknown', shadow: op }
      ])
    })

    it('a late doc_ops_result still reconciles a parked entry normally', () => {
      const op = addNode('op-1', 1)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      tracker.onBatchSettled(
        acknowledged([op], { ok: true, applied: ['op-1'], skipped: [] })
      )

      expect(tracker.entries()).toEqual([
        { opId: 'op-1', state: 'applied', shadow: op }
      ])

      // Resolution must not fight the real result: nothing left to park.
      tracker.resolveDeliveryUnknown(() => false)
      expect(tracker.entries()).toEqual([
        { opId: 'op-1', state: 'applied', shadow: op }
      ])
    })
  })

  describe('ADR-CRDT-RECONCILE-0035 (a), round 8: bounded ledger terminal path is non-destructive', () => {
    function parkAddNode(opId: string, nodeId: number): Op {
      const op = addNode(opId, nodeId)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))
      return op
    }

    it('notifies unresolved once the deadline elapses, without reverting or dropping the entry', () => {
      const op = parkAddNode('op-1', 1)

      vi.advanceTimersByTime(LEDGER_SETTLE_TIMEOUT_MS)

      expect(events.at(-1)).toEqual({ type: 'unresolved', opIds: ['op-1'] })
      expect(events.some((event) => event.type === 'reverted')).toBe(false)
      // Still held, still delivery_unknown: a late echo or explicit
      // rejection can still resolve it.
      expect(tracker.entries()).toEqual([
        { opId: 'op-1', state: 'delivery_unknown', shadow: op }
      ])
    })

    it('a same-lineage frame within the bound does not extend or shorten the deadline', () => {
      parkAddNode('op-1', 1)

      vi.advanceTimersByTime(LEDGER_SETTLE_TIMEOUT_MS - 1)
      // A same-lineage frame runs, still finds it absent, and stays parked —
      // round 8: this must not push the deadline further out.
      tracker.resolveDeliveryUnknown(() => false)
      vi.advanceTimersByTime(1)

      expect(events.at(-1)).toEqual({ type: 'unresolved', opIds: ['op-1'] })
    })

    it('a doc_reset since parking routes to the existing lineage-break handling, never the unresolved notification', () => {
      parkAddNode('op-1', 1)

      tracker.reset()
      vi.advanceTimersByTime(LEDGER_SETTLE_TIMEOUT_MS)

      expect(events.some((event) => event.type === 'unresolved')).toBe(false)
    })

    it('an explicit host rejection after the deadline has already fired still reverts normally', () => {
      const op = parkAddNode('op-1', 1)
      vi.advanceTimersByTime(LEDGER_SETTLE_TIMEOUT_MS)
      expect(events.at(-1)?.type).toBe('unresolved')

      tracker.onBatchSettled(
        acknowledged([op], {
          ok: false,
          applied: [],
          skipped: [],
          failure: { op_id: 'op-1', code: 'rejected' }
        })
      )

      expect(events.at(-1)).toEqual({
        type: 'reverted',
        reason: 'failed',
        opIds: ['op-1'],
        ops: [op]
      })
      expect(tracker.entries()).toEqual([])
    })
  })

  describe('ADR-CRDT-RECONCILE-0035 (a), round 8: destruction abandons still-parked entries', () => {
    it('destroy() drops every parked entry as abandoned (no revert, no toast) and drops everything else silently', () => {
      const parkedOp = addNode('op-1', 1)
      tracker.onBatchMinted([parkedOp])
      tracker.onBatchTransmitted([parkedOp])
      tracker.onBatchTransmitted([parkedOp])
      tracker.onBatchSettled(unacknowledged([parkedOp]))
      tracker.onBatchMinted([addNode('op-2', 2)])

      tracker.destroy()

      expect(events).toContainEqual({ type: 'abandoned', opIds: ['op-1'] })
      expect(events).toContainEqual({ type: 'reset', opIds: ['op-2'] })
      expect(events.some((event) => event.type === 'reverted')).toBe(false)
      expect(tracker.entries()).toEqual([])
    })

    it('destroy() cancels a parked entry deadline so it never fires afterward', () => {
      const op = addNode('op-1', 1)
      tracker.onBatchMinted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchTransmitted([op])
      tracker.onBatchSettled(unacknowledged([op]))

      tracker.destroy()
      events.length = 0
      vi.advanceTimersByTime(LEDGER_SETTLE_TIMEOUT_MS * 2)

      expect(events).toEqual([])
    })
  })

  it('isolates event listener failures', () => {
    const failure = new Error('listener failed')
    tracker = createPendingOpTracker({
      onEvent: () => {
        throw failure
      }
    })
    tracker.onBatchMinted(ops)

    expect(() => tracker.reset()).not.toThrow()
    expect(reportError).toHaveBeenCalledWith(failure, {
      errorType: 'agent_crdt_pending_op_event_listener_failed'
    })
  })

  it('reset drops every entry when the document lineage breaks', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted([ops[0]])
    tracker.reset()

    expect(tracker.entries()).toEqual([])
    expect(events).toEqual([{ type: 'reset', opIds: ['op-1', 'op-2', 'op-3'] }])
    tracker.reset()
    expect(events).toHaveLength(1)
  })

  describe('pendingAddType: an indexed, state-gated echo check (F1/F10)', () => {
    it('is undefined before any add_node is minted for that node id', () => {
      expect(tracker.pendingAddType('1')).toBeUndefined()
    })

    it('is undefined while the add_node is only queued, never sent (not host-visible)', () => {
      tracker.onBatchMinted([ops[0]])
      expect(tracker.pendingAddType('1')).toBeUndefined()
    })

    it('reports the class_type once the add_node is inflight', () => {
      tracker.onBatchMinted([ops[0]])
      tracker.onBatchTransmitted([ops[0]])
      expect(tracker.pendingAddType('1')).toBe('TestNode')
    })

    it('reports the class_type while applied, awaiting its doc_update effect', () => {
      tracker.onBatchMinted([ops[0]])
      tracker.onBatchTransmitted([ops[0]])
      tracker.onBatchSettled(
        acknowledged([ops[0]], { ok: true, applied: ['op-1'], skipped: [] })
      )
      expect(tracker.pendingAddType('1')).toBe('TestNode')
    })

    it('reports the class_type while parked as delivery_unknown', () => {
      tracker.onBatchMinted([ops[0]])
      tracker.onBatchTransmitted([ops[0]])
      tracker.onBatchTransmitted([ops[0]])
      tracker.onBatchSettled(unacknowledged([ops[0]]))
      expect(tracker.pendingAddType('1')).toBe('TestNode')
    })

    it('is undefined for a batch member the host never reached (not host-visible)', () => {
      tracker.onBatchMinted(ops)
      tracker.onBatchTransmitted(ops)
      tracker.onBatchSettled(
        acknowledged(ops, {
          ok: false,
          applied: [],
          skipped: [],
          failure: { op_id: 'op-1' }
        })
      )
      expect(tracker.pendingAddType('2')).toBeUndefined()
    })

    it('is undefined once the entry clears on its doc effect', () => {
      tracker.onBatchMinted([ops[0]])
      tracker.onBatchTransmitted([ops[0]])
      tracker.onDocEffect(['op-1'])
      expect(tracker.pendingAddType('1')).toBeUndefined()
    })

    it('is undefined once the entry reverts', () => {
      tracker.onBatchMinted([ops[0]])
      tracker.onBatchSettled({ state: 'undeliverable', ops: [ops[0]] })
      expect(tracker.pendingAddType('1')).toBeUndefined()
    })

    it('retains an older pending add_node for the same node id when a second one settles first', () => {
      const opA = addNode('op-1', 1)
      const opB = addNode('op-2', 1)
      tracker.onBatchMinted([opA])
      tracker.onBatchTransmitted([opA])
      tracker.onBatchMinted([opB])
      tracker.onBatchTransmitted([opB])

      tracker.onBatchSettled({ state: 'undeliverable', ops: [opB] })

      expect(tracker.pendingAddNodeIds()).toEqual(new Set(['1']))
      expect(tracker.pendingAddType('1')).toBe('TestNode')
      expect(tracker.entries().map((entry) => entry.opId)).toEqual(['op-1'])
    })

    it('retains an older pending connect for the same link id when a second one settles first', () => {
      const connectA = connect('op-a', 1)
      const connectB = connect('op-b', 1)
      tracker.onBatchMinted([connectA])
      tracker.onBatchTransmitted([connectA])
      tracker.onBatchMinted([connectB])
      tracker.onBatchTransmitted([connectB])

      tracker.onBatchSettled({ state: 'undeliverable', ops: [connectB] })

      expect(tracker.pendingConnectLinkIds()).toEqual(new Set(['1']))
      expect(tracker.entries().map((entry) => entry.opId)).toEqual(['op-a'])
    })

    it('pendingDeleteNodeIds is the single source: it holds a delete_node through queued, in-flight, and acknowledged-applied, and drops it once its effect clears', () => {
      const del = deleteNode('op-d', 9)
      tracker.onBatchMinted([del])
      expect(tracker.pendingDeleteNodeIds()).toEqual(new Set(['9']))

      tracker.onBatchTransmitted([del])
      expect(tracker.pendingDeleteNodeIds()).toEqual(new Set(['9']))

      // Acknowledged and applied: KEEP-ALIVE #9 keeps the entry — and this
      // node id — until the doc's own effect frame proves it landed.
      tracker.onBatchSettled(
        acknowledged([del], { ok: true, applied: ['op-d'], skipped: [] })
      )
      expect(tracker.pendingDeleteNodeIds()).toEqual(new Set(['9']))

      tracker.onDocEffect(['op-d'])
      expect(tracker.pendingDeleteNodeIds()).toEqual(new Set())
    })

    it('retains an older pending delete_node for the same node id when a second one settles first', () => {
      const deleteA = deleteNode('op-a', 9)
      const deleteB = deleteNode('op-b', 9)
      tracker.onBatchMinted([deleteA])
      tracker.onBatchTransmitted([deleteA])
      tracker.onBatchMinted([deleteB])
      tracker.onBatchTransmitted([deleteB])

      tracker.onBatchSettled({ state: 'undeliverable', ops: [deleteB] })

      expect(tracker.pendingDeleteNodeIds()).toEqual(new Set(['9']))
      expect(tracker.entries().map((entry) => entry.opId)).toEqual(['op-a'])
    })
  })

  it('settles a queued batch member that never transmitted, instead of leaking it as pending forever', () => {
    const [opA, opB] = ops
    tracker.onBatchMinted([opA, opB])
    tracker.onBatchTransmitted([opA])
    tracker.onBatchSettled(unacknowledged([opA, opB]))

    expect(events).toEqual([
      { type: 'delivery_unknown', opIds: ['op-1'] },
      {
        type: 'reverted',
        reason: 'undeliverable',
        opIds: ['op-2'],
        ops: [opB]
      }
    ])
    expect(tracker.entries().map((entry) => entry.opId)).toEqual(['op-1'])
  })
})
