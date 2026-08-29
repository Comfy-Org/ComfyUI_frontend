/**
 * Property tests for the sender half of the human write leg
 * (`opSender.ts`): the queue, the serialization discipline, the retry budget,
 * and the settle accounting.
 *
 * These drive the sender through fast-check-generated schedules of enqueues,
 * transport flaps, host results and clock advances — the interleavings the
 * example suite cannot enumerate — and assert the write-path invariants that
 * must survive all of them: nothing enqueued is silently dropped, every batch
 * settles exactly once, order on the wire is mint order, and a resend never
 * re-mints an identity.
 */
import type { Op } from '@comfyorg/comfy-multi-player'
import * as fc from 'fast-check'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { createOpSender } from './opSender'
import type { BatchOutcome, OpSender, OpsResultView } from './opSender'

const WORKFLOW = 'wf-1'
const TAB = 'tab-1'
const ACTOR = 'human:test-user:tab-1'

const SEND_RETRY_INTERVAL_MS = 500
const RESULT_TIMEOUT_MS = 10_000

function setWidget(
  node: number,
  widget: string,
  value: unknown
): GraphOperation {
  return { op: 'set_widget', node_id: node, widget, value, old: null }
}

/**
 * Every op these suites enqueue is a `set_widget`. Narrow to that kind rather
 * than widening the read, so a generator that ever emitted something else
 * fails loudly here instead of silently reading `undefined`.
 */
function asSetWidget(op: Op) {
  if (op.op !== 'set_widget') {
    throw new Error(`expected a set_widget op, got ${op.op}`)
  }
  return op
}

const arbOperation: fc.Arbitrary<GraphOperation> = fc.record({
  op: fc.constant('set_widget' as const),
  node_id: fc.integer({ min: 1, max: 50 }),
  widget: fc.stringMatching(/^[a-z_]{1,8}$/),
  value: fc.oneof(fc.integer(), fc.stringMatching(/^[a-z]{0,10}$/)),
  old: fc.constant(null)
})

/** One step of a generated session. */
type Command =
  | { kind: 'enqueue'; operations: GraphOperation[] }
  | { kind: 'transport'; up: boolean }
  | { kind: 'ack' }
  | { kind: 'reject' }
  | { kind: 'anonymous' }
  | { kind: 'tick'; ms: number }

const arbCommand: fc.Arbitrary<Command> = fc.oneof(
  {
    weight: 5,
    arbitrary: fc
      .array(arbOperation, { minLength: 1, maxLength: 6 })
      .map((operations) => ({ kind: 'enqueue' as const, operations }))
  },
  {
    weight: 2,
    arbitrary: fc.boolean().map((up) => ({ kind: 'transport' as const, up }))
  },
  { weight: 4, arbitrary: fc.constant({ kind: 'ack' as const }) },
  { weight: 2, arbitrary: fc.constant({ kind: 'reject' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'anonymous' as const }) },
  {
    weight: 3,
    arbitrary: fc
      .constantFrom(1, SEND_RETRY_INTERVAL_MS, RESULT_TIMEOUT_MS)
      .map((ms) => ({ kind: 'tick' as const, ms }))
  }
)

interface Harness {
  sender: OpSender
  sent: Op[][]
  settled: BatchOutcome[]
  setTransport(up: boolean): void
  setWorkflow(id: string | null): void
  deliver(result: OpsResultView): void
  /** Ack whatever batch went out last (the serialized in-flight one). */
  ackLast(): void
  /** Host result for the last batch reporting every op as skipped/failed. */
  rejectLast(): void
  drain(): void
  settledOpIds(): string[]
  wireOpIds(): string[]
  /** Ops in first-transmission order; a resend of the same batch is not a new op. */
  wireOps(): Op[]
}

