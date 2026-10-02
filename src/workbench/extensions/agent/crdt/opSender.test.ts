import type { Op } from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import type { GraphOperation } from './graphOperations'
import { createOpSender } from './opSender'
import type { BatchOutcome, OpSender, OpsResultView } from './opSender'

vi.mock(import('@/platform/telemetry/reportError'))

const WORKFLOW = 'wf-1'
const TAB = 'tab-1'
const ACTOR = 'human:test-user:tab-1'

type SettlementListener = (outcome: BatchOutcome) => void
type SettlementSummary = { state: BatchOutcome['state']; nodeIds: unknown[] }
type AddNodeOperation = Extract<GraphOperation, { op: 'add_node' }>

function summarizeSettlement(outcome: BatchOutcome): SettlementSummary {
  return {
    state: outcome.state,
    nodeIds: outcome.ops.map((op) => ('node_id' in op ? op.node_id : undefined))
  }
}

const detachListenerFailureCases = [
  [
    'in-flight',
    (
      listener: Mock<SettlementListener>,
      _record: SettlementListener,
      fail: SettlementListener
    ) => listener.mockImplementationOnce(fail),
    [
      { state: 'undeliverable', nodeIds: [2] },
      { state: 'undeliverable', nodeIds: [3] }
    ]
  ],
  [
    'queued',
    (
      listener: Mock<SettlementListener>,
      record: SettlementListener,
      fail: SettlementListener
    ) => listener.mockImplementationOnce(record).mockImplementationOnce(fail),
    [
      { state: 'unconfirmed', nodeIds: [1] },
      { state: 'undeliverable', nodeIds: [3] }
    ]
  ],
  [
    'open',
    (
      listener: Mock<SettlementListener>,
      record: SettlementListener,
      fail: SettlementListener
    ) =>
      listener
        .mockImplementationOnce(record)
        .mockImplementationOnce(record)
        .mockImplementationOnce(fail),
    [
      { state: 'unconfirmed', nodeIds: [1] },
      { state: 'undeliverable', nodeIds: [2] }
    ]
  ]
] as const satisfies ReadonlyArray<
  readonly [
    string,
    (
      listener: Mock<SettlementListener>,
      record: SettlementListener,
      fail: SettlementListener
    ) => unknown,
    readonly SettlementSummary[]
  ]
>

function addNode(id: number): AddNodeOperation {
  return {
    op: 'add_node',
    node_id: id,
    class_type: 'TestNode',
    pos: [0, 0],
    node: { id, type: 'TestNode' }
  }
}

function enqueueNodeBacklog(
  sender: ReturnType<typeof createOpSender>,
  count: number
): void {
  for (let id = 0; id < count; id++) sender.enqueue([addNode(id)])
}

function disconnect(linkId: number): GraphOperation {
  return { op: 'disconnect', link_id: linkId, to_node: 2, to_slot: 0 }
}

function connect(linkId: number): GraphOperation {
  return {
    op: 'connect',
    link_id: linkId,
    from_node: 1,
    from_slot: 0,
    to_node: 2,
    to_slot: 0,
    link_type: 'IMAGE'
  }
}

