import type { Op } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import type { GraphMutations } from './graphMutations'
import { render } from '@testing-library/vue'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import type { GraphOperation } from './graphOperations'

const bridgeState = vi.hoisted(() => {
  const transport = { up: true }
  class FakeBridge extends EventTarget {
    subscribe = vi.fn((workflowId: string) => {
      if (!transport.up) return
      this.subscribedWorkflowId = workflowId
      this.lastSequence = 0
    })

    unsubscribe = vi.fn(() => {
      this.subscribedWorkflowId = null
    })

    resubscribe = vi.fn()
    reconcile = vi.fn()
    destroy = vi.fn()
    subscribedWorkflowId: string | null = null
    lastSequence = 0
    follower = {
      updatesApplied: 0,
      doc: {
        getMap: () => ({ toJSON: () => ({}) })
      }
    }
  }

  return {
    FakeBridge,
    current: null as InstanceType<typeof FakeBridge> | null,
    transport
  }
})

const clientState = vi.hoisted(() => ({
  destroy: vi.fn(),
  transportUp: true,
  attempts: [] as Array<{ workflowId: string; tab: string; ops: Op[] }>,
  sent: [] as Array<{ workflowId: string; tab: string; ops: Op[] }>,
  sendOps: vi.fn((workflowId: string, tab: string, ops: Op[]) => {
    clientState.attempts.push({ workflowId, tab, ops })
    if (!clientState.transportUp) return false
    clientState.sent.push({ workflowId, tab, ops })
    return true
  })
}))

const adapterState = vi.hoisted(() => ({
  bind: vi.fn(),
  unbind: vi.fn(),
  applyFrame: vi.fn(),
  clearForReset: vi.fn(),
  discardPending: vi.fn(),
  destroy: vi.fn()
}))

const devLogState = vi.hoisted(() => ({
  recordDevEvent: vi.fn()
}))

const apiState = vi.hoisted(() => {
  const target = new EventTarget()
  return {
    target,
    api: {
      socket: { readyState: 1, send: vi.fn() },
      addCustomEventListener: vi.fn(),
      removeCustomEventListener: vi.fn(),
      addEventListener: (type: string, listener: EventListener) =>
        target.addEventListener(type, listener),
      removeEventListener: vi.fn((type: string, listener: EventListener) =>
        target.removeEventListener(type, listener)
      )
    }
  }
})

vi.mock<unknown>(import('./layoutFollowerBridge'), () => ({
  LayoutFollowerBridge: class {
    constructor() {
      const bridge = new bridgeState.FakeBridge()
      bridgeState.current = bridge
      return bridge
    }
  }
}))

vi.mock<unknown>(import('./docFrameClient'), () => ({
  DocFrameClient: class {
    destroy = clientState.destroy
    sendOps = clientState.sendOps
  }
}))

vi.mock<unknown>(import('./ecsFollowerAdapter'), () => ({
  EcsFollowerAdapter: class {
    bind = adapterState.bind
    unbind = adapterState.unbind
    applyFrame = adapterState.applyFrame
    clearForReset = adapterState.clearForReset
    discardPending = adapterState.discardPending
    destroy = adapterState.destroy
  }
}))

vi.mock(import('./devPanelLog'), () => ({
  recordDevEvent: devLogState.recordDevEvent
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({ api: apiState.api }))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { graph: null, canvas: null }
}))

import { useAgentCrdtFollower } from './useAgentCrdtFollower'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

const graphMutations = {} as GraphMutations

function deleteNode(nodeId: string): GraphOperation {
  return {
    op: 'delete_node',
    node_id: nodeId,
    removed_links: []
  }
}