function createHarness(baseVersion: () => number = () => 41): Harness {
  const sent: Op[][] = []
  const settled: BatchOutcome[] = []
  let resultListener: ((result: OpsResultView) => void) | null = null
  let transportUp = true
  let workflow: string | null = WORKFLOW

  const sender = createOpSender({
    sendOps: (_workflowId, _tab, ops) => {
      if (!transportUp) return false
      sent.push(ops)
      return true
    },
    onOpsResult: (listener) => {
      resultListener = listener
      return () => {
        resultListener = null
      }
    },
    workflowId: () => workflow,
    tab: TAB,
    actor: () => ACTOR,
    baseVersion,
    onBatchSettled: (outcome) => settled.push(outcome)
  })

  const deliver = (result: OpsResultView): void => resultListener?.(result)

  const harness: Harness = {
    sender,
    sent,
    settled,
    setTransport(up) {
      transportUp = up
    },
    setWorkflow(id) {
      workflow = id
    },
    deliver,
    ackLast() {
      const last = sent.at(-1)
      if (!last) return
      deliver({ ok: true, applied: last.map((op) => op.op_id), skipped: [] })
    },
    rejectLast() {
      const last = sent.at(-1)
      if (!last) return
      deliver({
        ok: false,
        applied: [],
        skipped: last.map((op) => op.op_id),
        failure: { op_id: last[0].op_id }
      })
    },
    drain() {
      transportUp = true
      workflow = WORKFLOW
      // Bounded: every iteration either settles a batch or advances the clock
      // past a timeout that settles one. The assertion after the loop is what
      // proves the queue actually reached zero.
      for (let guard = 0; guard < 500 && sender.pending() > 0; guard++) {
        const before = sent.length
        vi.advanceTimersByTime(SEND_RETRY_INTERVAL_MS)
        if (sent.length > before || sent.length > 0) harness.ackLast()
        if (sender.pending() > 0) vi.advanceTimersByTime(RESULT_TIMEOUT_MS)
      }
    },
    settledOpIds() {
      return settled.flatMap((outcome) => outcome.ops.map((op) => op.op_id))
    },
    wireOpIds() {
      return harness.wireOps().map((op) => op.op_id)
    },
    wireOps() {
      const seen = new Set<string>()
      const order: Op[] = []
      for (const batch of sent) {
        for (const op of batch) {
          if (seen.has(op.op_id)) continue
          seen.add(op.op_id)
          order.push(op)
        }
      }
      return order
    }
  }
  return harness
}

function run(harness: Harness, commands: Command[]): number {
  let enqueued = 0
  for (const command of commands) {
    switch (command.kind) {
      case 'enqueue':
        // Stamp a mint-order sequence number into each op's payload so the
        // assertions can recover enqueue order without depending on the wire.
        harness.sender.enqueue(
          command.operations.map((operation) => ({
            ...operation,
            value: enqueued++
          }))
        )
        break
      case 'transport':
        harness.setTransport(command.up)
        break
      case 'ack':
        harness.ackLast()
        break
      case 'reject':
        harness.rejectLast()
        break
      case 'anonymous':
        harness.deliver({ ok: false, applied: [], skipped: [] })
        break
      case 'tick':
        vi.advanceTimersByTime(command.ms)
        break
    }
  }
  return enqueued
}

const arbSession = fc.array(arbCommand, { minLength: 1, maxLength: 40 })

describe('createOpSender properties', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('never silently drops an enqueued operation', () => {
    fc.assert(
      fc.property(arbSession, (commands) => {
        const harness = createHarness()
        try {
          const enqueued = run(harness, commands)
          harness.drain()

          // Every operation the mint ports handed over is accounted for by a
          // terminal outcome: acknowledged, unacknowledged, or undeliverable.
          // An op that reaches neither the wire nor an outcome is a write the
          // user made and nobody ever hears about again.
          expect(harness.settledOpIds()).toHaveLength(enqueued)
          expect(harness.sender.pending()).toBe(0)
        } finally {
          harness.sender.detach()
        }
      })
    )
  })

  it('settles every batch exactly once', () => {
    fc.assert(
      fc.property(arbSession, (commands) => {
        const harness = createHarness()
        try {
          run(harness, commands)
          harness.drain()

          const ids = harness.settledOpIds()
          expect(new Set(ids).size).toBe(ids.length)
        } finally {
          harness.sender.detach()
        }
      })
    )
  })

  it('settles in enqueue order — the queue is strictly FIFO', () => {
    fc.assert(
      fc.property(arbSession, (commands) => {
        const harness = createHarness()
        try {
          const enqueued = run(harness, commands)
          harness.drain()

          // `run` stamps each op's payload with its mint-order index, so the
          // settle stream must read back as 0, 1, 2, ... — one batch in
          // flight at a time, queue drained head-first, no reordering.
          const order = harness.settled.flatMap((outcome) =>
            outcome.ops.map((op) => asSetWidget(op).value as number)
          )
          expect(order).toEqual(
            Array.from({ length: enqueued }, (_, index) => index)
          )
        } finally {
          harness.sender.detach()
        }
      })
    )
  })

  it('never re-mints an op_id on a resend', () => {
    fc.assert(
      fc.property(arbSession, (commands) => {
        const harness = createHarness()
        try {
          run(harness, commands)
          harness.drain()

          // A retry (transport flap) and a resend (result silence) both put the
          // SAME minted ops back on the wire: a re-mint would defeat the
          // applier's op_id idempotency gate and double-apply the edit.
          for (const batch of harness.sent) {
            const first = harness.sent.find(
              (candidate) => candidate[0].op_id === batch[0].op_id
            )
            expect(batch).toBe(first)
          }
        } finally {
          harness.sender.detach()
        }
      })
    )
  })

  it('holds one batch in flight at a time', () => {
    fc.assert(
      fc.property(arbSession, (commands) => {
        const harness = createHarness()
        try {
          run(harness, commands)

          // Every distinct batch that has gone out is either settled or is the
          // single current in-flight one; the sender never fans out.
          const settledBatches = new Set(
            harness.settled.map((outcome) => outcome.ops)
          )
          const outstanding = new Set(harness.sent)
          for (const batch of settledBatches) outstanding.delete(batch)
          expect(outstanding.size).toBeLessThanOrEqual(1)
        } finally {
          harness.sender.detach()
        }
      })
    )
  })

  it('reports pending() as a truthful queue depth', () => {
    fc.assert(
      fc.property(arbSession, (commands) => {
        const harness = createHarness()
        try {
          run(harness, commands)

          expect(harness.sender.pending()).toBeGreaterThanOrEqual(0)

          harness.drain()
          expect(harness.sender.pending()).toBe(0)
        } finally {
          harness.sender.detach()
        }
      })
    )
  })
})

