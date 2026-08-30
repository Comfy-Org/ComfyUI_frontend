/**
 * Behavioural pins for the s3-opt-6 dispatch boundary: enqueue-before-send,
 * identical-id retry after transport recovery, bounded exhaustion → revert,
 * teardown, and mixed-batch identity (order preservation for the s3-opt-2
 * result mapping).
 */
import { describe, expect, it } from 'vitest'

import type {
  DispatchResult,
  DispatchableOp,
  HumanOpDispatcher,
  RetrySummary,
  SentBatch,
  UnsentBatch
} from './humanOpDispatcher'
import { createHumanOpDispatcher } from './humanOpDispatcher'
import { createPendingOpLedger } from './pendingOpLedger'
import type { ShadowChange, ShadowTarget } from './pendingOpShadow'
import { createPendingOpShadowSurface } from './pendingOpShadow'

interface TestOp extends DispatchableOp {
  readonly op: string
  readonly node_id: number
}

const op = (opId: string, nodeId = 1): TestOp => ({
  op: 'add_node',
  op_id: opId,
  node_id: nodeId
})

const nodeTarget = (nodeId: number): ShadowTarget => ({
  kind: 'node',
  nodeId: String(nodeId)
})

/** Transport double: a scriptable send-boolean seam that records batches. */
function makeSendSeam(): {
  send: (ops: readonly TestOp[]) => boolean
  sentBatches: TestOp[][]
  open: { value: boolean }
} {
  const sentBatches: TestOp[][] = []
  const open = { value: true }
  return {
    send: (ops) => {
      if (!open.value) return false
      sentBatches.push([...ops])
      return true
    },
    sentBatches,
    open
  }
}

function makeDispatcher(options?: { maxSendAttempts?: number }): {
  dispatcher: HumanOpDispatcher<TestOp>
  ledger: ReturnType<typeof createPendingOpLedger<TestOp>>
  shadow: ReturnType<typeof createPendingOpShadowSurface>
  seam: ReturnType<typeof makeSendSeam>
  changes: ShadowChange[]
} {
  const ledger = createPendingOpLedger<TestOp>()
  const shadow = createPendingOpShadowSurface()
  const changes: ShadowChange[] = []
  shadow.subscribe((change) => changes.push(change))
  const seam = makeSendSeam()
  const dispatcher = createHumanOpDispatcher<TestOp>({
    ledger,
    shadow,
    send: seam.send,
    maxSendAttempts: options?.maxSendAttempts
  })
  return { dispatcher, ledger, shadow, seam, changes }
}

