/**
 * ADR-CRDT-RECONCILE-0035 (a), round 7: a `doc_subscribed` acknowledgement
 * never settles a parked entry by itself — the wire carries no echoed
 * subscribe identity, so a duplicate ack is undecidable from a fresh one.
 * These tests exercise `createPendingCorrelation` directly (the lowest level
 * that owns the ack-handling decision) rather than through the real bridge or
 * the composable, per the "lowest proving level" testing principle.
 */
import type { Op, OpBase } from '@comfyorg/comfy-multi-player'
import { describe, expect, it, vi } from 'vitest'

import type { PendingOpTrackerEvent } from './pendingOpTracker'
import { createPendingOpTracker } from './pendingOpTracker'
import { createPendingCorrelation } from './pendingCorrelation'

const ACTOR = 'human:test-user:tab-1'

function envelope(opId: string): OpBase {
  return { op_id: opId, actor: ACTOR, base_version: 1, stamp: [1, ACTOR] }
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

/**
 * Wires a real tracker to a real correlation with a controllable watermark
 * and per-op presence map, and parks one PRESENT and one ABSENT op so a test
 * can assert both outcomes from a single ack sequence.
 */
function setUp() {
  const events: PendingOpTrackerEvent[] = []
  const pendingOps = createPendingOpTracker({
    onEvent: (event) => events.push(event)
  })
  let watermark: number | null = null
  const presentOp = addNode('op-present', 1)
  const absentOp = addNode('op-absent', 2)
  const correlation = createPendingCorrelation({
    pendingOps,
    getWatermark: () => watermark,
    setWatermark: (seq) => {
      watermark = seq
    },
    reconcileFromDoc: () => true,
    effectPresent: (op) => op.op_id === presentOp.op_id
  })
  correlation.adopt('wf-1')
  correlation.onProjected({ seq: 1 })
  for (const op of [presentOp, absentOp]) {
    pendingOps.onBatchMinted([op])
    pendingOps.onBatchTransmitted([op])
    pendingOps.onBatchSettled({ state: 'unacknowledged', ops: [op] })
  }
  expect(pendingOps.entries().map((entry) => entry.state)).toEqual([
    'delivery_unknown',
    'delivery_unknown'
  ])
  return { correlation, pendingOps, events, presentOp, absentOp }
}

describe('createPendingCorrelation — round 7: an ack never settles a parked entry by itself', () => {
  it.for([
    {
      name: 'subscribe1, ack1, dup ack1',
      acks: [1, 1]
    },
    {
      name: 'subscribe1, subscribe2, ack1, dup ack1, ack2',
      acks: [1, 1, 1]
    }
  ])(
    '$name leaves the absent entry parked and settles the present one exactly once',
    ({ acks }) => {
      const { correlation, pendingOps, events, presentOp, absentOp } = setUp()
      const resume = vi.fn()

      for (const seq of acks) {
        correlation.resolveIfAlreadyCurrent(
          { workflowId: 'wf-1', seq, isReactivation: false },
          resume
        )
      }

      expect(resume).toHaveBeenCalledTimes(acks.length)
      // The absent entry is never reverted by any of these acks — it stays
      // parked no matter how many times an "already current" ack repeats.
      expect(pendingOps.entries()).toEqual([
        { opId: absentOp.op_id, state: 'delivery_unknown', shadow: absentOp }
      ])
      expect(events.filter((event) => event.type === 'reverted')).toEqual([])
      // The present entry settles exactly once, however many acks answer it.
      expect(
        events.filter(
          (event) =>
            event.type === 'cleared' && event.opIds.includes(presentOp.op_id)
        )
      ).toHaveLength(1)
    }
  )
})
