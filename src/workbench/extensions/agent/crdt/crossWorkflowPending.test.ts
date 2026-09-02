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

  it('settles the in-flight workflow A batch from its late result without touching workflow B status', async () => {
    const { workflowId, enqueue, status } = mountFollower('wf-a')

    bridge().lastSequence = 41
    enqueue([deleteNode('a-inflight')])
    expect(clientState.sent[0].ops[0]).toMatchObject({ base_version: 41 })
    const operationAId = clientState.sent[0].ops[0].op_id
    await switchWorkflow(workflowId, 'wf-b')
    enqueue([deleteNode('b-pending')])
    expect(clientState.sent).toHaveLength(1)

    dispatchOpsResult({
      workflowId: 'wf-a',
      ok: true,
      applied: [operationAId],
      skipped: []
    })

    expect(clientState.sent).toHaveLength(2)
    expect(clientState.sent[1]).toMatchObject({ workflowId: 'wf-b' })
    expect(clientState.sent[1].ops[0]).toMatchObject({ base_version: 0 })
    const operationBId = clientState.sent[1].ops[0].op_id

    // R-73: result frames carry workflowId; the composable gates status by
    // it, so workflow A's late frame leaves workflow B's status untouched.
    // The dev log still records the frame under its own workflowId.
    expect(status()).toMatchObject({
      workflowId: 'wf-b',
      lastFrameType: null
    })
    expect(devLogState.recordDevEvent).toHaveBeenCalledWith('doc_ops_result', {
      workflowId: 'wf-a',
      ok: true,
      applied: [operationAId],
      skipped: [],
      failed: null
    })
    expect(devLogState.recordDevEvent).toHaveBeenCalledWith(
      'human_ops_settled',
      {
        state: 'acknowledged',
        ops: [expect.objectContaining({ op_id: operationAId })],
        result: expect.objectContaining({
          ok: true,
          applied: [operationAId],
          skipped: []
        })
      }
    )
    expect(
      devLogState.recordDevEvent.mock.calls.filter(
        ([event]) => event === 'human_ops_settled'
      )
    ).toHaveLength(1)
    expect(operationBId).not.toBe(operationAId)
  })

  it('ignores an anonymous workflow A result while workflow B is in flight', async () => {
    const { workflowId, enqueue } = mountFollower('wf-a')

    enqueue([deleteNode('a-inflight')])
    const operationAId = clientState.sent[0].ops[0].op_id
    await switchWorkflow(workflowId, 'wf-b')
    enqueue([deleteNode('b-pending')])

    dispatchOpsResult({
      workflowId: 'wf-a',
      ok: true,
      applied: [operationAId],
      skipped: []
    })
    const operationBId = clientState.sent[1].ops[0].op_id

    dispatchOpsResult({
      workflowId: 'wf-a',
      ok: false,
      applied: [],
      skipped: []
    })

    // The anonymous nack names workflow A; the sender's in-flight batch is
    // workflow B's, so the result is not attributed to it. Workflow B stays
    // in flight until its own result (or the result timeout).
    const settlements = devLogState.recordDevEvent.mock.calls.filter(
      ([event]) => event === 'human_ops_settled'
    )
    expect(settlements).toHaveLength(1)
    expect(settlements[0][1]).toMatchObject({
      state: 'acknowledged',
      ops: [expect.objectContaining({ op_id: operationAId })]
    })

    dispatchOpsResult({
      workflowId: 'wf-b',
      ok: false,
      applied: [],
      skipped: []
    })
    const settled = devLogState.recordDevEvent.mock.calls.filter(
      ([event]) => event === 'human_ops_settled'
    )
    expect(settled).toHaveLength(2)
    expect(settled[1][1]).toMatchObject({
      state: 'acknowledged',
      ops: [expect.objectContaining({ op_id: operationBId })],
      result: { ok: false, applied: [], skipped: [] }
    })
  })
})