function mountFollower(initial: string): {
  unmount: () => void
  workflowId: Ref<string | null>
  enqueue: (operations: GraphOperation[]) => Promise<void>
  status: () => AgentCrdtStatus
} {
  const workflowId = ref<string | null>(initial)
  let enqueue!: (operations: GraphOperation[]) => Promise<void>
  let exposedStatus!: () => AgentCrdtStatus
  const host = defineComponent({
    setup() {
      const { enqueueHumanOperations, status } = useAgentCrdtFollower(
        workflowId,
        graphMutations
      )
      enqueue = async (operations) => {
        enqueueHumanOperations(operations)
        await Promise.resolve()
      }
      exposedStatus = () => status.value as AgentCrdtStatus
      return () => null
    }
  })
  const { unmount } = render(host)
  onTestFinished(unmount)
  return { unmount, workflowId, enqueue, status: exposedStatus }
}

async function switchWorkflow(workflowId: Ref<string | null>, next: string) {
  workflowId.value = next
  await nextTick()
}

function bridge(): InstanceType<(typeof bridgeState)['FakeBridge']> {
  const current = bridgeState.current
  if (!current) throw new Error('no bridge constructed')
  return current
}

function dispatchOpsResult(detail: unknown): void {
  bridge().dispatchEvent(new CustomEvent('doc_ops_result', { detail }))
}

