import type { Op, OpBase } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import type { BatchOutcome } from './opSender'
import type { PendingOpTrackerEvent } from './pendingOpTracker'
import { createPendingOpTracker } from './pendingOpTracker'

vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))

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

    // A resend of the same ops stays in flight; the later result must name
    // the second attempt or the ledger ignores it.
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

    // Foreign ids in an update touch nothing.
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
    // Nothing left awaiting: a later projection has nothing to resolve.
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
      // All-skipped batch: no broadcast will ever carry these ids, yet the
      // projection is already at the ack seq, so nothing lingers.
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

      // A projection below the ack seq proves nothing about the duplicate.
      tracker.onAuthoritativeState(44)
      expect(tracker.entries()).toHaveLength(3)
      expect(events).toHaveLength(1)

      tracker.onAuthoritativeState(45)
      // The applied op still waits for its own effect (KEEP-ALIVE #9).
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
      { type: 'reverted', reason: 'failed', opIds: ['op-2'] },
      { type: 'reverted', reason: 'unprocessed', opIds: ['op-3'] }
    ])
  })

  it('an anonymous ok:false names nothing, so the whole in-flight batch is reverted', () => {
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
        opIds: ['op-1', 'op-2', 'op-3']
      }
    ])
  })

  it('reverts an undeliverable batch even though it never flew (no doc bound)', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchSettled({ state: 'undeliverable', ops })

    expect(tracker.entries()).toEqual([])
    expect(events).toEqual([
      {
        type: 'reverted',
        reason: 'undeliverable',
        opIds: ['op-1', 'op-2', 'op-3']
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
      { type: 'reverted', reason: 'failed', opIds: ['op-2'] },
      { type: 'reverted', reason: 'unprocessed', opIds: ['op-3'] }
    ])
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
    // Idempotent: a second reset with nothing held is silent.
    tracker.reset()
    expect(events).toHaveLength(1)
  })
})
