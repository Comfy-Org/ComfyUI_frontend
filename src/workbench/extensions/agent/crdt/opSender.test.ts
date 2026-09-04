import type { Op } from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { createOpSender, toOpsResultView } from './opSender'
import type { BatchOutcome, OpsResultView } from './opSender'

const WORKFLOW = 'wf-1'
const TAB = 'tab-1'
const ACTOR = 'human:test-user:tab-1'

function addNode(id: number): GraphOperation {
  return {
    op: 'add_node',
    node_id: id,
    class_type: 'TestNode',
    pos: [0, 0],
    node: { id, type: 'TestNode' }
  }
}

describe('createOpSender', () => {
  let sent: Array<{ workflowId: string; tab: string; ops: Op[] }>
  let settled: BatchOutcome[]
  let resultListener: ((result: OpsResultView) => void) | null
  let transportUp: boolean
  let boundWorkflow: string | null
  let sender: ReturnType<typeof createOpSender>

  function ackInFlight(): void {
    const last = sent[sent.length - 1]
    resultListener?.({
      ok: true,
      applied: last.ops.map((op) => op.op_id),
      skipped: []
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    sent = []
    settled = []
    resultListener = null
    transportUp = true
    boundWorkflow = WORKFLOW
    sender = createOpSender({
      sendOps: (workflowId, tab, ops) => {
        if (!transportUp) return false
        sent.push({ workflowId, tab, ops })
        return true
      },
      onOpsResult: (listener) => {
        resultListener = listener
        return () => {
          resultListener = null
        }
      },
      workflowId: () => boundWorkflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: (outcome) => settled.push(outcome)
    })
  })

  afterEach(() => {
    sender.detach()
  })

  it('mints once and sends a doc_ops batch with the wire envelope', () => {
    sender.enqueue([addNode(1), addNode(2)])

    expect(sent).toHaveLength(1)
    expect(sent[0].workflowId).toBe(WORKFLOW)
    expect(sent[0].tab).toBe(TAB)
    expect(sent[0].ops).toHaveLength(2)
    for (const op of sent[0].ops) {
      expect(op.op_id).toMatch(/^[0-9a-f]{32}$/)
      expect(op.actor).toBe(ACTOR)
      expect(op.base_version).toBe(41)
      expect(op.stamp).toEqual([41, ACTOR])
    }
  })

  it('serializes batches: the next sends only after the result settles the first', () => {
    sender.enqueue([addNode(1)])
    sender.enqueue([addNode(2)])
    expect(sent).toHaveLength(1)
    expect(sender.pending()).toBe(2)

    ackInFlight()

    expect(sent).toHaveLength(2)
    expect(settled).toHaveLength(1)
    expect(settled[0].state).toBe('acknowledged')

    ackInFlight()
    expect(sender.pending()).toBe(0)
    expect(settled).toHaveLength(2)
  })

  it('retries a down transport with the SAME minted ops and never re-mints', () => {
    transportUp = false
    sender.enqueue([addNode(1)])
    expect(sent).toHaveLength(0)

    boundWorkflow = 'wf-2'
    transportUp = true
    vi.advanceTimersByTime(500)

    expect(sent).toHaveLength(1)
    expect(sent[0].workflowId).toBe(WORKFLOW)
    const firstIds = sent[0].ops.map((op) => op.op_id)

    ackInFlight()
    expect(settled[0].state).toBe('acknowledged')
    expect(
      settled[0].state === 'acknowledged' &&
        settled[0].ops.map((op) => op.op_id)
    ).toEqual(firstIds)
  })

  it('keeps queued batches addressed to the workflow active when they were minted', () => {
    sender.enqueue([addNode(1)])
    sender.enqueue([addNode(2)])
    boundWorkflow = 'wf-2'

    ackInFlight()

    expect(sent[1].workflowId).toBe(WORKFLOW)
  })

  it('settles undeliverable after the transport retry budget', () => {
    transportUp = false
    sender.enqueue([addNode(1)])

    vi.advanceTimersByTime(500 * 6)

    expect(settled).toEqual([
      { state: 'undeliverable', ops: expect.any(Array) }
    ])
  })

  it('drops a batch as undeliverable when no doc is bound', () => {
    boundWorkflow = null
    sender.enqueue([addNode(1)])

    expect(sent).toHaveLength(0)
    expect(settled[0].state).toBe('undeliverable')
  })

  it('resends the same ops exactly once after result silence, then reports unacknowledged', () => {
    sender.enqueue([addNode(1)])
    expect(sent).toHaveLength(1)

    vi.advanceTimersByTime(10_000)
    expect(sent).toHaveLength(2)
    expect(sent[1].ops.map((op) => op.op_id)).toEqual(
      sent[0].ops.map((op) => op.op_id)
    )

    vi.advanceTimersByTime(10_000)
    expect(settled).toEqual([
      { state: 'unacknowledged', ops: expect.any(Array) }
    ])
  })

  it('a late result after the resend still acknowledges the batch', () => {
    sender.enqueue([addNode(1)])
    vi.advanceTimersByTime(10_000)
    expect(sent).toHaveLength(2)

    ackInFlight()

    expect(settled).toHaveLength(1)
    expect(settled[0].state).toBe('acknowledged')
  })

  it('splits an oversized enqueue into serialized wire batches', () => {
    sender.enqueue(Array.from({ length: 300 }, (_, index) => addNode(index)))

    expect(sent).toHaveLength(1)
    expect(sent[0].ops).toHaveLength(256)
    expect(sender.pending()).toBe(2)

    ackInFlight()
    expect(sent[1].ops).toHaveLength(44)
  })

  it('ignores a result for other ops while a batch is in flight', () => {
    sender.enqueue([addNode(1)])

    resultListener?.({ ok: true, applied: ['ffff'.repeat(8)], skipped: [] })

    expect(settled).toHaveLength(0)
  })

  it('a late anonymous failure from an unacknowledged batch never settles the next batch', () => {
    sender.enqueue([addNode(1)])
    vi.advanceTimersByTime(10_000)
    vi.advanceTimersByTime(10_000)
    expect(settled).toEqual([
      { state: 'unacknowledged', ops: expect.any(Array) }
    ])

    sender.enqueue([addNode(2)])
    expect(sent).toHaveLength(3)

    resultListener?.({ ok: false, applied: [], skipped: [] })
    expect(settled).toHaveLength(1)

    ackInFlight()
    expect(settled).toHaveLength(2)
    expect(settled[1].state).toBe('acknowledged')
  })

  it('an identified empty-list failure settles the batch it names via failure.op_id', () => {
    sender.enqueue([addNode(1)])
    const opId = sent[0].ops[0].op_id

    resultListener?.({
      ok: false,
      applied: [],
      skipped: [],
      failure: { op_id: opId }
    })

    expect(settled).toHaveLength(1)
    expect(settled[0].state).toBe('acknowledged')
  })

  it('normalizes shipped doc_ops_result failed object and array shapes', () => {
    expect(
      toOpsResultView({
        ok: false,
        applied: [],
        skipped: [],
        failed: { index: 0, op: { op_id: 'a'.repeat(32) } }
      })
    ).toEqual({
      ok: false,
      applied: [],
      skipped: [],
      failure: { op_id: 'a'.repeat(32), index: 0 },
      failureOpIds: ['a'.repeat(32)]
    })

    expect(
      toOpsResultView({
        ok: false,
        applied: [],
        skipped: [],
        failed: [{ index: 0 }, { op_id: 'b'.repeat(32) }]
      })
    ).toEqual({
      ok: false,
      applied: [],
      skipped: [],
      failure: { op_id: 'b'.repeat(32) },
      failureOpIds: ['b'.repeat(32)]
    })
  })

  it('preserves a canonical failure over a derived one, and collects every failed op_id', () => {
    expect(
      toOpsResultView({
        ok: false,
        applied: [],
        skipped: [],
        failure: { op_id: 'c'.repeat(32) },
        failed: [{ op_id: 'd'.repeat(32) }]
      })
    ).toEqual({
      ok: false,
      applied: [],
      skipped: [],
      failure: { op_id: 'c'.repeat(32) },
      failureOpIds: ['c'.repeat(32), 'd'.repeat(32)]
    })

    expect(
      toOpsResultView({
        ok: false,
        applied: [],
        skipped: [],
        failed: [{ op_id: 'e'.repeat(32) }, { op_id: 'f'.repeat(32) }]
      })
    ).toEqual({
      ok: false,
      applied: [],
      skipped: [],
      failure: { op_id: 'e'.repeat(32) },
      failureOpIds: ['e'.repeat(32), 'f'.repeat(32)]
    })
  })

  it('threads the host failure code, message and index through the view', () => {
    expect(
      toOpsResultView({
        ok: false,
        applied: [],
        skipped: [],
        failed: {
          index: 2,
          op_id: 'a'.repeat(32),
          code: 'op_rejected',
          message: 'unknown node 7'
        }
      })
    ).toEqual({
      ok: false,
      applied: [],
      skipped: [],
      failure: {
        op_id: 'a'.repeat(32),
        index: 2,
        code: 'op_rejected',
        message: 'unknown node 7'
      },
      failureOpIds: ['a'.repeat(32)]
    })

    // The canonical failure's reason wins over a legacy entry's and the
    // frame's top-level code; each field is only taken when on-type.
    expect(
      toOpsResultView({
        ok: false,
        applied: [],
        skipped: [],
        code: 'frame_code',
        message: 'frame message',
        failure: { op_id: 'c'.repeat(32), code: 'lww_dropped', index: '0' },
        failed: [{ op_id: 'd'.repeat(32), code: 'legacy', message: 'legacy' }]
      })
    ).toEqual({
      ok: false,
      applied: [],
      skipped: [],
      failure: {
        op_id: 'c'.repeat(32),
        code: 'lww_dropped',
        message: 'legacy'
      },
      failureOpIds: ['c'.repeat(32), 'd'.repeat(32)]
    })

    // A rejection that names no op still carries its reason (anonymous
    // settle keeps working: no failureOpIds).
    expect(
      toOpsResultView({
        ok: false,
        applied: [],
        skipped: [],
        code: 'batch_too_large',
        message: 'too many ops'
      })
    ).toEqual({
      ok: false,
      applied: [],
      skipped: [],
      failure: { code: 'batch_too_large', message: 'too many ops' }
    })

    // A successful frame's stray code is not a failure.
    expect(
      toOpsResultView({ ok: true, applied: ['x'], skipped: [], code: 'noop' })
    ).toEqual({ ok: true, applied: ['x'], skipped: [] })
  })

  it('a canonical empty-list rejection with no failed entries settles as anonymous', () => {
    expect(
      toOpsResultView({ ok: false, applied: [], skipped: [], failed: [] })
    ).toEqual({
      ok: false,
      applied: [],
      skipped: []
    })
  })

  it('returns a safe empty view for a null or undefined doc_ops_result detail', () => {
    expect(toOpsResultView(null)).toEqual({
      ok: false,
      applied: [],
      skipped: []
    })
    expect(toOpsResultView(undefined)).toEqual({
      ok: false,
      applied: [],
      skipped: []
    })
  })

  it('an identified failure for other ops never settles the in-flight batch', () => {
    sender.enqueue([addNode(1)])

    resultListener?.({
      ok: false,
      applied: [],
      skipped: [],
      failure: { op_id: 'ffff'.repeat(8) }
    })

    expect(settled).toHaveLength(0)
  })

  it('a legacy failed id matching the in-flight batch settles it even under a foreign canonical op_id', () => {
    sender.enqueue([addNode(1)])
    const own = sent[0].ops[0].op_id

    resultListener?.(
      toOpsResultView({
        ok: false,
        applied: [],
        skipped: [],
        failure: { op_id: 'ffff'.repeat(8), code: 'op_rejected' },
        failed: [{ op_id: own, code: 'op_rejected', message: 'rejected' }]
      })
    )

    expect(settled).toHaveLength(1)
    expect(settled[0]).toMatchObject({
      state: 'acknowledged',
      result: {
        failure: { op_id: 'ffff'.repeat(8), code: 'op_rejected' },
        failureOpIds: ['ffff'.repeat(8), own]
      }
    })
  })

  it('idle late results drain the stale credits so a fresh batch can settle anonymously', () => {
    sender.enqueue([addNode(1)])
    vi.advanceTimersByTime(10_000)
    vi.advanceTimersByTime(10_000)
    expect(settled).toHaveLength(1)

    resultListener?.({ ok: false, applied: [], skipped: [] })
    resultListener?.({ ok: false, applied: [], skipped: [] })

    sender.enqueue([addNode(2)])
    resultListener?.({ ok: false, applied: [], skipped: [] })

    expect(settled).toHaveLength(2)
    expect(settled[1].state).toBe('acknowledged')
  })

  it('stops sending after detach', () => {
    sender.enqueue([addNode(1)])
    ackInFlight()
    sender.detach()
    sender.enqueue([addNode(2)])

    expect(sent).toHaveLength(1)
  })
})
