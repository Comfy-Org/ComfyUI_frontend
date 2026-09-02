import type { Op, OpBase } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it } from 'vitest'

import type { BatchOutcome } from './opSender'
import type { PendingOpTrackerEvent } from './pendingOpTracker'
import { createPendingOpTracker, shadowTargetsFor } from './pendingOpTracker'

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

describe('shadowTargetsFor', () => {
  it('maps each wire op to the canvas entities it paints while pending', () => {
    expect(shadowTargetsFor(addNode('a', 7))).toEqual([
      { kind: 'node', nodeId: '7' }
    ])
    expect(
      shadowTargetsFor({
        ...envelope('b'),
        op: 'delete_node',
        node_id: '3',
        removed_links: [10, 11]
      })
    ).toEqual([
      { kind: 'node', nodeId: '3' },
      { kind: 'link', linkId: '10' },
      { kind: 'link', linkId: '11' }
    ])
    expect(
      shadowTargetsFor({
        ...envelope('c'),
        op: 'connect',
        link_id: 5,
        from_node: 1,
        from_slot: 0,
        to_node: 2,
        to_slot: 0,
        link_type: 'IMAGE'
      })
    ).toEqual([{ kind: 'link', linkId: '5' }])
    expect(
      shadowTargetsFor({
        ...envelope('d'),
        op: 'set_widget',
        node_id: 4,
        widget: 'seed',
        value: 1
      })
    ).toEqual([{ kind: 'widget', nodeId: '4', widgetName: 'seed' }])
    expect(
      shadowTargetsFor({
        ...envelope('e'),
        op: 'clear',
        removed_nodes: [8, '9']
      })
    ).toEqual([
      { kind: 'node', nodeId: '8' },
      { kind: 'node', nodeId: '9' }
    ])
  })
})

describe('createPendingOpTracker', () => {
  let events: PendingOpTrackerEvent[]
  let tracker: ReturnType<typeof createPendingOpTracker>
  let ops: Op[]

  beforeEach(() => {
    events = []
    tracker = createPendingOpTracker({ onEvent: (event) => events.push(event) })
    ops = [addNode('op-1', 1), addNode('op-2', 2), addNode('op-3', 3)]
  })

  it('registers minted ops as queued shadows before anything is sent', () => {
    tracker.onBatchMinted(ops)

    expect(tracker.entries().map((entry) => entry.state)).toEqual([
      'queued',
      'queued',
      'queued'
    ])
    expect(tracker.shadow.isPending({ kind: 'node', nodeId: '2' })).toBe(true)
    expect(tracker.shadow.size()).toBe(3)
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

  it('KEEP-ALIVE #9: an applied ack keeps the shadow; the doc_update effect clears it', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled(
      acknowledged(ops, {
        ok: true,
        applied: ['op-1', 'op-2', 'op-3'],
        skipped: []
      })
    )

    expect(tracker.shadow.size()).toBe(3)
    expect(events).toEqual([])

    tracker.onDocEffect(['op-2'])
    expect(tracker.shadow.isPending({ kind: 'node', nodeId: '2' })).toBe(false)
    expect(tracker.shadow.size()).toBe(2)
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
    expect(tracker.shadow.size()).toBe(0)
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
      expect(tracker.shadow.size()).toBe(0)
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
      expect(tracker.shadow.size()).toBe(3)
      expect(events).toEqual([
        { type: 'skipped_awaiting', seq: 45, opIds: ['op-2', 'op-3'] }
      ])

      // A projection below the ack seq proves nothing about the duplicate.
      tracker.onAuthoritativeState(44)
      expect(tracker.shadow.size()).toBe(3)
      expect(events).toHaveLength(1)

      tracker.onAuthoritativeState(45)
      expect(tracker.shadow.isPending({ kind: 'node', nodeId: '2' })).toBe(
        false
      )
      expect(tracker.shadow.isPending({ kind: 'node', nodeId: '3' })).toBe(
        false
      )
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
      expect(tracker.shadow.size()).toBe(0)
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
    expect(tracker.shadow.isPending({ kind: 'node', nodeId: '1' })).toBe(true)
    expect(tracker.shadow.isPending({ kind: 'node', nodeId: '2' })).toBe(false)
    expect(tracker.shadow.isPending({ kind: 'node', nodeId: '3' })).toBe(false)
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
    expect(tracker.shadow.size()).toBe(0)
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
    expect(tracker.shadow.size()).toBe(0)
    expect(events).toEqual([
      {
        type: 'reverted',
        reason: 'undeliverable',
        opIds: ['op-1', 'op-2', 'op-3']
      }
    ])
  })

  it('reverts an unacknowledged batch after the sender gives up on silence', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled({ state: 'unacknowledged', ops })

    expect(tracker.entries()).toEqual([])
    expect(tracker.shadow.size()).toBe(0)
    expect(events[0]).toMatchObject({
      type: 'reverted',
      reason: 'unacknowledged'
    })
  })

  it('reset drops every entry and shadow when the doc lineage breaks', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted([ops[0]])
    tracker.reset()

    expect(tracker.entries()).toEqual([])
    expect(tracker.shadow.size()).toBe(0)
    expect(events).toEqual([{ type: 'reset', opIds: ['op-1', 'op-2', 'op-3'] }])
    // Idempotent: a second reset with nothing held is silent.
    tracker.reset()
    expect(events).toHaveLength(1)
  })
})
