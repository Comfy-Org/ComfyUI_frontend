/**
 * Sender <-> outbox wiring (mutref-3 / M7 s2). A real sender and a real
 * outbox, joined only by the hooks under test. The behaviour that matters:
 * a batch the transport never carried is parked with its minted op ids and,
 * on replay, reaches the wire with THOSE ids — never re-minted, never toward
 * another workflow — and a replay the sender cannot deliver parks it again.
 */
import type { Op } from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { createHumanOpOutbox, createMemoryOutboxStore } from './humanOpOutbox'
import type { HumanOpOutbox } from './humanOpOutbox'
import { outboxSenderHooks, replayParkedOps } from './humanOpOutboxWiring'
import { createOpSender } from './opSender'
import type { OpSender, OpsResultView } from './opSender'

const WORKFLOW = 'wf-1'
const OTHER_WORKFLOW = 'wf-2'
// Five failed sends 500 ms apart retire an in-flight batch `undeliverable`.
const UNDELIVERABLE_AFTER_MS = 5 * 500

function addNode(id: number): GraphOperation {
  return {
    op: 'add_node',
    node_id: id,
    class_type: 'TestNode',
    pos: [0, 0],
    node: { id, type: 'TestNode' }
  }
}

const opIds = (ops: readonly Op[]): string[] => ops.map((op) => op.op_id)

describe('humanOpOutboxWiring', () => {
  let sent: Array<{ workflowId: string; ops: Op[] }>
  let resultListener: ((result: OpsResultView) => void) | null
  let transportUp: boolean
  let boundWorkflow: string | null
  let outbox: HumanOpOutbox
  let sender: OpSender

  function ackLastSend(): void {
    const last = sent[sent.length - 1]
    resultListener?.({ ok: true, applied: opIds(last.ops), skipped: [] })
  }

  function stateOf(workflowId = WORKFLOW): string[] {
    return outbox
      .entries()
      .filter((entry) => entry.workflowId === workflowId)
      .map((entry) => entry.state)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    sent = []
    resultListener = null
    transportUp = true
    boundWorkflow = WORKFLOW
    outbox = createHumanOpOutbox({
      store: createMemoryOutboxStore(),
      key: 'outbox:test'
    })
    sender = createOpSender({
      sendOps: (workflowId, _tab, ops) => {
        if (!transportUp) return false
        sent.push({ workflowId, ops })
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
      ...outboxSenderHooks(outbox)
    })
  })

  afterEach(() => {
    sender.detach()
  })

  it('records a batch at mint time and removes it once the host applies it', () => {
    sender.enqueue([addNode(1), addNode(2)])

    expect(sent).toHaveLength(1)
    expect(stateOf()).toEqual(['queued', 'queued'])
    expect(opIds(outbox.entries().map((e) => e.op))).toEqual(opIds(sent[0].ops))

    ackLastSend()
    expect(outbox.entries()).toEqual([])
  })

  it('does not record a batch minted while no doc is bound: there is nothing to replay it toward', () => {
    boundWorkflow = null
    sender.enqueue([addNode(1)])

    expect(sent).toHaveLength(0)
    expect(outbox.entries()).toEqual([])
  })

  it('parks an undeliverable batch and replays it with the SAME op ids, never re-minting', () => {
    transportUp = false
    sender.enqueue([addNode(1), addNode(2)])
    vi.advanceTimersByTime(UNDELIVERABLE_AFTER_MS)

    expect(sent).toHaveLength(0)
    expect(stateOf()).toEqual(['parked', 'parked'])
    const mintedIds = opIds(outbox.replayable(WORKFLOW).map((e) => e.op))
    expect(mintedIds).toHaveLength(2)

    transportUp = true
    expect(replayParkedOps(outbox, sender, WORKFLOW)).toBe(2)

    expect(sent).toHaveLength(1)
    expect(sent[0].workflowId).toBe(WORKFLOW)
    expect(opIds(sent[0].ops)).toEqual(mintedIds)
    // Replay is a first delivery again as far as the settle is concerned.
    expect(stateOf()).toEqual(['queued', 'queued'])
    expect(outbox.replayable(WORKFLOW)).toEqual([])

    ackLastSend()
    expect(outbox.entries()).toEqual([])
  })

  it('refuses to replay toward a workflow that is no longer bound and parks the ops again (FC-5)', () => {
    transportUp = false
    sender.enqueue([addNode(1)])
    vi.advanceTimersByTime(UNDELIVERABLE_AFTER_MS)
    expect(stateOf()).toEqual(['parked'])

    transportUp = true
    boundWorkflow = OTHER_WORKFLOW
    expect(replayParkedOps(outbox, sender, WORKFLOW)).toBe(1)

    expect(sent).toHaveLength(0)
    expect(stateOf()).toEqual(['parked'])
    expect(stateOf(OTHER_WORKFLOW)).toEqual([])
  })

  it('replays nothing for a workflow with no parked ops and leaves rejected members alone', () => {
    sender.enqueue([addNode(1), addNode(2)])
    const [first, second] = sent[0].ops
    resultListener?.({
      ok: false,
      applied: [first.op_id],
      skipped: [],
      failure: { op_id: second.op_id }
    })
    expect(stateOf()).toEqual(['rejected'])

    expect(replayParkedOps(outbox, sender, WORKFLOW)).toBe(0)
    expect(sent).toHaveLength(1)
    expect(stateOf()).toEqual(['rejected'])
  })
})
