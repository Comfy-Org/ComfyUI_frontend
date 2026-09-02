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

  it('a skipped op is already in the doc: retained until its effect, like applied', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled(
      acknowledged(ops, {
        ok: true,
        applied: ['op-1', 'op-3'],
        skipped: ['op-2']
      })
    )
    expect(tracker.entries().find((e) => e.opId === 'op-2')?.state).toBe(
      'skipped'
    )
    tracker.onDocEffect(['op-1', 'op-2', 'op-3'])
    expect(tracker.entries()).toEqual([])
    expect(tracker.shadow.size()).toBe(0)
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