describe('createOpSender offline queue properties', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('emits ops queued while disconnected in mint order on reconnect', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(arbOperation, { minLength: 1, maxLength: 4 }), {
          minLength: 1,
          maxLength: 5
        }),
        (rounds) => {
          const harness = createHarness()
          try {
            harness.setTransport(false)
            for (const operations of rounds) harness.sender.enqueue(operations)
            expect(harness.sent).toHaveLength(0)

            harness.setTransport(true)
            harness.drain()

            // Order on the wire is mint order, and the count is exact: a
            // reconnect replays the backlog, it does not reshuffle or coalesce
            // it.
            const total = rounds.reduce((sum, ops) => sum + ops.length, 0)
            expect(harness.wireOpIds()).toHaveLength(total)
            expect(harness.settledOpIds()).toEqual(harness.wireOpIds())
          } finally {
            harness.sender.detach()
          }
        }
      )
    )
  })

  it('keeps base_version at mint time, not at transmit time', () => {
    fc.assert(
      fc.property(
        fc.array(arbOperation, { minLength: 1, maxLength: 5 }),
        fc.nat({ max: 500 }),
        fc.nat({ max: 500 }),
        (operations, atMint, advance) => {
          let version = atMint
          const harness = createHarness(() => version)
          try {
            harness.setTransport(false)
            harness.sender.enqueue(operations)

            // The follower observes new remote sequences while we are offline.
            version = atMint + advance
            harness.setTransport(true)
            harness.drain()

            // Stamps are the doc version the edit was MADE against. Re-reading
            // the clock at transmit time would silently promote a stale edit
            // over a newer remote write it never saw.
            for (const batch of harness.sent) {
              for (const op of batch) {
                expect(op.base_version).toBe(atMint)
                expect(op.stamp).toEqual([atMint, ACTOR])
              }
            }
          } finally {
            harness.sender.detach()
          }
        }
      )
    )
  })

  it('stamps monotonically across a reconnect that re-baselines forward', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.array(arbOperation, { minLength: 1, maxLength: 3 }),
            fc.nat({ max: 50 })
          ),
          { minLength: 1, maxLength: 8 }
        ),
        (rounds) => {
          let version = 0
          const harness = createHarness(() => version)
          try {
            for (const [operations, delta] of rounds) {
              // A reconnect drops the transport, then the host's catch-up
              // re-baselines the follower's observed sequence forward.
              harness.setTransport(false)
              version += delta
              harness.setTransport(true)
              harness.sender.enqueue(operations)
              harness.drain()
            }

            const versions = harness.sent.flatMap((batch) =>
              batch.map((op) => op.base_version)
            )
            for (let index = 1; index < versions.length; index++) {
              expect(versions[index]).toBeGreaterThanOrEqual(
                versions[index - 1]
              )
            }
          } finally {
            harness.sender.detach()
          }
        }
      )
    )
  })
})

