import type { Op } from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { createOpSender } from './opSender'
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

  it('routes an identified result after the batch became delivery-unknown', () => {
    sender.enqueue([addNode(1)])
    const opId = sent[0].ops[0].op_id
    vi.advanceTimersByTime(20_000)

    resultListener?.({
      ok: false,
      applied: [],
      skipped: [],
      failure: { op_id: opId }
    })

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unacknowledged',
      'acknowledged'
    ])
  })

  it('a repeated identified late result drains its credit instead of starving a newer batch', () => {
    sender.enqueue([addNode(1)])
    const lateOpId = sent[0].ops[0].op_id
    vi.advanceTimersByTime(20_000)
    expect(settled.map((outcome) => outcome.state)).toEqual(['unacknowledged'])

    sender.enqueue([addNode(2)])
    const lateResult = { ok: true, applied: [lateOpId], skipped: [] }
    resultListener?.(lateResult)
    resultListener?.(lateResult)

    resultListener?.({ ok: false, applied: [], skipped: [] })

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unacknowledged',
      'acknowledged',
      'acknowledged'
    ])
    expect(settled[2].state === 'acknowledged' && settled[2].result.ok).toBe(
      false
    )
    expect(settled[2].ops.map((op) => op.op_id)).not.toContain(lateOpId)
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

  describe('pending-op lifecycle hooks (s3-opt-6)', () => {
    let trace: string[]

    function hookedSender(): ReturnType<typeof createOpSender> {
      sender.detach()
      return createOpSender({
        sendOps: (workflowId, tab, ops) => {
          if (!transportUp) return false
          sent.push({ workflowId, tab, ops })
          trace.push(`send:${ops.map((op) => op.op_id).join(',')}`)
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
        onBatchMinted: (ops) =>
          trace.push(`minted:${ops.map((op) => op.op_id).join(',')}`),
        onBatchTransmitted: (ops) =>
          trace.push(`transmitted:${ops.map((op) => op.op_id).join(',')}`),
        onBatchSettled: (outcome) => {
          settled.push(outcome)
          trace.push(`settled:${outcome.state}`)
        }
      })
    }

    beforeEach(() => {
      trace = []
    })

    it('reports minted ids before the transport sees them, then each accepted send', () => {
      sender = hookedSender()
      sender.enqueue([addNode(1), addNode(2)])
      const ids = sent[0].ops.map((op) => op.op_id).join(',')

      expect(trace).toEqual([
        `minted:${ids}`,
        `send:${ids}`,
        `transmitted:${ids}`
      ])
    })

    it('reports minted ids even when no doc is bound, before the undeliverable settle', () => {
      boundWorkflow = null
      sender = hookedSender()
      sender.enqueue([addNode(1)])

      expect(trace.map((step) => step.split(':')[0])).toEqual([
        'minted',
        'settled'
      ])
      expect(settled[0].state).toBe('undeliverable')
    })

    it('does not report a transmission the transport refused', () => {
      transportUp = false
      sender = hookedSender()
      sender.enqueue([addNode(1)])
      expect(trace.some((step) => step.startsWith('transmitted'))).toBe(false)

      transportUp = true
      vi.advanceTimersByTime(500)
      expect(
        trace.filter((step) => step.startsWith('transmitted'))
      ).toHaveLength(1)
    })

    it('reports the silent-result resend as a second transmission of the same ids', () => {
      sender = hookedSender()
      sender.enqueue([addNode(1)])
      vi.advanceTimersByTime(10_000)

      const transmissions = trace.filter((step) =>
        step.startsWith('transmitted')
      )
      expect(transmissions).toHaveLength(2)
      expect(transmissions[0]).toBe(transmissions[1])
      expect(trace.filter((step) => step.startsWith('minted'))).toHaveLength(1)
    })
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
    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unconfirmed',
      'acknowledged'
    ])
    expect(sender.pending()).toBe(1)

    resultListener?.({ ok: false, applied: [], skipped: [] })

    expect(settled.map((outcome) => outcome.state)).toEqual([
      'unconfirmed',
      'acknowledged',
      'acknowledged'
    ])
    expect(sender.pending()).toBe(0)
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

    it('detach drops a parked batch', () => {
      parkSecondBatch()

      sender.detach()
      boundWorkflow = WORKFLOW
      sender.resume()

      expect(sent).toHaveLength(1)
      expect(sender.pending()).toBe(0)
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
