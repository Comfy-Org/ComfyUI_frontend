import type { Op } from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GraphMutationTarget, GraphOperation } from './graphOperations'
import { createOpSender } from './opSender'
import type { BatchOutcome, OpsResultView } from './opSender'

const WORKFLOW = 'wf-1'
const TAB = 'tab-1'
const ACTOR = 'human:test-user:tab-1'
const TARGET: GraphMutationTarget = {
  workflowId: WORKFLOW,
  rootGraphId: 'root-1'
}

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
  let producerVersion: number
  let producerClockWritable: boolean
  let sender: ReturnType<typeof createOpSender>

  function enqueue(...operations: GraphOperation[]): boolean {
    return sender.enqueue({ target: TARGET, operations })
  }

  function deliverResult(
    result: Omit<OpsResultView, 'workflowId'>,
    workflowId = WORKFLOW
  ): void {
    resultListener?.({ workflowId, ...result })
  }

  function ackInFlight(): void {
    const last = sent[sent.length - 1]
    deliverResult(
      {
        ok: true,
        applied: last.ops.map((op) => op.op_id),
        skipped: []
      },
      last.workflowId
    )
  }

  beforeEach(() => {
    vi.useFakeTimers()
    sent = []
    settled = []
    resultListener = null
    transportUp = true
    boundWorkflow = WORKFLOW
    producerVersion = 0
    producerClockWritable = true
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
      observedVersion: () => 41,
      reserveVersions: (_workflowId, observed, count) => {
        if (!producerClockWritable) return null
        const first = Math.max(producerVersion, observed) + 1
        producerVersion = first + count - 1
        return first
      },
      onBatchSettled: (outcome) => settled.push(outcome)
    })
  })

  afterEach(() => {
    sender.detach()
  })

  it('mints once and sends a doc_ops batch with the wire envelope', () => {
    enqueue(addNode(1), addNode(2))

    expect(sent).toHaveLength(1)
    expect(sent[0].workflowId).toBe(WORKFLOW)
    expect(sent[0].tab).toBe(TAB)
    expect(sent[0].ops).toHaveLength(2)
    for (const [index, op] of sent[0].ops.entries()) {
      expect(op.op_id).toMatch(/^[0-9a-f]{32}$/)
      expect(op.actor).toBe(ACTOR)
      expect(op.base_version).toBe(42 + index)
      expect(op.stamp).toEqual([42 + index, ACTOR])
    }
  })

  it('serializes batches: the next sends only after the result settles the first', () => {
    enqueue(addNode(1))
    enqueue(addNode(2))
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
    enqueue(addNode(1))
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
    enqueue(addNode(1))
    enqueue(addNode(2))
    boundWorkflow = 'wf-2'

    ackInFlight()

    expect(sent[1].workflowId).toBe(WORKFLOW)
  })

  it('settles undeliverable after the transport retry budget', () => {
    transportUp = false
    enqueue(addNode(1))

    vi.advanceTimersByTime(500 * 6)

    expect(settled).toEqual([
      expect.objectContaining({
        state: 'undeliverable',
        target: TARGET,
        ops: expect.any(Array)
      })
    ])
  })

  it('rejects a target mismatch before reserving or minting', () => {
    boundWorkflow = null
    const accepted = enqueue(addNode(1))

    expect(accepted).toBe(false)
    expect(sent).toHaveLength(0)
    expect(settled).toEqual([
      {
        state: 'rejected',
        target: TARGET,
        operations: [addNode(1)],
        reason: 'target_mismatch'
      }
    ])
    expect(producerVersion).toBe(0)
  })

  it('rejects an operation before minting when its clock cannot persist', () => {
    producerClockWritable = false

    expect(enqueue(addNode(1))).toBe(false)
    expect(sent).toEqual([])
    expect(settled).toEqual([
      {
        state: 'rejected',
        target: TARGET,
        operations: [addNode(1)],
        reason: 'version_reservation_failed'
      }
    ])
  })

  it('resends the same ops exactly once after result silence, then reports unacknowledged', () => {
    enqueue(addNode(1))
    expect(sent).toHaveLength(1)

    vi.advanceTimersByTime(10_000)
    expect(sent).toHaveLength(2)
    expect(sent[1].ops.map((op) => op.op_id)).toEqual(
      sent[0].ops.map((op) => op.op_id)
    )

    vi.advanceTimersByTime(10_000)
    expect(settled).toEqual([
      expect.objectContaining({
        state: 'unacknowledged',
        target: TARGET,
        ops: expect.any(Array)
      })
    ])
  })

  it('a late result after the resend still acknowledges the batch', () => {
    enqueue(addNode(1))
    vi.advanceTimersByTime(10_000)
    expect(sent).toHaveLength(2)

    ackInFlight()

    expect(settled).toHaveLength(1)
    expect(settled[0].state).toBe('acknowledged')
  })

  it('splits an oversized enqueue into serialized wire batches', () => {
    sender.enqueue({
      target: TARGET,
      operations: Array.from({ length: 300 }, (_, index) => addNode(index))
    })

    expect(sent).toHaveLength(1)
    expect(sent[0].ops).toHaveLength(256)
    expect(sender.pending()).toBe(2)

    ackInFlight()
    expect(sent[1].ops).toHaveLength(44)
  })

  it('ignores a result for other ops while a batch is in flight', () => {
    enqueue(addNode(1))

    deliverResult({ ok: true, applied: ['ffff'.repeat(8)], skipped: [] })

    expect(settled).toHaveLength(0)
  })

  it('a late anonymous failure from an unacknowledged batch never settles the next batch', () => {
    enqueue(addNode(1))
    vi.advanceTimersByTime(10_000)
    vi.advanceTimersByTime(10_000)
    expect(settled).toEqual([
      expect.objectContaining({
        state: 'unacknowledged',
        target: TARGET,
        ops: expect.any(Array)
      })
    ])

    enqueue(addNode(2))
    expect(sent).toHaveLength(3)

    deliverResult({ ok: false, applied: [], skipped: [] })
    expect(settled).toHaveLength(1)

    ackInFlight()
    expect(settled).toHaveLength(2)
    expect(settled[1].state).toBe('acknowledged')
  })

  it('an identified empty-list failure settles the batch it names via failure.op_id', () => {
    enqueue(addNode(1))
    const opId = sent[0].ops[0].op_id

    deliverResult({
      ok: false,
      applied: [],
      skipped: [],
      failure: { op_id: opId }
    })

    expect(settled).toHaveLength(1)
    const outcome = settled[0]
    expect(outcome.state).toBe('acknowledged')
    if (outcome.state !== 'acknowledged')
      throw new Error('expected acknowledged outcome')
    expect(outcome.batchId).toBe(opId)
  })

  it('an identified failure for other ops never settles the in-flight batch', () => {
    enqueue(addNode(1))

    deliverResult({
      ok: false,
      applied: [],
      skipped: [],
      failure: { op_id: 'ffff'.repeat(8) }
    })

    expect(settled).toHaveLength(0)
  })

  it('ignores a foreign-workflow result that names this batch op', () => {
    enqueue(addNode(1))
    const opId = sent[0].ops[0].op_id

    deliverResult({ ok: true, applied: [opId], skipped: [] }, 'wf-other')
    expect(settled).toEqual([])

    deliverResult({ ok: true, applied: [opId], skipped: [] })
    expect(settled).toHaveLength(1)
  })

  it('settles each workflow batch only on its own identified result', () => {
    enqueue(addNode(1))
    const workflowAOpId = sent[0].ops[0].op_id
    ackInFlight()

    const targetB = { workflowId: 'wf-2', rootGraphId: 'root-2' }
    boundWorkflow = targetB.workflowId
    sender.enqueue({ target: targetB, operations: [addNode(1)] })
    const workflowBOpId = sent[1].ops[0].op_id

    deliverResult(
      { ok: true, applied: [workflowAOpId], skipped: [] },
      TARGET.workflowId
    )
    deliverResult({ ok: false, applied: [], skipped: [] }, TARGET.workflowId)
    deliverResult({ ok: false, applied: [], skipped: [] }, targetB.workflowId)

    expect(settled).toHaveLength(1)

    deliverResult(
      { ok: true, applied: [workflowBOpId], skipped: [] },
      targetB.workflowId
    )
    expect(settled).toHaveLength(2)
    expect(settled[1]).toMatchObject({
      state: 'acknowledged',
      target: targetB,
      batchId: workflowBOpId
    })
  })

  it('leaves a current anonymous result unacknowledged', () => {
    enqueue(addNode(1))

    deliverResult({ ok: false, applied: [], skipped: [] })
    expect(settled).toEqual([])

    vi.advanceTimersByTime(20_000)
    expect(settled[0].state).toBe('unacknowledged')
  })

  it('stops sending after detach', () => {
    enqueue(addNode(1))
    ackInFlight()
    sender.detach()
    enqueue(addNode(2))

    expect(sent).toHaveLength(1)
  })
})