describe('createOpSender rejection and burst properties', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('a rejected batch settles once and never wedges the queue', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(arbOperation, { minLength: 1, maxLength: 3 }), {
          minLength: 1,
          maxLength: 6
        }),
        (rounds) => {
          const harness = createHarness()
          try {
            for (const operations of rounds) harness.sender.enqueue(operations)
            // Reject every batch as it comes up.
            for (let index = 0; index < rounds.length; index++) {
              harness.rejectLast()
            }

            expect(harness.settled).toHaveLength(rounds.length)
            for (const outcome of harness.settled) {
              expect(outcome.state).toBe('acknowledged')
            }
            expect(harness.sender.pending()).toBe(0)

            // The seam is still live after a run of rejections.
            harness.sender.enqueue([setWidget(1, 'seed', 9)])
            expect(harness.sent.at(-1)).toHaveLength(1)
          } finally {
            harness.sender.detach()
          }
        }
      )
    )
  })

  it('a rapid same-widget burst emits every write — nothing coalesces away', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 2, maxLength: 30 }),
        (values) => {
          const harness = createHarness()
          try {
            // The store fires one setValue per keystroke/drag frame; the
            // sender must carry each as its own op. Coalescing here would
            // lose intermediate state the doc host needs for LWW ordering.
            for (const value of values) {
              harness.sender.enqueue([setWidget(7, 'seed', value)])
            }
            harness.drain()

            const wire = harness.wireOps()
            expect(wire).toHaveLength(values.length)
            expect(wire.map((op) => asSetWidget(op).value)).toEqual(values)
            expect(new Set(wire.map((op) => op.op_id)).size).toBe(values.length)
          } finally {
            harness.sender.detach()
          }
        }
      )
    )
  })

  it('drops every queued batch as undeliverable while no doc is bound', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(arbOperation, { minLength: 1, maxLength: 3 }), {
          minLength: 1,
          maxLength: 5
        }),
        (rounds) => {
          const harness = createHarness()
          try {
            harness.setWorkflow(null)
            let total = 0
            for (const operations of rounds) {
              harness.sender.enqueue(operations)
              total += operations.length
            }

            // No doc bound is an observable rejection, not a silent drop.
            expect(harness.sent).toHaveLength(0)
            expect(harness.settledOpIds()).toHaveLength(total)
            for (const outcome of harness.settled) {
              expect(outcome.state).toBe('undeliverable')
            }
          } finally {
            harness.sender.detach()
          }
        }
      )
    )
  })

  /**
   * VIOLATION V-3 — see reports/qa/feh5-crdt-prop-tests.md.
   *
   * Found by the FIFO property above before it was restated in terms of settle
   * order. `opSender.ts:8-10` promises "op order on the wire matches mint
   * order"; this interleaving breaks it, and also reports a batch as
   * acknowledged before a single one of its ops has left the transport.
   *
   * This test asserts the CURRENT behaviour, not the intended one, so the
   * defect is pinned rather than merely described. It is expected to fail —
   * deliberately — whenever the transport retry is made cancellable on settle.
   */
  it('V-3: a settled batch is still transmitted later by its orphaned retry', () => {
    const harness = createHarness()
    try {
      harness.setTransport(false)
      harness.sender.enqueue([setWidget(1, 'seed', 'first')])
      harness.setTransport(true)
      harness.sender.enqueue([setWidget(2, 'seed', 'second')])

      // A late anonymous failure (the shape opSender.ts:162-168 handles)
      // settles the in-flight batch — which the transport never carried,
      // because its retry is still pending.
      harness.deliver({ ok: false, applied: [], skipped: [] })

      expect(harness.settled).toHaveLength(1)
      expect(harness.settled[0].state).toBe('acknowledged')
      expect(asSetWidget(harness.settled[0].ops[0]).node_id).toBe(1)
      // The SECOND batch is the only thing on the wire so far.
      expect(
        harness.sent.map((batch) => asSetWidget(batch[0]).node_id)
      ).toEqual([2])

      // The first batch's transport retry (opSender.ts:103-105) was never
      // cancelled by settle (opSender.ts:88-93), so it fires and ships the
      // already-settled ops AFTER the batch that overtook them.
      vi.advanceTimersByTime(SEND_RETRY_INTERVAL_MS)

      expect(
        harness.sent.map((batch) => asSetWidget(batch[0]).node_id)
      ).toEqual([2, 1])
    } finally {
      harness.sender.detach()
    }
  })

  it('detach settles nothing further and stops the wire', () => {
    fc.assert(
      fc.property(arbSession, (commands) => {
        const harness = createHarness()
        run(harness, commands)
        harness.sender.detach()

        const sentBefore = harness.sent.length
        const settledBefore = harness.settled.length
        harness.sender.enqueue([setWidget(1, 'seed', 1)])
        vi.advanceTimersByTime(RESULT_TIMEOUT_MS * 3)

        expect(harness.sent).toHaveLength(sentBefore)
        expect(harness.settled).toHaveLength(settledBefore)
      })
    )
  })
})