describe('R-73 cross-workflow pending operations', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
    bridgeState.current = null
    bridgeState.transport.up = true
    clientState.transportUp = true
    clientState.attempts = []
    clientState.sent = []
    clientState.sendOps.mockClear()
    devLogState.recordDevEvent.mockClear()
    vi.useFakeTimers()
  })

  it('cancels pending sends and rejects new operations while the product gate is off', async () => {
    const store = useAgentPanelStore()
    const { enqueue, status } = mountFollower('wf-a')
    clientState.transportUp = false
    await enqueue([deleteNode('queued-before-revocation')])
    expect(clientState.attempts).toHaveLength(1)

    store.enabled = false
    clientState.transportUp = true
    await enqueue([deleteNode('attempted-while-disabled')])
    vi.advanceTimersByTime(60_000)
    expect(status().enabled).toBe(false)
    expect(clientState.attempts).toHaveLength(1)
    expect(clientState.sent).toHaveLength(0)

    store.enabled = true
    await enqueue([deleteNode('new-lifetime')])
    expect(clientState.sent).toHaveLength(1)
    expect(clientState.sent[0].ops).toMatchObject([
      { op: 'delete_node', node_id: 'new-lifetime' }
    ])
  })

  it('does not retarget a transport retry after workflow A switches to workflow B', async () => {
    const { workflowId, enqueue } = mountFollower('wf-a')
    bridgeState.transport.up = false
    clientState.transportUp = false

    await enqueue([deleteNode('a-queued')])
    expect(clientState.sent).toHaveLength(0)
    expect(clientState.attempts).toHaveLength(1)
    const operationId = clientState.attempts[0].ops[0].op_id

    await switchWorkflow(workflowId, 'wf-b')
    bridgeState.transport.up = true
    clientState.transportUp = true
    vi.advanceTimersByTime(500)

    // R-73 was filed against PR #16332's switch site. On main f954e479a,
    // opSender keeps the workflow captured at enqueue time, so this half of
    // the suspected A-to-B contamination is already a regression guard.
    expect(bridge().subscribe).toHaveBeenLastCalledWith('wf-b')
    expect(clientState.sent).toHaveLength(1)
    expect(clientState.sent[0]).toMatchObject({ workflowId: 'wf-a' })
    expect(clientState.sent[0].ops[0]).toMatchObject({
      op_id: operationId,
      op: 'delete_node',
      node_id: 'a-queued'
    })
  })

  it('guards status from a late workflow A result while workflow B is active', async () => {
    const { workflowId, enqueue, status } = mountFollower('wf-a')

    bridge().lastSequence = 41
    await enqueue([deleteNode('a-inflight')])
    expect(clientState.sent[0].ops[0]).toMatchObject({ base_version: 41 })
    const operationAId = clientState.sent[0].ops[0].op_id
    await switchWorkflow(workflowId, 'wf-b')

    // The switch itself settles A's transmitted in-flight batch unconfirmed
    // (the composable calls sender.abortIfUnbound() after retargeting the
    // bridge), so B's batch goes out at once instead of queueing behind A for
    // the 10 s result-silence window.
    expect(devLogState.recordDevEvent).toHaveBeenCalledWith(
      'human_ops_settled',
      {
        state: 'unconfirmed',
        ops: [expect.objectContaining({ op_id: operationAId })]
      }
    )
    await enqueue([deleteNode('b-pending')])
    expect(clientState.sent).toHaveLength(2)
    expect(clientState.sent[1]).toMatchObject({ workflowId: 'wf-b' })
    expect(clientState.sent[1].ops[0]).toMatchObject({ base_version: 0 })
    const operationBId = clientState.sent[1].ops[0].op_id

    dispatchOpsResult({
      workflowId: 'wf-a',
      ok: true,
      applied: [operationAId],
      skipped: []
    })

    // A's late result names A's op_id, which is not in B's in-flight batch,
    // so the sender ignores it: B stays in flight and nothing else settles.
    expect(
      devLogState.recordDevEvent.mock.calls.filter(
        ([event]) => event === 'human_ops_settled'
      )
    ).toHaveLength(1)

    // R-73 regression guard: result frames carry workflowId, and the guard
    // added alongside this test (onOpsResult in useAgentCrdtFollower.ts)
    // drops a result whose workflowId no longer matches the subscribed
    // workflow, so workflow B's status is never updated from workflow A's
    // late frame, and the composable never re-emits that frame as a
    // 'doc_ops_result' dev event.
    expect(status()).toMatchObject({
      workflowId: 'wf-b',
      lastFrameType: null
    })
    expect(devLogState.recordDevEvent).not.toHaveBeenCalledWith(
      'doc_ops_result',
      {
        workflowId: 'wf-a',
        ok: true,
        applied: [operationAId],
        skipped: []
      }
    )
    expect(operationBId).not.toBe(operationAId)
  })

  it('does not settle workflow B from an anonymous workflow A result', async () => {
    const { workflowId, enqueue } = mountFollower('wf-a')

    await enqueue([deleteNode('a-inflight')])
    const operationAId = clientState.sent[0].ops[0].op_id
    // The switch settles A unconfirmed (settlement 0) and B goes out at once.
    await switchWorkflow(workflowId, 'wf-b')
    await enqueue([deleteNode('b-pending')])
    const operationBId = clientState.sent[1].ops[0].op_id

    // A's identified late result is ignored: its op_id is not in B's batch.
    dispatchOpsResult({
      workflowId: 'wf-a',
      ok: true,
      applied: [operationAId],
      skipped: []
    })

    dispatchOpsResult({
      workflowId: 'wf-a',
      ok: false,
      applied: [],
      skipped: []
    })

    expect(
      devLogState.recordDevEvent.mock.calls.filter(
        ([event]) => event === 'human_ops_settled'
      )
    ).toHaveLength(1)

    dispatchOpsResult({
      workflowId: 'wf-b',
      ok: false,
      applied: [],
      skipped: []
    })

    const settlements = devLogState.recordDevEvent.mock.calls.filter(
      ([event]) => event === 'human_ops_settled'
    )
    expect(settlements).toHaveLength(2)
    expect(settlements[1][1]).toMatchObject({
      state: 'acknowledged',
      ops: [expect.objectContaining({ op_id: operationBId })],
      result: { workflowId: 'wf-b', ok: false, applied: [], skipped: [] }
    })
  })
})

