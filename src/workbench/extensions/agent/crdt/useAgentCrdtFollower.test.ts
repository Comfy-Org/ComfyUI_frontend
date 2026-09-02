/**
 * Composable-owned behavior only (plan 3.5's subscribe-robustness probes):
 * the bridge/client mechanics have their own suites
 * (followerSubscription.test.ts, docFrameClient.test.ts), so both are
 * module-mocked here and every assertion targets what the COMPOSABLE adds -
 * the FE-1901 bounded subscribe retry, the FE-1902 sessionStorage rebind,
 * the frame-handler status surface, and total teardown.
 */
import { createPinia, setActivePinia } from 'pinia'
import type { Op } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { render } from '@testing-library/vue'

import type { GraphMutations } from '@/core/graph/graphMutations'
import {
  createLGraphState,
  MINT_ID_MIN,
  mintNodeId
} from '@/lib/litegraph/src/idAllocation'
import type { LGraphState } from '@/lib/litegraph/src/idAllocation'
import type { TargetedGraphOperations } from './graphOperations'

const bridgeState = vi.hoisted(() => {
  class FakeBridge extends EventTarget {
    subscribe = vi.fn()
    unsubscribe = vi.fn()
    resubscribe = vi.fn()
    reconcile = vi.fn()
    destroy = vi.fn()
    sendHumanOps = vi.fn()
    subscribedWorkflowId: string | null = 'wf-1'
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
  sendOps: vi.fn((_workflowId: string, _tab: string, _ops: Op[]) => true)
}))

const adapterState = vi.hoisted(() => ({
  bind: vi.fn(),
  unbind: vi.fn(),
  applyFrame: vi.fn(),
  clearForReset: vi.fn(),
  discardPending: vi.fn(),
  destroy: vi.fn()
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
  recordDevEvent: vi.fn()
}))

vi.mock('@/scripts/api', () => ({ api: apiState.api }))
vi.mock('@/scripts/app', () => ({ app: { graph: null, canvas: null } }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ userId: 'user-1' })
}))

import { STALE_AFTER_MS, useAgentCrdtFollower } from './useAgentCrdtFollower'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

const graphMutations = {} as GraphMutations

function defaultIdAllocationState(): () => LGraphState {
  const state = createLGraphState()
  return () => state
}

function mountFollower(
  initial: string | null = null,
  initiallyActive = true,
  idAllocationState: () => LGraphState | null = defaultIdAllocationState()
): {
  unmount: () => void
  workflowId: Ref<string | null>
  isTargetActive: Ref<boolean>
  status: () => AgentCrdtStatus
  enqueue: (batch: TargetedGraphOperations) => boolean
} {
  const workflowId = ref<string | null>(initial)
  const isTargetActive = ref(initiallyActive)
  let exposedStatus!: () => AgentCrdtStatus
  let enqueue!: (batch: TargetedGraphOperations) => boolean
  const host = defineComponent({
    setup() {
      const { status, enqueueHumanOperations } = useAgentCrdtFollower(
        workflowId,
        graphMutations,
        () => null,
        isTargetActive,
        idAllocationState
      )
      exposedStatus = () => status.value as AgentCrdtStatus
      enqueue = enqueueHumanOperations
      return () => null
    }
  })
  const { unmount } = render(host)
  return {
    unmount,
    workflowId,
    isTargetActive,
    status: exposedStatus,
    enqueue
  }
}

function bridge(): InstanceType<(typeof bridgeState)['FakeBridge']> {
  const current = bridgeState.current
  if (!current) throw new Error('no bridge constructed')
  return current
}

function dispatchFrame(type: string, detail: unknown): void {
  bridge().dispatchEvent(new CustomEvent(type, { detail }))
}