describe('humanOpDispatcher', () => {
  describe('dispatch with a live transport (send: true)', () => {
    it('enqueues and shadows BEFORE the send, then marks in flight', () => {
      const ledger = createPendingOpLedger<TestOp>()
      const shadow = createPendingOpShadowSurface()
      // Observe the ledger/shadow state at the exact moment of the send: the
      // enqueue-before-send ordering is the whole point of the boundary.
      const statesDuringSend: Array<{
        ledgerState: string | undefined
        shadowed: boolean
      }> = []
      const dispatcher = createHumanOpDispatcher<TestOp>({
        ledger,
        shadow,
        send: (ops) => {
          statesDuringSend.push({
            ledgerState: ledger.get(ops[0].op_id)?.state,
            shadowed: shadow.get(ops[0].op_id) !== undefined
          })
          return true
        }
      })

      const result: DispatchResult = dispatcher.dispatch(
        [op('a1')],
        new Map([['a1', [nodeTarget(1)]]])
      )

      expect(result).toEqual({ accepted: true, sent: true })
      expect(statesDuringSend).toEqual([
        { ledgerState: 'queued', shadowed: true }
      ])
      expect(ledger.get('a1')?.state).toBe('inflight')
      expect(shadow.isPending(nodeTarget(1))).toBe(true)
      const sent: readonly SentBatch[] = dispatcher.sentBatches()
      expect(sent).toEqual([{ opIds: ['a1'] }])
      expect(dispatcher.unsentBatches()).toEqual([])
    })

    it('preserves submitted batch order for the result mapping', () => {
      const { dispatcher, seam } = makeDispatcher()
      dispatcher.dispatch([op('a1', 1), op('a2', 2), op('a3', 3)])
      expect(seam.sentBatches).toEqual([
        [op('a1', 1), op('a2', 2), op('a3', 3)]
      ])
      expect(dispatcher.sentBatches()).toEqual([{ opIds: ['a1', 'a2', 'a3'] }])
    })

    it('rejects the whole batch on a duplicate op id, enqueuing nothing', () => {
      const { dispatcher, ledger, shadow, seam } = makeDispatcher()
      dispatcher.dispatch([op('a1')])

      const inBatch = dispatcher.dispatch([op('b1'), op('b1')])
      expect(inBatch).toEqual({
        accepted: false,
        reason: 'duplicate-op-id',
        opIds: ['b1']
      })
      const alreadyHeld = dispatcher.dispatch([op('b2'), op('a1')])
      expect(alreadyHeld).toEqual({
        accepted: false,
        reason: 'duplicate-op-id',
        opIds: ['a1']
      })

      expect(ledger.size()).toBe(1)
      expect(shadow.size()).toBe(1)
      expect(seam.sentBatches).toHaveLength(1)
    })

    it('rejects an empty batch without touching the transport', () => {
      const { dispatcher, seam } = makeDispatcher()
      expect(dispatcher.dispatch([])).toEqual({
        accepted: false,
        reason: 'empty-batch',
        opIds: []
      })
      expect(seam.sentBatches).toEqual([])
    })
  })

  describe('send: false → recovery retry with identical ids', () => {
    it('holds the batch queued and pending instead of dropping it', () => {
      const { dispatcher, ledger, shadow, seam } = makeDispatcher()
      seam.open.value = false

      const result = dispatcher.dispatch(
        [op('a1')],
        new Map([['a1', [nodeTarget(1)]]])
      )

      expect(result).toEqual({ accepted: true, sent: false })
      expect(ledger.get('a1')?.state).toBe('queued')
      expect(shadow.isPending(nodeTarget(1))).toBe(true)
      const unsent: readonly UnsentBatch[] = dispatcher.unsentBatches()
      expect(unsent).toEqual([{ opIds: ['a1'], attempts: 1 }])
      expect(dispatcher.sentBatches()).toEqual([])
    })

    it('resends the IDENTICAL op objects after transport recovery', () => {
      const { dispatcher, ledger, seam } = makeDispatcher()
      seam.open.value = false
      const original = op('a1')
      dispatcher.dispatch([original])

      seam.open.value = true
      const summary: RetrySummary = dispatcher.retryUnsent()

      expect(summary).toEqual({ resent: ['a1'], reverted: [], unsent: [] })
      // Same object, same id — never re-minted, so host-side duplicate
      // detection stays sound.
      expect(seam.sentBatches).toHaveLength(1)
      expect(seam.sentBatches[0][0]).toBe(original)
      expect(ledger.get('a1')?.state).toBe('inflight')
      expect(dispatcher.sentBatches()).toEqual([{ opIds: ['a1'] }])
      expect(dispatcher.unsentBatches()).toEqual([])
    })

    it('keeps earlier sent batches intact while a later batch waits', () => {
      const { dispatcher, seam } = makeDispatcher()
      dispatcher.dispatch([op('a1')])
      seam.open.value = false
      dispatcher.dispatch([op('b1')])
      seam.open.value = true
      const summary = dispatcher.retryUnsent()
      expect(summary.resent).toEqual(['b1'])
      expect(seam.sentBatches.map((batch) => batch[0].op_id)).toEqual([
        'a1',
        'b1'
      ])
    })
  })

  describe('bounded exhaustion → revert (never an immortal pending entry)', () => {
    it('reverts the batch after maxSendAttempts failures', () => {
      const { dispatcher, ledger, shadow, seam, changes } = makeDispatcher({
        maxSendAttempts: 3
      })
      seam.open.value = false
      dispatcher.dispatch([op('a1')], new Map([['a1', [nodeTarget(1)]]])) // attempt 1
      expect(dispatcher.retryUnsent().unsent).toEqual(['a1']) // attempt 2

      const final = dispatcher.retryUnsent() // attempt 3 → revert

      expect(final).toEqual({ resent: [], reverted: ['a1'], unsent: [] })
      expect(ledger.size()).toBe(0)
      expect(shadow.size()).toBe(0)
      expect(shadow.isPending(nodeTarget(1))).toBe(false)
      // The removal used the FAILURE verb, not the effect verb.
      expect(changes).toEqual([
        { type: 'show', opId: 'a1' },
        { type: 'revert', opId: 'a1' }
      ])
      expect(dispatcher.unsentBatches()).toEqual([])
      expect(dispatcher.sentBatches()).toEqual([])
    })

    it('stops a retry pass at the first still-failing batch (FIFO order, no attempt burn)', () => {
      const { dispatcher, seam } = makeDispatcher({ maxSendAttempts: 5 })
      seam.open.value = false
      dispatcher.dispatch([op('a1')]) // attempts: 1
      dispatcher.dispatch([op('b1')]) // queued behind, attempts: 0

      const summary = dispatcher.retryUnsent() // a1 fails again; b1 untouched

      expect(summary).toEqual({
        resent: [],
        reverted: [],
        unsent: ['a1', 'b1']
      })
      expect(dispatcher.unsentBatches()).toEqual([
        { opIds: ['a1'], attempts: 2 },
        { opIds: ['b1'], attempts: 0 }
      ])
    })
  })

  describe('mixed-batch identity', () => {
    it('queues a new dispatch behind unsent batches and drains in FIFO order', () => {
      const { dispatcher, seam } = makeDispatcher()
      seam.open.value = false
      dispatcher.dispatch([op('a1', 1), op('a2', 2)])
      // Transport recovered, but batch B must NOT jump ahead of batch A.
      seam.open.value = true
      const result = dispatcher.dispatch([op('b1', 3)])
      expect(result).toEqual({ accepted: true, sent: false })
      expect(seam.sentBatches).toEqual([])

      const summary = dispatcher.retryUnsent()

      expect(summary.resent).toEqual(['a1', 'a2', 'b1'])
      expect(
        seam.sentBatches.map((batch) => batch.map((o) => o.op_id))
      ).toEqual([['a1', 'a2'], ['b1']])
      expect(dispatcher.sentBatches()).toEqual([
        { opIds: ['a1', 'a2'] },
        { opIds: ['b1'] }
      ])
    })
  })

  describe('teardown (reset)', () => {
    it('drops batches, ledger entries, and shadows in one call', () => {
      const { dispatcher, ledger, shadow, seam, changes } = makeDispatcher()
      dispatcher.dispatch([op('a1', 1)], new Map([['a1', [nodeTarget(1)]]]))
      seam.open.value = false
      dispatcher.dispatch([op('b1', 2)], new Map([['b1', [nodeTarget(2)]]]))

      const dropped = dispatcher.reset()

      expect(dropped.sort()).toEqual(['a1', 'b1'])
      expect(ledger.size()).toBe(0)
      expect(shadow.size()).toBe(0)
      expect(dispatcher.sentBatches()).toEqual([])
      expect(dispatcher.unsentBatches()).toEqual([])
      expect(changes.at(-1)).toEqual({
        type: 'clear-all',
        opIds: ['a1', 'b1']
      })
      // A post-reset dispatch starts clean: the same id could even be reused
      // (nothing is held), and new batches send immediately.
      seam.open.value = true
      expect(dispatcher.dispatch([op('c1')])).toEqual({
        accepted: true,
        sent: true
      })
    })
  })
})