// `abortIfUnbound()` (opSender.ts) settles an in-flight batch
// 'undeliverable' purely because its mint-time workflow no longer matches
// the currently bound one - without checking whether the transport had
// already carried it, or whether the server ever committed it. A batch that
// was accepted by `sendOps()` (so it left the client) and that the server
// later confirms applying is still reported 'undeliverable', contradicting
// that outcome's own contract ("the transport never carried it ... or no doc
// was bound", opSender.ts:57-58). For a bulk add (paste/insert-workflow)
// racing a doc unbind/resubscribe, this is the mechanism that leaves an
// orphaned node in the CRDT doc while the client believes the add failed.
describe('abortIfUnbound settles delivered ops as undeliverable', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
    bridgeState.current = null
    bridgeState.transport.up = true
    clientState.transportUp = true
    clientState.attempts = []
    clientState.sent = []
    clientState.sendOps.mockClear()
    devLogState.recordDevEvent.mockClear()
    vi.useFakeTimers()
  })

  it('a batch the transport already accepted is never later reported undeliverable, even across a workflow retarget', async () => {
    const { workflowId, enqueue } = mountFollower('wf-a')

    await enqueue([deleteNode('a-inflight')])
    // The transport accepted the batch: sendOps() returned true and it is
    // recorded as sent, not merely attempted.
    expect(clientState.sent).toHaveLength(1)
    const operationAId = clientState.sent[0].ops[0].op_id

    // Retargeting the bound doc calls sender.abortIfUnbound(), which settles
    // the still in-flight, already-transmitted batch at once without asking
    // the server what happened to it.
    await switchWorkflow(workflowId, 'wf-b')

    const settlement = devLogState.recordDevEvent.mock.calls.find(
      ([event]) => event === 'human_ops_settled'
    )
    expect(settlement).toBeDefined()

    // The server now confirms, after the fact, that it DID commit the op.
    dispatchOpsResult({
      workflowId: 'wf-a',
      ok: true,
      applied: [operationAId],
      skipped: []
    })

    // Desired behavior: a batch the transport already carried, and that
    // the server confirms applying, must never have been reported
    // 'undeliverable'. It was today.
    expect(settlement?.[1].state).not.toBe('undeliverable')
  })
})

/**
 * The FakeBridge's `resubscribe` is a bare vi.fn, so a test that wants the
 * post-reconnect subscribe ack must play the host's part itself: mark the
 * workflow subscribed again and forward the `doc_subscribed` ok frame the
 * bridge would have re-emitted.
 */
function ackResubscribe(workflowId: string): void {
  bridge().subscribedWorkflowId = workflowId
  bridge().dispatchEvent(
    new CustomEvent('doc_subscribed', {
      detail: { workflowId, ok: true, seq: 0 }
    })
  )
}

/**
 * Extracted from the human-op outbox stack (PRs #18510, #18519, #18533,
 * #18545), which is parked rather than landing: it was built on the
 * store-first mint path the remote-apply refactor replaces.
 *
 * The stack's own unit tests -- the outbox's entry-state table, its
 * write-through persistence structure, its session-storage TTL -- assert that
 * parked design and are deliberately not carried over. What is carried over is
 * the one property that is about the user rather than about the mechanism, and
 * that is true of any design that solves this: an edit I made while the
 * connection was down is not silently lost.
 *
 * Today it is. The sender's five-retry budget is a delivery budget, not a
 * retention budget; once it runs out the batch settles `undeliverable` and
 * nothing holds it. The two tests below pin both halves -- what happens now,
 * and what should -- so the refactor can flip the second one green and the
 * first one goes red in the same change.
 */
