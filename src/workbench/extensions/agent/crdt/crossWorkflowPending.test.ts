import type { Op } from '@comfyorg/comfy-multi-player'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import type { GraphMutations } from '@/core/graph/graphMutations'
import { render } from '@testing-library/vue'

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

vi.mock('./layoutFollowerBridge', () => ({
  LayoutFollowerBridge: class {
    constructor() {
      const bridge = new bridgeState.FakeBridge()
      bridgeState.current = bridge
      return bridge
    }
  }
}))

vi.mock('./docFrameClient', () => ({
  DocFrameClient: class {
    destroy = clientState.destroy
    sendOps = clientState.sendOps
  }
}))

vi.mock('./ecsFollowerAdapter', () => ({
  EcsFollowerAdapter: class {
    bind = adapterState.bind
    unbind = adapterState.unbind
    applyFrame = adapterState.applyFrame
    clearForReset = adapterState.clearForReset
    discardPending = adapterState.discardPending
    destroy = adapterState.destroy
  }
}))

vi.mock('./devPanelLog', () => ({
  recordDevEvent: devLogState.recordDevEvent
}))

vi.mock('@/scripts/api', () => ({ api: apiState.api }))
vi.mock('@/scripts/app', () => ({ app: { graph: null, canvas: null } }))

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
  enqueue: (operations: GraphOperation[]) => void
  status: () => AgentCrdtStatus
} {
  const workflowId = ref<string | null>(initial)
  let enqueue!: (operations: GraphOperation[]) => void
  let exposedStatus!: () => AgentCrdtStatus
  const host = defineComponent({
    setup() {
      const { enqueueHumanOperations, status } = useAgentCrdtFollower(
        workflowId,
        graphMutations
      )
      enqueue = enqueueHumanOperations
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

describe('R-73 cross-workflow pending operation characterization', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    bridgeState.current = null
    bridgeState.transport.up = true
    clientState.transportUp = true
    clientState.attempts = []
    clientState.sent = []
    clientState.sendOps.mockClear()
    devLogState.recordDevEvent.mockClear()
    vi.useFakeTimers()
  })

  it('does not retarget a transport retry after workflow A switches to workflow B', async () => {
    const { workflowId, enqueue } = mountFollower('wf-a')
    bridgeState.transport.up = false
    clientState.transportUp = false

    enqueue([deleteNode('a-queued')])
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
    enqueue([deleteNode('a-inflight')])
    // The sender is intentionally gated by the last successfully projected
    // sequence, not by the bridge's latest received sequence.
    expect(clientState.sent[0].ops[0]).toMatchObject({ base_version: 0 })
    const operationAId = clientState.sent[0].ops[0].op_id
    await switchWorkflow(workflowId, 'wf-b')

    // The switch itself settles A's in-flight batch undeliverable (the
    // composable calls sender.abortIfUnbound() after retargeting the bridge),
    // so B's batch goes out at once instead of queueing behind A for the
    // 10 s result-silence window.
    expect(devLogState.recordDevEvent).toHaveBeenCalledWith(
      'human_ops_settled',
      {
        state: 'undeliverable',
        ops: [expect.objectContaining({ op_id: operationAId })]
      }
    )
    enqueue([deleteNode('b-pending')])
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

  it('documents an anonymous workflow A result settling workflow B in flight', async () => {
    const { workflowId, enqueue } = mountFollower('wf-a')

    enqueue([deleteNode('a-inflight')])
    const operationAId = clientState.sent[0].ops[0].op_id
    // The switch settles A undeliverable (settlement 0) and B goes out at once.
    await switchWorkflow(workflowId, 'wf-b')
    enqueue([deleteNode('b-pending')])
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

    const settlements = devLogState.recordDevEvent.mock.calls.filter(
      ([event]) => event === 'human_ops_settled'
    )
    expect(settlements).toHaveLength(2)
    expect(settlements[1][1]).toMatchObject({
      state: 'acknowledged',
      ops: [expect.objectContaining({ op_id: operationBId })],
      result: { ok: false, applied: [], skipped: [] }
    })
  })
})
