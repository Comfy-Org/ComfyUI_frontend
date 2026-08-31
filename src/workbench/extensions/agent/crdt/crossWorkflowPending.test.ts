import type { Op } from '@comfyorg/comfy-multi-player'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import type { GraphMutations } from '@/core/graph/graphMutations'
import { render } from '@testing-library/vue'

import type { GraphOperation } from './graphOperations'

const bridgeState = vi.hoisted(() => {
  class FakeBridge extends EventTarget {
    subscribe = vi.fn((workflowId: string) => {
      this.subscribedWorkflowId = workflowId
    })

    unsubscribe = vi.fn((workflowId?: string) => {
      if (workflowId === undefined || this.subscribedWorkflowId === workflowId)
        this.subscribedWorkflowId = null
    })

    resubscribe = vi.fn()
    reconcile = vi.fn()
    destroy = vi.fn()
    subscribedWorkflowId: string | null = null
    lastSequence = 41
    follower = {
      updatesApplied: 0,
      doc: {
        getMap: () => ({ toJSON: () => ({}) })
      }
    }
  }

  return { FakeBridge, current: null as InstanceType<typeof FakeBridge> | null }
})

const clientState = vi.hoisted(() => ({
  destroy: vi.fn(),
  transportUp: true,
  sent: [] as Array<{ workflowId: string; tab: string; ops: Op[] }>,
  sendOps: vi.fn((workflowId: string, tab: string, ops: Op[]) => {
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
    clientState.transportUp = true
    clientState.sent = []
    clientState.sendOps.mockClear()
    devLogState.recordDevEvent.mockClear()
    vi.useRealTimers()
  })

  it('does not retarget a transport retry after workflow A switches to workflow B', async () => {
    vi.useFakeTimers()
    clientState.transportUp = false
    const { unmount, workflowId, enqueue } = mountFollower('wf-a')

    enqueue([deleteNode('a-queued')])
    expect(clientState.sent).toHaveLength(0)

    await switchWorkflow(workflowId, 'wf-b')
    clientState.transportUp = true
    vi.advanceTimersByTime(500)

    // R-73 was filed against PR #16332's switch site. On main f954e479a,
    // opSender keeps the workflow captured at enqueue time, so this half of
    // the suspected A-to-B contamination is already a regression guard.
    expect(bridge().subscribe).toHaveBeenLastCalledWith('wf-b')
    expect(clientState.sent).toHaveLength(1)
    expect(clientState.sent[0]).toMatchObject({ workflowId: 'wf-a' })
    expect(clientState.sent[0].ops[0]).toMatchObject({
      op: 'delete_node',
      node_id: 'a-queued'
    })

    unmount()
  })

  it('still accepts a late workflow A result by op_id while workflow B is active', async () => {
    const { unmount, workflowId, enqueue, status } = mountFollower('wf-a')

    enqueue([deleteNode('a-inflight')])
    const operationId = clientState.sent[0].ops[0].op_id
    await switchWorkflow(workflowId, 'wf-b')

    dispatchOpsResult({
      workflowId: 'wf-a',
      ok: true,
      applied: [operationId],
      skipped: []
    })

    // Current risk characterization: result frames carry workflowId, but the
    // composable/sender path correlates by op_id only.
    expect(status()).toMatchObject({
      workflowId: 'wf-b',
      lastFrameType: 'doc_ops_result'
    })
    expect(devLogState.recordDevEvent).toHaveBeenCalledWith('doc_ops_result', {
      workflowId: 'wf-a',
      ok: true,
      applied: [operationId],
      skipped: []
    })
    expect(devLogState.recordDevEvent).toHaveBeenCalledWith(
      'human_ops_settled',
      expect.objectContaining({
        state: 'acknowledged',
        result: expect.objectContaining({
          ok: true,
          applied: [operationId],
          skipped: []
        })
      })
    )

    unmount()
  })
})
