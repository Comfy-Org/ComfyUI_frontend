import type { Op } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { createOpCoalescer } from './opCoalescer'
import { WIRE_MAX_OPS_PER_BATCH } from './opEnvelope'
import { createOpSender } from './opSender'
import type { BatchOutcome, OpSender, OpsResultView } from './opSender'

const WORKFLOW = 'wf-1'

function deleteNode(id: number): GraphOperation {
  return { op: 'delete_node', node_id: id, removed_links: [] }
}

function nodeIds(ops: Op[]): unknown[] {
  return ops.map((op) => ('node_id' in op ? op.node_id : undefined))
}

const flushMicrotasks = () => Promise.resolve()

describe('createOpCoalescer over the op sender', () => {
  let sent: Op[][]
  let settled: BatchOutcome[]
  let resultListener: ((result: OpsResultView) => void) | null
  let boundWorkflow: string | null
  let sender: OpSender
  let coalescer: ReturnType<typeof createOpCoalescer>

  function ackInFlight(): void {
    resultListener?.({
      ok: true,
      applied: sent[sent.length - 1].map((op) => op.op_id),
      skipped: []
    })
  }

  beforeEach(() => {
    sent = []
    settled = []
    resultListener = null
    boundWorkflow = WORKFLOW
    sender = createOpSender({
      sendOps: (_workflowId, _tab, ops) => {
        sent.push(ops)
        return true
      },
      onOpsResult: (listener) => {
        resultListener = listener
        return () => {
          resultListener = null
        }
      },
      workflowId: () => boundWorkflow,
      tab: 'tab-1',
      actor: () => 'human:test-user:tab-1',
      baseVersion: () => 41,
      onBatchSettled: (outcome) => settled.push(outcome)
    })
    coalescer = createOpCoalescer(sender.admit, sender.flush)
  })

  it('sends eight same-tick single-op mints as one doc_ops batch in mint order', async () => {
    for (let id = 1; id <= 8; id++) coalescer.enqueue([deleteNode(id)])
    expect(sent).toHaveLength(0)

    await flushMicrotasks()

    expect(sent).toHaveLength(1)
    expect(nodeIds(sent[0])).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(sender.pending()).toBe(1)
  })

  it('keeps mints from different ticks as separate ordered batches', async () => {
    for (let id = 1; id <= 3; id++) coalescer.enqueue([deleteNode(id)])
    await flushMicrotasks()
    for (let id = 4; id <= 8; id++) coalescer.enqueue([deleteNode(id)])
    await flushMicrotasks()

    expect(sent).toHaveLength(1)
    expect(nodeIds(sent[0])).toEqual([1, 2, 3])
    ackInFlight()
    expect(sent).toHaveLength(2)
    expect(nodeIds(sent[1])).toEqual([4, 5, 6, 7, 8])
  })

  it('settles the whole buffered batch undeliverable once when the doc unbinds before the flush', async () => {
    for (let id = 1; id <= 8; id++) coalescer.enqueue([deleteNode(id)])
    boundWorkflow = null

    await flushMicrotasks()

    expect(sent).toHaveLength(0)
    expect(settled).toHaveLength(1)
    expect(settled[0].state).toBe('undeliverable')
    expect(nodeIds(settled[0].ops)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('sends nothing but settles the admitted batch undeliverable when detached before the flush', async () => {
    coalescer.enqueue([deleteNode(1)])
    coalescer.enqueue([deleteNode(2)])
    coalescer.enqueue([deleteNode(3)])
    coalescer.enqueue([deleteNode(4)])
    coalescer.enqueue([deleteNode(5)])
    coalescer.enqueue([deleteNode(6)])
    coalescer.enqueue([deleteNode(7)])
    coalescer.enqueue([deleteNode(8)])
    sender.detach()
    coalescer.detach()

    await flushMicrotasks()

    expect(sent).toHaveLength(0)
    expect(settled).toHaveLength(1)
    expect(settled[0].state).toBe('undeliverable')
    expect(nodeIds(settled[0].ops)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(sender.pending()).toBe(0)
  })

  it('splits a same-tick batch at the wire cap into independent serialized batches', async () => {
    const total = WIRE_MAX_OPS_PER_BATCH + 1
    for (let id = 1; id <= total; id++) coalescer.enqueue([deleteNode(id)])

    await flushMicrotasks()

    expect(sent).toHaveLength(1)
    expect(sent[0]).toHaveLength(WIRE_MAX_OPS_PER_BATCH)
    expect(sender.pending()).toBe(2)
    ackInFlight()
    expect(sent).toHaveLength(2)
    expect(nodeIds(sent[1])).toEqual([total])
    expect(sender.pending()).toBe(1)
  })
})