describe('a human edit made while the document connection is down', () => {
  // The sender gives an in-flight batch five retries 500 ms apart before it
  // retires the batch `undeliverable`.
  const RETRY_BUDGET_MS = 5 * 500

  beforeEach(() => {
    useAgentPanelStore().enabled = true
    bridgeState.current = null
    bridgeState.transport.up = true
    clientState.transportUp = true
    clientState.attempts = []
    clientState.sent = []
    clientState.sendOps.mockClear()
    devLogState.recordDevEvent.mockClear()
    vi.useFakeTimers()
  })

  it('is abandoned once the retry budget runs out, and nothing retains it', async () => {
    const { enqueue } = mountFollower('wf-a')
    clientState.transportUp = false

    await enqueue([deleteNode('edited-during-outage')])
    // First send plus five retries, every one refused by the transport.
    vi.advanceTimersByTime(RETRY_BUDGET_MS)
    expect(clientState.attempts).toHaveLength(6)
    expect(clientState.sent).toHaveLength(0)

    const operationId = clientState.attempts[0].ops[0].op_id
    expect(devLogState.recordDevEvent).toHaveBeenCalledWith(
      'human_ops_settled',
      expect.objectContaining({
        state: 'undeliverable',
        ops: [expect.objectContaining({ op_id: operationId })]
      })
    )

    // The socket comes back and the host confirms the document is bound
    // again. The edit does not go with it: it is gone.
    clientState.transportUp = true
    apiState.target.dispatchEvent(new Event('reconnected'))
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
    ackResubscribe('wf-a')
    expect(clientState.sent).toHaveLength(0)
  })

  /**
   * These two gaps are split rather than asserted in one `it.fails`, because
   * `it.fails` passes on the FIRST failure and abandons the rest of the body.
   * Bundled, the delivery assertion below fails while `clientState.sent` is
   * still empty, so the `op_id`-retention and exactly-once assertions never
   * execute -- and an implementation that delivers the op but re-mints its
   * `op_id` would still report as an expected failure, hiding a FORECLOSE #7
   * violation behind a green run.
   *
   * Both remain `it.fails` today: nothing is delivered at all, so the second
   * test cannot reach its own subject either. The point of the split is that
   * once delivery lands, each property fails -- and gets fixed -- on its own
   * name instead of one masking the other.
   */
  it.fails('KNOWN GAP: reaches the host after reconnect', async () => {
    const { enqueue } = mountFollower('wf-a')
    clientState.transportUp = false

    await enqueue([deleteNode('edited-during-outage')])
    vi.advanceTimersByTime(RETRY_BUDGET_MS)
    expect(clientState.sent).toHaveLength(0)

    // `reconnected` alone only re-drives the subscribe; nothing may go out
    // until the host acks that the document is bound again.
    clientState.transportUp = true
    apiState.target.dispatchEvent(new Event('reconnected'))
    expect(clientState.sent).toHaveLength(0)

    ackResubscribe('wf-a')

    // Delivered, toward the workflow it was minted against.
    expect(clientState.sent).toHaveLength(1)
    expect(clientState.sent[0]).toMatchObject({ workflowId: 'wf-a' })
  })

  it.fails('KNOWN GAP: replays under its original op_id, exactly once', async () => {
    const { enqueue } = mountFollower('wf-a')
    clientState.transportUp = false

    await enqueue([deleteNode('edited-during-outage')])
    vi.advanceTimersByTime(RETRY_BUDGET_MS)
    const operationId = clientState.attempts[0].ops[0].op_id

    clientState.transportUp = true
    apiState.target.dispatchEvent(new Event('reconnected'))
    ackResubscribe('wf-a')

    // Carrying the id it was minted with. Re-minting would defeat the
    // applier's op_id dedupe and let a replay apply the edit a second time.
    expect(clientState.sent[0].ops[0]).toMatchObject({
      op_id: operationId,
      op: 'delete_node',
      node_id: 'edited-during-outage'
    })

    // And exactly once: after the host applies the replay, a later reconnect
    // must not send it a third time.
    dispatchOpsResult({
      workflowId: 'wf-a',
      ok: true,
      applied: [operationId],
      skipped: []
    })
    apiState.target.dispatchEvent(new Event('reconnected'))
    ackResubscribe('wf-a')
    expect(clientState.sent).toHaveLength(1)
  })
})