describe('createOpSender', () => {
  let sent: Array<{ workflowId: string; tab: string; ops: Op[] }>
  let settled: BatchOutcome[]
  let resultListener: ((result: OpsResultView) => void) | null
  let transportUp: boolean
  let transportThrows: boolean
  let boundWorkflow: string | null
  let sender: ReturnType<typeof createOpSender>
  const unsubscribe = vi.fn(() => {
    resultListener = null
  })

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
    transportThrows = false
    boundWorkflow = WORKFLOW
    sender = createOpSender({
      sendOps: (workflowId, tab, ops) => {
        if (transportThrows) throw new Error('frame serialization failed')
        if (!transportUp) return false
        sent.push({ workflowId, tab, ops })
        return true
      },
      onOpsResult: (listener) => {
        resultListener = listener
        return unsubscribe
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
    for (const [index, op] of sent[0].ops.entries()) {
      expect(op.op_id).toMatch(/^[0-9a-f]{32}$/)
      expect(op.actor).toBe(ACTOR)
      expect(op.base_version).toBe(41 + index)
      expect(op.stamp).toEqual([41 + index, ACTOR])
    }
  })

  it('orders a reconnect after its disconnect before the host sequence advances', () => {
    sender.admit([disconnect(1)])
    sender.admit([connect(2)])
    sender.flush()

    expect(sent[0].ops.map((op) => op.base_version)).toEqual([41, 42])
  })

  it('restarts local operation versions after a document reset', () => {
    sender.enqueue([addNode(1)])
    sender.abortAll()
    sender.enqueue([addNode(2)])

    expect(sent[1].ops[0].base_version).toBe(41)
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

  it('never re-addresses a queued batch: an unbound mint-time workflow settles it undeliverable at once', () => {
    sender.enqueue([addNode(1)])
    sender.enqueue([addNode(2)])
    sender.enqueue([addNode(3)])
    boundWorkflow = 'wf-2'

    ackInFlight()

    expect(sent).toHaveLength(1)
    expect(settled.map((outcome) => outcome.state)).toEqual([
      'acknowledged',
      'undeliverable',
      'undeliverable'
    ])
    expect(settled[1].ops[0].op_id).not.toBe(settled[2].ops[0].op_id)
  })

  it('a bound workflow restored before the next send still carries the queued batch', () => {
    sender.enqueue([addNode(1)])
    sender.enqueue([addNode(2)])
    boundWorkflow = null
    boundWorkflow = WORKFLOW

    ackInFlight()

    expect(sent).toHaveLength(2)
    expect(sent[1].workflowId).toBe(WORKFLOW)
  })

  it('settles a transmitted in-flight batch unconfirmed at the silence resend once its workflow is unbound', () => {
    sender.enqueue([addNode(1)])
    boundWorkflow = null

    vi.advanceTimersByTime(10_000)

    expect(sent).toHaveLength(1)
    expect(settled).toEqual([{ state: 'unconfirmed', ops: expect.any(Array) }])
  })

  it('abortIfUnbound settles a transmitted in-flight batch unconfirmed immediately, without waiting the 10s silence window', () => {
    sender.enqueue([addNode(1)])
    boundWorkflow = null

    sender.abortIfUnbound()

    expect(settled).toEqual([{ state: 'unconfirmed', ops: expect.any(Array) }])
    // No resend was burned reaching this outcome.
    expect(sent).toHaveLength(1)
  })

  it('abortIfUnbound frees the queue for the next bound batch immediately', () => {
    sender.enqueue([addNode(1)])
    boundWorkflow = 'wf-2'
    sender.enqueue([addNode(2)])
    expect(sent).toHaveLength(1)

    sender.abortIfUnbound()

    expect(sent).toHaveLength(2)
    expect(sent[1].workflowId).toBe('wf-2')
    expect(settled[0].state).toBe('unconfirmed')
  })

  it('drains 20,000 queued batches after unbinding without overflowing the stack', () => {
    enqueueNodeBacklog(sender, 20_000)
    boundWorkflow = null

    expect(() => sender.abortIfUnbound()).not.toThrow()
    expect(settled).toHaveLength(20_000)
    expect(settled[0].state).toBe('unconfirmed')
    expect(
      settled.slice(1).every(({ state }) => state === 'undeliverable')
    ).toBe(true)
    expect(
      new Set(settled.flatMap((outcome) => outcome.ops.map((op) => op.op_id)))
        .size
    ).toBe(20_000)
    expect(sender.pending()).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('drains an old-workflow backlog before sending the next workflow batch', () => {
    enqueueNodeBacklog(sender, 20_000)
    boundWorkflow = 'wf-2'
    sender.enqueue([addNode(20_000)])

    expect(() => sender.abortIfUnbound()).not.toThrow()
    expect(settled).toHaveLength(20_000)
    expect(sent).toHaveLength(2)
    expect(sent[1].workflowId).toBe('wf-2')
    expect(sent[1].ops[0]).toMatchObject({ node_id: 20_000 })
    expect(sender.pending()).toBe(1)

    ackInFlight()
    expect(settled).toHaveLength(20_001)
    expect(settled.at(-1)?.state).toBe('acknowledged')
    expect(sender.pending()).toBe(0)
  })

  it('abortIfUnbound cascades through every queued batch minted for the dead workflow, synchronously', () => {
    sender.enqueue([addNode(1)])
    sender.enqueue([addNode(2)])
    sender.enqueue([addNode(3)])
    boundWorkflow = 'wf-2'
    sender.enqueue([addNode(4)])
    expect(sent).toHaveLength(1)

    sender.abortIfUnbound()

    // No timer advance: settle -> pump -> transmit re-reads the binding and
    // settles each wf-1 batch in turn until it reaches the wf-2 one. Only the
    // first had left the client.
    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unconfirmed',
      'undeliverable',
      'undeliverable'
    ])
    expect(sent).toHaveLength(2)
    expect(sent[1].workflowId).toBe('wf-2')
    expect(sender.pending()).toBe(1)
  })

  it('abortIfUnbound clears a pending send retry so no timer outlives the batch', () => {
    transportUp = false
    sender.enqueue([addNode(1)])
    expect(vi.getTimerCount()).toBe(1)
    boundWorkflow = null

    sender.abortIfUnbound()

    expect(settled.map((outcome) => outcome.state)).toEqual(['undeliverable'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('abortIfUnbound is a no-op while the in-flight batch is still addressed to the bound workflow', () => {
    sender.enqueue([addNode(1)])

    sender.abortIfUnbound()

    expect(settled).toHaveLength(0)
    expect(sent).toHaveLength(1)
  })

  it('abortIfUnbound is a no-op with no batch in flight', () => {
    expect(() => sender.abortIfUnbound()).not.toThrow()
    expect(settled).toHaveLength(0)
  })

  it('an unbound workflow at the resend frees the queue for the next bound batch without a retry burn', () => {
    sender.enqueue([addNode(1)])
    boundWorkflow = 'wf-2'
    sender.enqueue([addNode(2)])
    expect(sent).toHaveLength(1)

    vi.advanceTimersByTime(10_000)

    expect(sent).toHaveLength(2)
    expect(sent[1].workflowId).toBe('wf-2')
    expect(settled[0].state).toBe('unconfirmed')
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

  it('ignores an anonymous result for another workflow', () => {
    sender.enqueue([addNode(1)])
    boundWorkflow = 'wf-2'
    sender.abortIfUnbound()
    sender.enqueue([addNode(2)])

    resultListener?.({
      workflowId: WORKFLOW,
      ok: false,
      applied: [],
      skipped: []
    })

    expect(settled).toHaveLength(1)
    expect(sender.pending()).toBe(1)
  })

  it('late results addressed to the old workflow drain the stale credits', () => {
    sender.enqueue([addNode(1)])
    vi.advanceTimersByTime(10_000)
    vi.advanceTimersByTime(10_000)
    expect(settled.map((outcome) => outcome.state)).toEqual(['unacknowledged'])

    boundWorkflow = 'wf-2'
    sender.enqueue([addNode(2)])

    resultListener?.({
      workflowId: WORKFLOW,
      ok: false,
      applied: [],
      skipped: []
    })
    resultListener?.({
      workflowId: WORKFLOW,
      ok: false,
      applied: [],
      skipped: []
    })
    expect(settled).toHaveLength(1)

    resultListener?.({
      workflowId: 'wf-2',
      ok: false,
      applied: [],
      skipped: []
    })

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unacknowledged',
      'acknowledged'
    ])
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

  it('an identified empty-list failure settles the batch it names via failed.op_id', () => {
    sender.enqueue([addNode(1)])
    const opId = sent[0].ops[0].op_id

    resultListener?.({
      ok: false,
      applied: [],
      skipped: [],
      failed: {
        index: 0,
        op_id: opId,
        code: 'opaque_widgets',
        message: 'rejected'
      }
    })

    expect(settled).toHaveLength(1)
    expect(settled[0].state).toBe('acknowledged')
  })

  it('an identified failure for other ops never settles the in-flight batch', () => {
    sender.enqueue([addNode(1)])

    resultListener?.({
      ok: false,
      applied: [],
      skipped: [],
      failed: {
        index: 0,
        op_id: 'ffff'.repeat(8),
        code: 'opaque_widgets',
        message: 'rejected'
      }
    })

    expect(settled).toHaveLength(0)
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
    expect(settled.at(-1)).toMatchObject({
      state: 'undeliverable',
      ops: [expect.objectContaining({ node_id: 2 })]
    })
  })

  it('detach clears the armed result-timeout timer so no late resend or settlement follows', () => {
    sender.enqueue([addNode(1)])
    expect(sent).toHaveLength(1)
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    sender.detach()

    expect(vi.getTimerCount()).toBe(0)
    const settledAfterDetach = settled.length
    vi.advanceTimersByTime(10_000)

    expect(sent).toHaveLength(1)
    expect(settled).toHaveLength(settledAfterDetach)
  })

  it('detach clears an armed transport-retry timer so no late retry send follows', () => {
    transportUp = false
    const ops = [addNode(1)]
    sender.enqueue(ops)
    expect(sent).toHaveLength(0)
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    sender.detach()

    expect(vi.getTimerCount()).toBe(0)
    expect(settled).toHaveLength(1)
    expect(settled[0]).toMatchObject({ state: 'undeliverable', ops })
    vi.advanceTimersByTime(500 * 6)

    expect(sent).toHaveLength(0)
    expect(settled).toHaveLength(1)
  })

  it('detach settles every outstanding batch instead of dropping it silently', () => {
    sender.enqueue([addNode(1)])
    sender.enqueue([addNode(2)])
    sender.admit([addNode(3)])
    expect(sent).toHaveLength(1)

    sender.detach()

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unconfirmed',
      'undeliverable',
      'undeliverable'
    ])
    expect(
      settled.map((outcome) =>
        outcome.ops.map((op) => ('node_id' in op ? op.node_id : undefined))
      )
    ).toEqual([[1], [2], [3]])
  })

  it('continues pumping queued work when an ordinary settlement listener throws', () => {
    const localSettled: BatchOutcome[] = []
    const onBatchSettled = vi
      .fn<SettlementListener>()
      .mockImplementationOnce(() => {
        throw new Error('listener boom')
      })
      .mockImplementation((outcome) => localSettled.push(outcome))
    const localSender = createOpSender({
      sendOps: (workflowId, tab, ops) => {
        sent.push({ workflowId, tab, ops })
        return true
      },
      onOpsResult: (listener) => {
        resultListener = listener
        return vi.fn()
      },
      workflowId: () => boundWorkflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled
    })
    localSender.enqueue([addNode(1)])
    localSender.enqueue([addNode(2)])

    expect(() => ackInFlight()).not.toThrow()

    expect(sent).toHaveLength(2)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'failure_settling_agent_op_sender' })
    )
    ackInFlight()
    expect(localSettled).toHaveLength(1)
    localSender.detach()
  })

  it('reports settlement failures again for later batches', () => {
    const localSender = createOpSender({
      sendOps: (workflowId, tab, ops) => {
        sent.push({ workflowId, tab, ops })
        return true
      },
      onOpsResult: (listener) => {
        resultListener = listener
        return vi.fn()
      },
      workflowId: () => boundWorkflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: () => {
        throw new Error('listener boom')
      }
    })
    localSender.enqueue([addNode(1)])
    localSender.enqueue([addNode(2)])

    ackInFlight()
    ackInFlight()

    expect(reportError).toHaveBeenCalledTimes(2)
    localSender.detach()
  })

  it('bounds repeated settlement failure telemetry for one sender', () => {
    const localSender = createOpSender({
      sendOps: (workflowId, tab, ops) => {
        sent.push({ workflowId, tab, ops })
        return true
      },
      onOpsResult: (listener) => {
        resultListener = listener
        return vi.fn()
      },
      workflowId: () => boundWorkflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: () => {
        throw new Error('listener boom')
      }
    })

    localSender.enqueue([addNode(1)])
    ackInFlight()
    localSender.enqueue([addNode(2)])
    ackInFlight()
    localSender.enqueue([addNode(3)])
    ackInFlight()
    localSender.enqueue([addNode(4)])
    ackInFlight()
    localSender.enqueue([addNode(5)])
    ackInFlight()

    expect(reportError).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(60_000)
    localSender.enqueue([addNode(6)])
    ackInFlight()
    expect(reportError).toHaveBeenCalledTimes(4)
    localSender.detach()
  })

  it('keeps settlement telemetry bounded across intermittent successes', () => {
    let shouldFail = true
    const localSender = createOpSender({
      sendOps: (workflowId, tab, ops) => {
        sent.push({ workflowId, tab, ops })
        return true
      },
      onOpsResult: (listener) => {
        resultListener = listener
        return vi.fn()
      },
      workflowId: () => boundWorkflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: () => {
        if (shouldFail) throw new Error('listener boom')
      }
    })

    localSender.enqueue([addNode(1)])
    ackInFlight()
    localSender.enqueue([addNode(2)])
    ackInFlight()
    localSender.enqueue([addNode(3)])
    ackInFlight()
    expect(reportError).toHaveBeenCalledTimes(3)

    shouldFail = false
    localSender.enqueue([addNode(4)])
    ackInFlight()
    shouldFail = true
    localSender.enqueue([addNode(5)])
    ackInFlight()

    expect(reportError).toHaveBeenCalledTimes(3)
    shouldFail = false
    localSender.detach()
  })

  it('contains settlement failures when admitting while unbound', () => {
    boundWorkflow = null
    const localSender = createOpSender({
      sendOps: () => true,
      onOpsResult: () => vi.fn(),
      workflowId: () => boundWorkflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: () => {
        throw new Error('listener boom')
      }
    })

    expect(() => localSender.enqueue([addNode(1)])).not.toThrow()
    expect(localSender.pending()).toBe(0)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'failure_settling_agent_op_sender' })
    )
    localSender.detach()
  })

  it('a second detach() call is a no-op: no double-settle and no timer left armed', () => {
    sender.enqueue([addNode(1)])
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    sender.detach()
    const settledAfterFirstDetach = [...settled]
    expect(vi.getTimerCount()).toBe(0)

    sender.detach()

    expect(settled).toEqual(settledAfterFirstDetach)
    expect(vi.getTimerCount()).toBe(0)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it.for(detachListenerFailureCases)(
    'detach settles every other batch and still unsubscribes when the %s listener throws',
    ([, configureListener, expectedSurvivors]) => {
      const localSettled: BatchOutcome[] = []
      let unsubscribed = false
      const recordSettlement: SettlementListener = (outcome) => {
        localSettled.push(outcome)
      }
      const onBatchSettled = vi.fn(recordSettlement)
      configureListener(onBatchSettled, recordSettlement, () => {
        throw new Error('listener boom')
      })
      const localSender = createOpSender({
        sendOps: (workflowId, tab, ops) => {
          sent.push({ workflowId, tab, ops })
          return true
        },
        onOpsResult: (listener) => {
          resultListener = listener
          return () => {
            unsubscribed = true
          }
        },
        workflowId: () => boundWorkflow,
        tab: TAB,
        actor: () => ACTOR,
        baseVersion: () => 41,
        onBatchSettled
      })

      localSender.enqueue([addNode(1)])
      localSender.enqueue([addNode(2)])
      localSender.admit([addNode(3)])
      expect(sent).toHaveLength(1)

      localSender.detach()

      expect(localSettled.map(summarizeSettlement)).toEqual(expectedSurvivors)
      expect(reportError).toHaveBeenCalledTimes(1)
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_settling_agent_op_sender_detach'
        })
      )
      expect(unsubscribed).toBe(true)
    }
  )

  it('reports a systematically failing detach listener only once', () => {
    const localUnsubscribe = vi.fn()
    const localSender = createOpSender({
      sendOps: () => true,
      onOpsResult: () => localUnsubscribe,
      workflowId: () => boundWorkflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: () => {
        throw new Error('listener boom')
      }
    })
    localSender.enqueue([addNode(1)])
    localSender.enqueue([addNode(2)])
    localSender.admit([addNode(3)])

    localSender.detach()

    expect(reportError).toHaveBeenCalledTimes(1)
    expect(localUnsubscribe).toHaveBeenCalledOnce()
  })

  it('reports post-detach settlement failures only once across admissions', () => {
    const localSender = createOpSender({
      sendOps: () => true,
      onOpsResult: () => vi.fn(),
      workflowId: () => boundWorkflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: () => {
        throw new Error('listener boom')
      }
    })
    localSender.detach()

    localSender.enqueue([addNode(1)])
    localSender.enqueue([addNode(2)])

    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_settling_agent_op_sender_detach'
      })
    )
  })

  it('clears live state and unsubscribes when teardown cannot chunk an open batch', () => {
    const circularNode = addNode(1)
    const node: AddNodeOperation['node'] & Record<string, unknown> = {
      ...circularNode.node
    }
    node.circular = node
    circularNode.node = node
    sender.admit([circularNode])

    expect(() => sender.detach()).not.toThrow()

    expect(sender.pending()).toBe(0)
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(settled).toHaveLength(1)
    expect(settled[0]).toMatchObject({ state: 'undeliverable' })
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_chunking_agent_op_sender_teardown'
      })
    )
  })

  it('sends the valid prefix but rejects a malformed op and its dependent suffix', () => {
    const circularNode = addNode(2)
    const node: AddNodeOperation['node'] & Record<string, unknown> = {
      ...circularNode.node
    }
    node.circular = node
    circularNode.node = node

    sender.admit([addNode(1), circularNode, addNode(3)])
    expect(() => sender.flush()).not.toThrow()

    expect(sent).toHaveLength(1)
    expect(
      sent[0].ops.map((op) => ('node_id' in op ? op.node_id : null))
    ).toEqual([1])
    expect(settled.map(summarizeSettlement)).toEqual([
      { state: 'undeliverable', nodeIds: [2, 3] }
    ])
    ackInFlight()
    expect(sent).toHaveLength(1)
  })

  it('contains a second serialization failure while rechunking recovery', () => {
    const unstableNode = addNode(1)
    let serializations = 0
    unstableNode.node = {
      ...unstableNode.node,
      toJSON() {
        serializations++
        if (serializations >= 3) throw new Error('stateful toJSON failed')
        return { id: 1, type: 'TestNode' }
      }
    }
    const circularNode = addNode(2)
    const node: AddNodeOperation['node'] & Record<string, unknown> = {
      ...circularNode.node
    }
    node.circular = node
    circularNode.node = node

    sender.admit([unstableNode, circularNode])

    expect(() => sender.flush()).not.toThrow()
    expect(sent).toHaveLength(0)
    expect(settled.map(summarizeSettlement)).toEqual([
      { state: 'undeliverable', nodeIds: [1, 2] }
    ])
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_rechunking_agent_op_sender_recovery'
      })
    )
  })

  it('bounds repeated chunk failure telemetry for one sender', () => {
    const enqueueCircular = (id: number) => {
      const operation = addNode(id)
      const node: AddNodeOperation['node'] & Record<string, unknown> = {
        ...operation.node
      }
      node.circular = node
      operation.node = node
      sender.enqueue([operation])
    }

    enqueueCircular(1)
    enqueueCircular(2)
    enqueueCircular(3)
    enqueueCircular(4)
    enqueueCircular(5)

    expect(reportError).toHaveBeenCalledTimes(3)
  })

  it('keeps chunk telemetry bounded across successful seals and re-arms by time', () => {
    const enqueueCircular = (id: number) => {
      const operation = addNode(id)
      const node: AddNodeOperation['node'] & Record<string, unknown> = {
        ...operation.node
      }
      node.circular = node
      operation.node = node
      sender.enqueue([operation])
    }

    enqueueCircular(1)
    enqueueCircular(2)
    enqueueCircular(3)
    expect(reportError).toHaveBeenCalledTimes(3)

    sender.enqueue([addNode(4)])
    ackInFlight()
    enqueueCircular(5)

    expect(reportError).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(60_000)
    enqueueCircular(6)
    expect(reportError).toHaveBeenCalledTimes(4)
  })

  it('rejects an unserializable non-batchable op before transport', () => {
    const clear = {
      op: 'clear',
      removed_nodes: [1]
    } as GraphOperation & Record<string, unknown>
    clear.circular = clear

    sender.admit([clear])

    expect(() => sender.flush()).not.toThrow()
    expect(sent).toHaveLength(0)
    expect(settled).toHaveLength(1)
    expect(settled[0]).toMatchObject({ state: 'undeliverable' })
  })

  it('does not recreate an admission after sealing detaches the sender', () => {
    const circularNode = addNode(1)
    const node: AddNodeOperation['node'] & Record<string, unknown> = {
      ...circularNode.node
    }
    node.circular = node
    circularNode.node = node
    const localSettled: BatchOutcome[] = []
    let workflow = 'wf-old'
    const localSender = createOpSender({
      sendOps: () => true,
      onOpsResult: () => vi.fn(),
      workflowId: () => workflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: (outcome) => {
        localSettled.push(outcome)
        localSender.detach()
      }
    })
    localSender.admit([circularNode])
    workflow = 'wf-new'

    localSender.admit([addNode(2)])

    expect(localSender.pending()).toBe(0)
    expect(localSettled.map(summarizeSettlement)).toEqual([
      { state: 'undeliverable', nodeIds: [1] },
      { state: 'undeliverable', nodeIds: [2] }
    ])
    localSender.detach()
  })

  it('does not restore an admission across abortAll before same-workflow fresh work', () => {
    const circularNode = addNode(1)
    const node: AddNodeOperation['node'] & Record<string, unknown> = {
      ...circularNode.node
    }
    node.circular = node
    circularNode.node = node
    const localSettled: BatchOutcome[] = []
    const localSent: Op[][] = []
    let workflow = 'wf-old'
    const localSender = createOpSender({
      sendOps: (_workflowId, _tab, ops) => {
        localSent.push(ops)
        return true
      },
      onOpsResult: () => vi.fn(),
      workflowId: () => workflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: (outcome) => {
        localSettled.push(outcome)
        if (outcome.ops.some((op) => 'node_id' in op && op.node_id === 1)) {
          localSender.abortAll()
          localSender.admit([addNode(3)])
        }
      }
    })
    localSender.admit([circularNode])
    workflow = 'wf-new'

    localSender.admit([addNode(2)])
    localSender.flush()

    expect(localSent).toHaveLength(1)
    expect(
      localSent[0].map((op) => ('node_id' in op ? op.node_id : null))
    ).toEqual([3])
    expect(localSender.pending()).toBe(1)
    expect(localSettled.map(summarizeSettlement)).toEqual([
      { state: 'undeliverable', nodeIds: [1] },
      { state: 'undeliverable', nodeIds: [2] }
    ])
    localSender.detach()
  })

  it('keeps a nested admission separate when sealing reenters admit', () => {
    const circularNode = addNode(1)
    const node: AddNodeOperation['node'] & Record<string, unknown> = {
      ...circularNode.node
    }
    node.circular = node
    circularNode.node = node
    const localSettled: BatchOutcome[] = []
    let workflow = 'wf-old'
    const localSender = createOpSender({
      sendOps: (workflowId, tab, ops) => {
        sent.push({ workflowId, tab, ops })
        return true
      },
      onOpsResult: () => vi.fn(),
      workflowId: () => workflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: (outcome) => {
        localSettled.push(outcome)
        if (outcome.ops.some((op) => 'node_id' in op && op.node_id === 1)) {
          workflow = 'wf-nested'
          localSender.admit([addNode(3)])
        }
      }
    })
    localSender.admit([circularNode])
    workflow = 'wf-new'

    localSender.admit([addNode(2)])
    localSender.flush()

    expect(sent).toHaveLength(1)
    expect(sent[0].workflowId).toBe('wf-nested')
    expect(
      sent[0].ops.map((op) => ('node_id' in op ? op.node_id : null))
    ).toEqual([3])
    expect(localSettled.map(summarizeSettlement)).toEqual([
      { state: 'undeliverable', nodeIds: [1] },
      { state: 'undeliverable', nodeIds: [2] }
    ])
    localSender.detach()
  })

  it('preserves outer-before-inner order for same-workflow reentrant admission', () => {
    const circularNode = addNode(1)
    const node: AddNodeOperation['node'] & Record<string, unknown> = {
      ...circularNode.node
    }
    node.circular = node
    circularNode.node = node
    let workflow = 'wf-old'
    const localSender = createOpSender({
      sendOps: (workflowId, tab, ops) => {
        sent.push({ workflowId, tab, ops })
        return true
      },
      onOpsResult: () => vi.fn(),
      workflowId: () => workflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: (outcome) => {
        if (outcome.ops.some((op) => 'node_id' in op && op.node_id === 1))
          localSender.admit([addNode(3)])
      }
    })
    localSender.admit([circularNode])
    workflow = 'wf-new'

    localSender.admit([addNode(2)])
    localSender.flush()

    expect(sent).toHaveLength(1)
    expect(sent[0].workflowId).toBe('wf-new')
    expect(
      sent[0].ops.map((op) => ('node_id' in op ? op.node_id : null))
    ).toEqual([2, 3])
    localSender.detach()
  })

  it.for(['abortAll', 'detach'] as const)(
    'settles an admission when serialization reenters %s',
    (teardown) => {
      const localSettled: BatchOutcome[] = []
      const localSender: OpSender = createOpSender({
        sendOps: (workflowId, tab, ops) => {
          sent.push({ workflowId, tab, ops })
          return true
        },
        onOpsResult: () => vi.fn(),
        workflowId: () => boundWorkflow,
        tab: TAB,
        actor: () => ACTOR,
        baseVersion: () => 41,
        onBatchSettled: (outcome) => localSettled.push(outcome)
      })
      const operation = addNode(1)
      operation.node = {
        ...operation.node,
        toJSON() {
          localSender[teardown]()
          return { id: 1, type: 'TestNode' }
        }
      }

      localSender.admit([operation])
      localSender.flush()

      expect(sent).toHaveLength(0)
      expect(localSender.pending()).toBe(0)
      expect(localSettled.map(summarizeSettlement)).toEqual([
        { state: 'undeliverable', nodeIds: [1] }
      ])
      localSender.detach()
    }
  )

  it('settles an interrupted oversized seal in bounded groups', () => {
    const localSettled: BatchOutcome[] = []
    const localSender = createOpSender({
      sendOps: () => true,
      onOpsResult: () => vi.fn(),
      workflowId: () => WORKFLOW,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: (outcome) => localSettled.push(outcome)
    })
    const operations = Array.from({ length: 300 }, (_, id) => addNode(id))
    let aborted = false
    operations[0].node = {
      ...operations[0].node,
      toJSON() {
        if (!aborted) {
          aborted = true
          localSender.abortAll()
        }
        return { id: 0, type: 'TestNode' }
      }
    }

    localSender.admit(operations)
    localSender.flush()

    expect(localSettled.map((outcome) => outcome.ops.length)).toEqual([256, 44])
    expect(
      localSettled.every((outcome) => outcome.state === 'undeliverable')
    ).toBe(true)
    expect(
      localSettled
        .flatMap((outcome) => outcome.ops)
        .map((op) => ('node_id' in op ? op.node_id : null))
    ).toEqual(Array.from({ length: 300 }, (_, id) => id))
    expect(localSender.pending()).toBe(0)
    localSender.detach()
  })

  it('does not rechunk a prefix after serialization aborts and throws', () => {
    const localSettled: BatchOutcome[] = []
    const localSender = createOpSender({
      sendOps: () => true,
      onOpsResult: () => vi.fn(),
      workflowId: () => WORKFLOW,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: (outcome) => localSettled.push(outcome)
    })
    const first = addNode(1)
    let firstSerializations = 0
    first.node = {
      ...first.node,
      toJSON() {
        firstSerializations++
        return { id: 1, type: 'TestNode' }
      }
    }
    const second = addNode(2)
    let aborted = false
    second.node = {
      ...second.node,
      toJSON() {
        if (!aborted) {
          aborted = true
          localSender.abortAll()
        }
        throw new Error('serialization boom')
      }
    }

    localSender.admit([first, second])
    localSender.flush()

    expect(firstSerializations).toBe(2)
    expect(localSettled).toHaveLength(1)
    expect(localSettled[0].state).toBe('undeliverable')
    expect(localSettled[0].ops).toHaveLength(2)
    expect(localSender.pending()).toBe(0)
    localSender.detach()
  })

  it('sends an outer admission before work enqueued during serialization', () => {
    const localSent: Op[][] = []
    let localResultListener!: (result: OpsResultView) => void
    const localSender = createOpSender({
      sendOps: (_workflowId, _tab, ops) => {
        localSent.push(ops)
        return true
      },
      onOpsResult: (listener) => {
        localResultListener = listener
        return vi.fn()
      },
      workflowId: () => WORKFLOW,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: vi.fn()
    })
    const outer = addNode(1)
    let reentered = false
    outer.node = {
      ...outer.node,
      toJSON() {
        if (!reentered) {
          reentered = true
          localSender.enqueue([addNode(2)])
        }
        return { id: 1, type: 'TestNode' }
      }
    }

    localSender.enqueue([outer])
    expect(
      localSent.map((ops) => ('node_id' in ops[0] ? ops[0].node_id : null))
    ).toEqual([1])

    localResultListener({
      ok: true,
      applied: [localSent[0][0].op_id],
      skipped: []
    })
    expect(
      localSent.map((ops) => ('node_id' in ops[0] ? ops[0].node_id : null))
    ).toEqual([1, 2])
    localSender.detach()
  })

  it('resumes a pump requested during workflow-change sealing', () => {
    const localSent: Op[][] = []
    let workflow = 'wf-old'
    const localSender = createOpSender({
      sendOps: (_workflowId, _tab, ops) => {
        localSent.push(ops)
        return true
      },
      onOpsResult: () => vi.fn(),
      workflowId: () => workflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: vi.fn()
    })
    const outer = addNode(1)
    let reentered = false
    outer.node = {
      ...outer.node,
      toJSON() {
        if (!reentered) {
          reentered = true
          localSender.enqueue([addNode(3)])
        }
        return { id: 1, type: 'TestNode' }
      }
    }
    localSender.admit([outer])
    workflow = 'wf-new'

    localSender.admit([addNode(2)])

    expect(localSent).toHaveLength(1)
    expect('node_id' in localSent[0][0] ? localSent[0][0].node_id : null).toBe(
      1
    )
    localSender.detach()
  })

  it('contains a large malformed admission without argument spread overflow', () => {
    const operations = Array.from({ length: 140_000 }, (_, id) => addNode(id))
    let serializations = 0
    operations[0].node = {
      ...operations[0].node,
      toJSON() {
        serializations++
        if (serializations >= 3) throw new Error('stateful toJSON failed')
        return { id: 0, type: 'TestNode' }
      }
    }
    const circularNode = operations.at(-1)!
    const node: AddNodeOperation['node'] & Record<string, unknown> = {
      ...circularNode.node
    }
    node.circular = node
    circularNode.node = node

    sender.admit([addNode(-1)])
    expect(() => sender.admit(operations)).not.toThrow()

    expect(() => sender.flush()).not.toThrow()
    expect(settled.at(-1)?.state).toBe('undeliverable')
    expect(settled.every((outcome) => outcome.ops.length <= 256)).toBe(true)
  })

  it('queues the valid prefix before an invalid suffix settlement detaches', () => {
    const circularNode = addNode(2)
    const node: AddNodeOperation['node'] & Record<string, unknown> = {
      ...circularNode.node
    }
    node.circular = node
    circularNode.node = node
    const localSettled: BatchOutcome[] = []
    const localSender = createOpSender({
      sendOps: () => true,
      onOpsResult: () => vi.fn(),
      workflowId: () => boundWorkflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: (outcome) => {
        localSettled.push(outcome)
        if (outcome.ops.some((op) => 'node_id' in op && op.node_id === 2)) {
          localSender.detach()
        }
      }
    })

    localSender.admit([addNode(1), circularNode, addNode(3)])
    localSender.flush()

    expect(localSender.pending()).toBe(0)
    expect(localSettled.map(summarizeSettlement)).toEqual([
      { state: 'undeliverable', nodeIds: [2, 3] },
      { state: 'undeliverable', nodeIds: [1] }
    ])
  })

  it('contains unsubscribe failures after completing teardown', () => {
    const localSender = createOpSender({
      sendOps: () => true,
      onOpsResult: () => () => {
        throw new Error('unsubscribe boom')
      },
      workflowId: () => boundWorkflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: (outcome) => settled.push(outcome)
    })
    localSender.enqueue([addNode(1)])

    expect(() => localSender.detach()).not.toThrow()

    expect(localSender.pending()).toBe(0)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_unsubscribing_agent_op_sender'
      })
    )
  })

  it('abortAll settles the transmitted batch and every queued batch in mint order', () => {
    sender.enqueue([addNode(1)])
    sender.enqueue([addNode(2)])
    sender.enqueue([addNode(3)])
    expect(sent).toHaveLength(1)

    sender.abortAll()

    expect(sent).toHaveLength(1)
    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unconfirmed',
      'undeliverable',
      'undeliverable'
    ])
    expect(
      settled.map((outcome) =>
        outcome.ops.map((op) => ('node_id' in op ? op.node_id : undefined))
      )
    ).toEqual([[1], [2], [3]])
    expect(sender.pending()).toBe(0)

    sender.enqueue([addNode(4)])
    expect(sent).toHaveLength(2)
  })

  it('abortAll settles every other batch when one settlement listener throws', () => {
    const localSettled: BatchOutcome[] = []
    const localSender = createOpSender({
      sendOps: () => true,
      onOpsResult: () => vi.fn(),
      workflowId: () => boundWorkflow,
      tab: TAB,
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: (outcome) => {
        if (outcome.ops.some((op) => 'node_id' in op && op.node_id === 2))
          throw new Error('listener boom')
        localSettled.push(outcome)
      }
    })
    localSender.enqueue([addNode(1)])
    localSender.enqueue([addNode(2)])
    localSender.enqueue([addNode(3)])

    expect(() => localSender.abortAll()).not.toThrow()

    expect(localSettled.map(summarizeSettlement)).toEqual([
      { state: 'unconfirmed', nodeIds: [1] },
      { state: 'undeliverable', nodeIds: [3] }
    ])
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_settling_agent_op_sender_abort'
      })
    )
  })

  it('abortAll settles each chunk from one oversized admission', () => {
    sender.enqueue(Array.from({ length: 300 }, (_, index) => addNode(index)))

    sender.abortAll()

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unconfirmed',
      'undeliverable'
    ])
    expect(
      settled.map((outcome) =>
        outcome.ops.map((op) => ('node_id' in op ? op.node_id : undefined))
      )
    ).toEqual([
      Array.from({ length: 256 }, (_, index) => index),
      Array.from({ length: 44 }, (_, index) => index + 256)
    ])
  })

  it('detach settles an unflushed oversized admission in wire-sized chunks', () => {
    sender.admit(Array.from({ length: 300 }, (_, index) => addNode(index)))

    sender.detach()

    expect(settled.map((outcome) => outcome.ops.length)).toEqual([256, 44])
  })

  it('does not attribute a late anonymous result from an aborted batch to the next batch', () => {
    sender.enqueue([addNode(1)])
    sender.abortAll()
    sender.enqueue([addNode(2)])

    resultListener?.({ ok: false, applied: [], skipped: [] })

    expect(sender.pending()).toBe(1)
    expect(settled.map((outcome) => outcome.state)).toEqual(['unconfirmed'])
  })

  it('a late anonymous result from a batch aborted in flight never acknowledges its successor', () => {
    sender.enqueue([addNode(1)])
    expect(sent).toHaveLength(1)

    sender.abortAll()
    expect(settled.map((outcome) => outcome.state)).toEqual(['unconfirmed'])

    sender.enqueue([addNode(2)])
    sender.enqueue([addNode(3)])
    expect(sent).toHaveLength(2)
    expect(
      sent[1].ops.map((op) => ('node_id' in op ? op.node_id : undefined))
    ).toEqual([2])

    resultListener?.({ ok: false, applied: [], skipped: [] })

    expect(settled).toHaveLength(1)
    expect(sender.pending()).toBe(2)
    expect(sent).toHaveLength(2)

    ackInFlight()

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unconfirmed',
      'acknowledged'
    ])
    expect(sent).toHaveLength(3)
    expect(
      sent[2].ops.map((op) => ('node_id' in op ? op.node_id : undefined))
    ).toEqual([3])
  })

  it('a late identified result from a batch aborted in flight retires its credit and leaves the successor to its own result', () => {
    sender.enqueue([addNode(1)])
    const abortedOpIds = sent[0].ops.map((op) => op.op_id)

    sender.abortAll()
    sender.enqueue([addNode(2)])
    expect(sent).toHaveLength(2)

    resultListener?.({ ok: true, applied: abortedOpIds, skipped: [] })
    expect(settled).toHaveLength(1)
    expect(sender.pending()).toBe(1)

    resultListener?.({ ok: false, applied: [], skipped: [] })

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unconfirmed',
      'acknowledged'
    ])
    expect(sender.pending()).toBe(0)
  })

  it('an aborted batch whose resend never left the client reserves one late-result credit, not two', () => {
    sender.enqueue([addNode(1)])
    boundWorkflow = null
    vi.advanceTimersByTime(10_000)
    expect(sent).toHaveLength(1)
    expect(settled.map((outcome) => outcome.state)).toEqual(['unconfirmed'])

    boundWorkflow = WORKFLOW
    sender.enqueue([addNode(2)])
    expect(sent).toHaveLength(2)

    resultListener?.({ ok: false, applied: [], skipped: [] })
    resultListener?.({ ok: false, applied: [], skipped: [] })

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unconfirmed',
      'acknowledged'
    ])
  })

  it('an identified result for ops the sender never minted leaves the aborted batch its late-result credit', () => {
    sender.enqueue([addNode(1)])
    sender.abortAll()
    sender.enqueue([addNode(2)])
    expect(sent).toHaveLength(2)

    resultListener?.({ ok: true, applied: ['ffff'.repeat(8)], skipped: [] })
    resultListener?.({ ok: false, applied: [], skipped: [] })

    expect(settled.map((outcome) => outcome.state)).toEqual(['unconfirmed'])

    ackInFlight()

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unconfirmed',
      'acknowledged'
    ])
  })

  it('a transport that throws is reported once and retried like a refused send, never a stalled queue', () => {
    transportThrows = true

    expect(() => sender.enqueue([addNode(1)])).not.toThrow()

    expect(sent).toHaveLength(0)
    expect(vi.mocked(reportError)).toHaveBeenCalledExactlyOnceWith(
      new Error('frame serialization failed'),
      expect.objectContaining({ errorType: 'failure_sending_agent_human_ops' })
    )

    vi.advanceTimersByTime(1_500)

    expect(vi.mocked(reportError)).toHaveBeenCalledTimes(1)

    transportThrows = false
    vi.advanceTimersByTime(500)
    expect(sent).toHaveLength(1)

    ackInFlight()

    expect(settled.map((outcome) => outcome.state)).toEqual(['acknowledged'])
  })

  it('a batch acknowledged by its own op id after a resend still reserves a credit', () => {
    sender.enqueue([addNode(1)])
    vi.advanceTimersByTime(10_000)
    expect(sent).toHaveLength(2)

    ackInFlight()
    expect(settled.map((outcome) => outcome.state)).toEqual(['acknowledged'])

    sender.enqueue([addNode(2)])
    expect(sent).toHaveLength(3)
    resultListener?.({ ok: false, applied: [], skipped: [] })

    expect(settled.map((outcome) => outcome.state)).toEqual(['acknowledged'])
    expect(sender.pending()).toBe(1)
  })

  it('a batch acknowledged after a resend still reserves a credit for the send left unanswered', () => {
    sender.enqueue([addNode(1)])
    vi.advanceTimersByTime(10_000)
    expect(sent).toHaveLength(2)

    resultListener?.({ ok: false, applied: [], skipped: [] })
    expect(settled.map((outcome) => outcome.state)).toEqual(['acknowledged'])

    sender.enqueue([addNode(2)])
    expect(sent).toHaveLength(3)
    resultListener?.({ ok: false, applied: [], skipped: [] })

    expect(settled.map((outcome) => outcome.state)).toEqual(['acknowledged'])
    expect(sender.pending()).toBe(1)

    ackInFlight()

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'acknowledged',
      'acknowledged'
    ])
    expect(sender.pending()).toBe(0)
  })

  it('reports a throw that only starts on a retry, after the transport first refused', () => {
    transportUp = false

    sender.enqueue([addNode(1)])

    expect(vi.mocked(reportError)).not.toHaveBeenCalled()

    transportThrows = true
    vi.advanceTimersByTime(1_500)

    expect(sent).toHaveLength(0)
    expect(vi.mocked(reportError)).toHaveBeenCalledTimes(1)

    transportThrows = false
    transportUp = true
    vi.advanceTimersByTime(500)
    expect(sent).toHaveLength(1)

    ackInFlight()

    expect(settled.map((outcome) => outcome.state)).toEqual(['acknowledged'])
  })

  it('reports again when the silence resend throws, a second delivery', () => {
    // The first delivery has to throw and report before it succeeds, or the
    // resend reports from an unarmed flag and pins nothing.
    transportThrows = true
    sender.enqueue([addNode(1)])
    expect(vi.mocked(reportError)).toHaveBeenCalledTimes(1)

    transportThrows = false
    vi.advanceTimersByTime(500)
    expect(sent).toHaveLength(1)

    transportThrows = true
    vi.advanceTimersByTime(10_000)

    expect(vi.mocked(reportError)).toHaveBeenCalledTimes(2)
  })

  it('does not report again when resume continues the delivery suspend parked', () => {
    transportThrows = true
    sender.enqueue([addNode(1)])
    expect(vi.mocked(reportError)).toHaveBeenCalledTimes(1)

    sender.suspend()
    vi.advanceTimersByTime(500)
    sender.resume()

    expect(sent).toHaveLength(0)
    expect(vi.mocked(reportError)).toHaveBeenCalledTimes(1)
  })

  it('never settles a batch with a result whose ops it does not own', () => {
    const anonymousFailure = () =>
      resultListener?.({ ok: false, applied: [], skipped: [] })

    // A leaves two sends on the wire and settles on the first answer, so the
    // second is still owed to it.
    sender.enqueue([addNode(1)])
    vi.advanceTimersByTime(10_000)
    anonymousFailure()

    // A's second answer arrives while B holds the slot. It is A's, not B's.
    sender.enqueue([addNode(2)])
    anonymousFailure()

    // B likewise settles on its resend's answer, still owed one.
    vi.advanceTimersByTime(10_000)
    anonymousFailure()

    // B's second answer must not be read as C's.
    sender.enqueue([addNode(3)])
    anonymousFailure()

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'acknowledged',
      'acknowledged'
    ])
    expect(sender.pending()).toBe(1)
  })

  describe('suspension', () => {
    function parkSecondBatch(): string {
      sender.enqueue([addNode(1)])
      sender.enqueue([addNode(2)])
      sender.suspend()
      boundWorkflow = null
      ackInFlight()
      return sender.pendingOps()[0].ops[0].op_id
    }

    it('parks the next batch instead of settling it undeliverable while suspended, and a result still settles the sent one', () => {
      parkSecondBatch()

      expect(sent).toHaveLength(1)
      expect(settled.map((outcome) => outcome.state)).toEqual(['acknowledged'])
      expect(sender.pending()).toBe(1)
    })

    it('does not attribute an anonymous result to a parked batch that was never sent', () => {
      parkSecondBatch()

      resultListener?.({ ok: false, applied: [], skipped: [] })

      expect(sent).toHaveLength(1)
      expect(settled.map((outcome) => outcome.state)).toEqual(['acknowledged'])
      expect(sender.pending()).toBe(1)
    })

    it('resume transmits the parked batch to its mint-time workflow with the same op ids', () => {
      const parkedOpId = parkSecondBatch()
      boundWorkflow = WORKFLOW

      sender.resume()

      expect(sent).toHaveLength(2)
      expect(sent[1].workflowId).toBe(WORKFLOW)
      expect(sent[1].ops[0].op_id).toBe(parkedOpId)
      expect(settled).toHaveLength(1)
    })

    it('resume after a real retarget still settles the parked batch undeliverable, never re-addressed', () => {
      parkSecondBatch()
      boundWorkflow = 'wf-2'

      sender.resume()

      expect(sent).toHaveLength(1)
      expect(settled.map((outcome) => outcome.state)).toEqual([
        'acknowledged',
        'undeliverable'
      ])
    })

    it('parks the result-silence resend of a sent batch and resends it on resume', () => {
      sender.enqueue([addNode(1)])
      sender.suspend()
      boundWorkflow = null
      vi.advanceTimersByTime(10_000)
      expect(sent).toHaveLength(1)
      expect(settled).toHaveLength(0)

      boundWorkflow = WORKFLOW
      sender.resume()

      expect(sent).toHaveLength(2)
      expect(sent[1].ops[0].op_id).toBe(sent[0].ops[0].op_id)
    })

    it('detach settles a parked batch undeliverable instead of dropping it', () => {
      parkSecondBatch()

      sender.detach()
      boundWorkflow = WORKFLOW
      sender.resume()

      expect(sent).toHaveLength(1)
      expect(sender.pending()).toBe(0)
      expect(settled.map((outcome) => outcome.state)).toEqual([
        'acknowledged',
        'undeliverable'
      ])
    })

    it('suspend and resume are idempotent and leave an unsuspended sender sending', () => {
      sender.suspend()
      sender.suspend()
      sender.resume()
      sender.resume()

      sender.enqueue([addNode(1)])

      expect(sent).toHaveLength(1)
      expect(settled).toHaveLength(0)
    })

    it('pendingOps lists the in-flight and queued batches with their workflow, in order, until they settle', () => {
      sender.enqueue([addNode(1)])
      sender.enqueue([addNode(2)])

      expect(sender.pendingOps()).toEqual([
        {
          workflowId: WORKFLOW,
          ops: [expect.objectContaining({ op: 'add_node', node_id: 1 })]
        },
        {
          workflowId: WORKFLOW,
          ops: [expect.objectContaining({ op: 'add_node', node_id: 2 })]
        }
      ])

      ackInFlight()
      ackInFlight()

      expect(sender.pendingOps()).toEqual([])
    })
  })
})