describe('useAgentCrdtFollower', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    bridgeState.current = null
  })

  it('subscribes immediately to a bound workflow and reports it in status', () => {
    const { unmount, status } = mountFollower('wf-1')

    expect(bridge().subscribe).toHaveBeenCalledWith('wf-1')
    expect(status().workflowId).toBe('wf-1')
    expect(status().enabled).toBe(true)
    unmount()
  })

  it('FE-1901: retries a refused subscribe with bounded exponential backoff', () => {
    vi.useFakeTimers()
    const { unmount } = mountFollower('wf-1')

    dispatchFrame('doc_subscribed', { ok: false })
    expect(bridge().resubscribe).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)

    dispatchFrame('doc_subscribed', { ok: false })
    vi.advanceTimersByTime(999)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(2)

    // Six attempts is the budget: refusals beyond it schedule nothing.
    for (let attempt = 2; attempt < 6; attempt++) {
      dispatchFrame('doc_subscribed', { ok: false })
      vi.advanceTimersByTime(500 * 2 ** attempt)
    }
    expect(bridge().resubscribe).toHaveBeenCalledTimes(6)
    dispatchFrame('doc_subscribed', { ok: false })
    vi.advanceTimersByTime(60_000)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(6)
    unmount()
  })

  it('FE-1901: a confirmed subscribe clears the retry timer', () => {
    vi.useFakeTimers()
    const { unmount, status } = mountFollower('wf-1')

    dispatchFrame('doc_subscribed', { ok: false })
    dispatchFrame('doc_subscribed', { ok: true })
    // Below the staleness budget: anything firing here would be the retry.
    vi.advanceTimersByTime(STALE_AFTER_MS - 1)

    expect(bridge().resubscribe).not.toHaveBeenCalled()
    expect(status().connected).toBe(true)
    unmount()
  })

  it('FE-1901: a workflow switch cancels the pending retry', () => {
    vi.useFakeTimers()
    const { unmount, workflowId } = mountFollower('wf-1')

    dispatchFrame('doc_subscribed', { ok: false })
    workflowId.value = 'wf-2'
    return Promise.resolve().then(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(60_000)
      expect(bridge().resubscribe).not.toHaveBeenCalled()
      expect(bridge().subscribe).toHaveBeenLastCalledWith('wf-2')
      unmount()
    })
  })

  it('FE-1902: persists a binding only once the server confirms it', () => {
    const { unmount } = mountFollower('wf-1')
    expect(sessionStorage.getItem('Comfy.Agent.CrdtDocId')).toBeNull()

    dispatchFrame('doc_subscribed', { ok: true })

    expect(sessionStorage.getItem('Comfy.Agent.CrdtDocId')).toBe('wf-1')
    unmount()
  })

  it('FE-1902: a remount with no in-memory binding rebinds from sessionStorage', () => {
    sessionStorage.setItem('Comfy.Agent.CrdtDocId', 'wf-persisted')

    const { unmount, status } = mountFollower(null)

    expect(bridge().subscribe).toHaveBeenCalledWith('wf-persisted')
    expect(status().workflowId).toBe('wf-persisted')
    unmount()
  })

  it('FE-1902: a real detach clears the persisted binding and unsubscribes', async () => {
    const { unmount, workflowId } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    expect(sessionStorage.getItem('Comfy.Agent.CrdtDocId')).toBe('wf-1')

    workflowId.value = null
    await Promise.resolve()
    await Promise.resolve()

    expect(sessionStorage.getItem('Comfy.Agent.CrdtDocId')).toBeNull()
    expect(bridge().unsubscribe).toHaveBeenCalled()
    unmount()
  })

  it('retains the follower and resubscribes on a socket reconnect', () => {
    const { unmount, status } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    expect(status().connected).toBe(true)

    apiState.target.dispatchEvent(new Event('reconnected'))

    expect(status().connected).toBe(false)
    expect(bridge().resubscribe).toHaveBeenCalled()
    expect(adapterState.clearForReset).not.toHaveBeenCalled()
    unmount()
  })

  it('clears only for an explicit reset and rebinds after replacement', () => {
    const { unmount } = mountFollower('wf-1')
    expect(adapterState.bind).toHaveBeenCalledTimes(1)

    dispatchFrame('doc_reset', {
      workflowId: 'wf-1',
      actor: 'agent:turn',
      seq: 43
    })
    expect(adapterState.clearForReset).toHaveBeenCalledWith('wf-1', {
      source: 'agent-remote',
      actor: 'agent:turn',
      opId: 'doc-reset:43'
    })

    dispatchFrame('follower_replaced', { seq: 43 })
    expect(adapterState.bind).toHaveBeenCalledTimes(2)
    expect(adapterState.bind).toHaveBeenLastCalledWith(
      'wf-1',
      bridge().follower
    )
    unmount()
  })

  it('re-drives subscription intent on every status frame', () => {
    const { unmount } = mountFollower('wf-1')

    apiState.target.dispatchEvent(new Event('status'))

    expect(bridge().reconcile).toHaveBeenCalled()
    unmount()
  })

  it('drops to disconnected on a schema error without touching the binding', () => {
    const { unmount, status } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })

    dispatchFrame('schema_error', { workflowId: 'wf-1', code: 'unreadable' })

    expect(status().connected).toBe(false)
    expect(status().workflowId).toBe('wf-1')
    expect(adapterState.discardPending).toHaveBeenCalledWith('wf-1')
    unmount()
  })

  it('surfaces applied updates and the last frame type in status', () => {
    const { unmount, status } = mountFollower('wf-1')
    bridge().follower.updatesApplied = 3

    const update = { workflowId: 'wf-1', seq: 7 }
    dispatchFrame('doc_update', update)

    expect(status().updatesApplied).toBe(3)
    expect(status().lastFrameType).toBe('doc_update')
    expect(adapterState.applyFrame).toHaveBeenCalledWith(update)
    unmount()
  })

  it('suspends a background target and catches up only after it becomes active', async () => {
    const { unmount, isTargetActive } = mountFollower('wf-a', false)

    expect(bridge().subscribe).not.toHaveBeenCalled()
    dispatchFrame('doc_update', { workflowId: 'wf-a', seq: 7 })
    expect(adapterState.applyFrame).not.toHaveBeenCalled()

    isTargetActive.value = true
    await nextTick()
    expect(bridge().subscribe).toHaveBeenCalledWith('wf-a')

    const catchUp = { workflowId: 'wf-a', seq: 8 }
    dispatchFrame('doc_update', catchUp)
    expect(adapterState.applyFrame).toHaveBeenCalledWith(catchUp)
    unmount()
  })

  it('arms collision-free ids only while a shared document is bound', async () => {
    const state = createLGraphState()
    const { unmount, workflowId } = mountFollower('wf-a', true, () => state)

    expect(Number(mintNodeId(state))).toBeGreaterThanOrEqual(MINT_ID_MIN)

    workflowId.value = null
    await nextTick()
    expect(mintNodeId(state)).toBe('1')

    workflowId.value = 'wf-b'
    await nextTick()
    expect(Number(mintNodeId(state))).toBeGreaterThanOrEqual(MINT_ID_MIN)

    unmount()
    expect(mintNodeId(state)).toBe('2')
  })

  it('disarms the previous graph state when the state object is swapped', async () => {
    const stateA = createLGraphState()
    const stateB = createLGraphState()
    let current = stateA
    const { unmount, workflowId } = mountFollower('wf-a', true, () => current)

    expect(Number(mintNodeId(stateA))).toBeGreaterThanOrEqual(MINT_ID_MIN)

    current = stateB
    workflowId.value = 'wf-b'
    await nextTick()

    expect(Number(mintNodeId(stateB))).toBeGreaterThanOrEqual(MINT_ID_MIN)
    expect(mintNodeId(stateA)).toBe('1')

    unmount()
    expect(mintNodeId(stateB)).toBe('1')
  })

  it('sends minted human operations through the doc client', () => {
    const workflowId = ref<string | null>('wf-1')
    let enqueue!: ReturnType<
      typeof useAgentCrdtFollower
    >['enqueueHumanOperations']
    const host = defineComponent({
      setup() {
        const { enqueueHumanOperations } = useAgentCrdtFollower(
          workflowId,
          graphMutations
        )
        enqueue = enqueueHumanOperations
        return () => null
      }
    })
    const { unmount } = render(host)

    enqueue({
      target: { workflowId: 'wf-1', rootGraphId: 'root-1' },
      operations: [
        {
          op: 'delete_node',
          node_id: '1',
          removed_links: []
        }
      ]
    })

    expect(clientState.sendOps).toHaveBeenCalledWith(
      'wf-1',
      expect.any(String),
      [expect.objectContaining({ op: 'delete_node', node_id: '1' })]
    )
    unmount()
  })

  it('reserves and persists monotonic producer versions across rapid writes and remount', () => {
    const target = { workflowId: 'wf-1', rootGraphId: 'root-1' }
    const first = mountFollower('wf-1')

    first.enqueue({
      target,
      operations: [{ op: 'set_widget', node_id: 1, widget: 'seed', value: 1 }]
    })
    first.enqueue({
      target,
      operations: [{ op: 'set_widget', node_id: 1, widget: 'seed', value: 2 }]
    })

    expect(sessionStorage.getItem('Comfy.Agent.CrdtProducerClock:wf-1')).toBe(
      '43'
    )
    expect(clientState.sendOps.mock.calls[0][2][0].stamp).toEqual([
      42,
      expect.any(String)
    ])
    first.unmount()

    const remounted = mountFollower('wf-1')
    remounted.enqueue({
      target,
      operations: [{ op: 'set_widget', node_id: 1, widget: 'seed', value: 3 }]
    })

    expect(clientState.sendOps.mock.calls[1][2][0].stamp).toEqual([
      44,
      expect.any(String)
    ])
    remounted.unmount()
  })

  it('continues minting when sessionStorage cannot persist the producer clock', () => {
    const target = { workflowId: 'wf-1', rootGraphId: 'root-1' }
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota')
      })
    const { enqueue, unmount } = mountFollower('wf-1')

    expect(
      enqueue({
        target,
        operations: [{ op: 'set_widget', node_id: 1, widget: 'seed', value: 1 }]
      })
    ).toBe(true)

    expect(clientState.sendOps.mock.calls[0][2][0].stamp).toEqual([
      42,
      expect.any(String)
    ])
    setItem.mockRestore()
    unmount()
  })

  it('rejects a corrupt persisted producer clock instead of minting stale versions', () => {
    sessionStorage.setItem('Comfy.Agent.CrdtProducerClock:wf-1', 'not-a-clock')
    const target = { workflowId: 'wf-1', rootGraphId: 'root-1' }
    const { enqueue, unmount } = mountFollower('wf-1')

    expect(
      enqueue({
        target,
        operations: [{ op: 'set_widget', node_id: 1, widget: 'seed', value: 1 }]
      })
    ).toBe(false)
    expect(clientState.sendOps).not.toHaveBeenCalled()
    unmount()
  })

  it('does not regress the producer clock after reconnect observes a lower sequence', () => {
    const target = { workflowId: 'wf-1', rootGraphId: 'root-1' }
    const { enqueue, unmount } = mountFollower('wf-1')
    enqueue({
      target,
      operations: [{ op: 'set_widget', node_id: 1, widget: 'seed', value: 1 }]
    })
    const firstOp = clientState.sendOps.mock.calls[0][2][0]
    dispatchFrame('doc_ops_result', {
      workflowId: 'wf-1',
      ok: true,
      applied: [firstOp.op_id],
      skipped: []
    })
    bridge().lastSequence = 2
    apiState.target.dispatchEvent(new Event('reconnected'))

    enqueue({
      target,
      operations: [{ op: 'set_widget', node_id: 1, widget: 'seed', value: 2 }]
    })

    expect(clientState.sendOps.mock.calls[1][2][0].stamp).toEqual([
      43,
      expect.any(String)
    ])
    unmount()
  })

  it('probes a quiet bound channel once per budget and re-arms (BE-9740)', () => {
    vi.useFakeTimers()
    const { unmount } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })

    vi.advanceTimersByTime(STALE_AFTER_MS - 1)
    expect(bridge().resubscribe).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(STALE_AFTER_MS)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(2)
    unmount()
  })

  it('any doc-scoped frame slides the staleness window forward', () => {
    vi.useFakeTimers()
    const { unmount } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })

    vi.advanceTimersByTime(STALE_AFTER_MS - 1000)
    dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 2 })
    vi.advanceTimersByTime(STALE_AFTER_MS - 1000)
    expect(bridge().resubscribe).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('never probes an unconfirmed binding (refused subscribe, switch, reconnect)', async () => {
    vi.useFakeTimers()
    const { unmount, workflowId } = mountFollower('wf-1')

    // Never confirmed: no probe however long the silence.
    vi.advanceTimersByTime(STALE_AFTER_MS * 3)
    expect(bridge().resubscribe).not.toHaveBeenCalled()

    // Confirmed then switched: the switch cancels the armed probe.
    dispatchFrame('doc_subscribed', { ok: true })
    workflowId.value = 'wf-2'
    await Promise.resolve()
    await Promise.resolve()
    vi.advanceTimersByTime(STALE_AFTER_MS * 2)
    expect(bridge().resubscribe).not.toHaveBeenCalled()

    // Confirmed then reconnected: the reconnect's own resubscribe path owns
    // recovery; the heartbeat stays disarmed until the next confirm.
    dispatchFrame('doc_subscribed', { ok: true })
    bridge().resubscribe.mockClear()
    apiState.target.dispatchEvent(new Event('reconnected'))
    const reconnectResubscribes = bridge().resubscribe.mock.calls.length
    vi.advanceTimersByTime(STALE_AFTER_MS * 2)
    expect(bridge().resubscribe.mock.calls.length).toBe(reconnectResubscribes)
    unmount()
  })

  it('tears down totally on unmount, even when the bridge destroy throws', () => {
    // Vue routes an onBeforeUnmount throw through the app error channel, so
    // the throw is absorbed there; the contract under test is that the
    // client teardown and listener removal still ran.
    const hookErrors: unknown[] = []
    const workflowId = ref<string | null>('wf-1')
    const host = defineComponent({
      setup() {
        useAgentCrdtFollower(workflowId, graphMutations)
        return () => null
      }
    })
    const { unmount } = render(host, {
      global: {
        config: {
          errorHandler: (error: unknown) => {
            hookErrors.push(error)
          }
        }
      }
    })
    bridge().destroy.mockImplementation(() => {
      throw new Error('half-dead bridge')
    })

    unmount()

    expect(String(hookErrors[0])).toContain('half-dead bridge')
    expect(clientState.destroy).toHaveBeenCalled()
    expect(adapterState.destroy).toHaveBeenCalled()
    expect(apiState.api.removeEventListener).toHaveBeenCalledWith(
      'reconnected',
      expect.any(Function)
    )
    expect(apiState.api.removeEventListener).toHaveBeenCalledWith(
      'status',
      expect.any(Function)
    )
  })
})
