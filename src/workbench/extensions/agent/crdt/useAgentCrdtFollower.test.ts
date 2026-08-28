/**
 * Composable-owned behavior only (plan 3.5's subscribe-robustness probes):
 * the bridge/client mechanics have their own suites
 * (followerSubscription.test.ts, docFrameClient.test.ts), so both are
 * module-mocked here and every assertion targets what the COMPOSABLE adds -
 * the FE-1901 bounded subscribe retry, the FE-1902 sessionStorage rebind,
 * the frame-handler status surface, and total teardown.
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { render } from '@testing-library/vue'

const bridgeState = vi.hoisted(() => {
  class FakeBridge extends EventTarget {
    subscribe = vi.fn()
    unsubscribe = vi.fn()
    resubscribe = vi.fn()
    reconcile = vi.fn()
    destroy = vi.fn()
    sendHumanOps = vi.fn()
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
  }
}))

const idAllocationState = vi.hoisted(() => ({
  setCoordinationFreeIds: vi.fn()
}))

vi.mock('@/lib/litegraph/src/idAllocation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  setCoordinationFreeIds: idAllocationState.setCoordinationFreeIds
}))

const projectorState = vi.hoisted(() => ({
  current: null as {
    project: ReturnType<typeof vi.fn>
    reset: ReturnType<typeof vi.fn>
  } | null
}))

vi.mock('./semanticProjector', () => ({
  SemanticProjector: class {
    project = vi.fn()
    reset = vi.fn()
    constructor() {
      projectorState.current = this as never
    }
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

import {
  STALE_AFTER_MS,
  summarizeOutboundDocFrame,
  useAgentCrdtFollower
} from './useAgentCrdtFollower'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

function mountFollower(initial: string | null = null): {
  unmount: () => void
  workflowId: Ref<string | null>
  status: () => AgentCrdtStatus
} {
  const workflowId = ref<string | null>(initial)
  let exposedStatus!: () => AgentCrdtStatus
  const host = defineComponent({
    setup() {
      const { status } = useAgentCrdtFollower(workflowId)
      exposedStatus = () => status.value as AgentCrdtStatus
      return () => null
    }
  })
  const { unmount } = render(host)
  return { unmount, workflowId, status: exposedStatus }
}

function bridge(): InstanceType<(typeof bridgeState)['FakeBridge']> {
  const current = bridgeState.current
  if (!current) throw new Error('no bridge constructed')
  return current
}

function dispatchFrame(
  type: string,
  detail: Record<string, unknown>,
  workflowId = 'wf-1'
): void {
  bridge().dispatchEvent(
    new CustomEvent(type, { detail: { workflowId, ...detail } })
  )
}

describe('useAgentCrdtFollower', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    bridgeState.current = null
    projectorState.current = null
    idAllocationState.setCoordinationFreeIds.mockClear()
    clientState.destroy.mockClear()
    apiState.api.removeEventListener.mockClear()
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

  it('ignores a subscription result for a foreign workflow', () => {
    const { unmount, status } = mountFollower('wf-1')

    dispatchFrame('doc_subscribed', { ok: true }, 'wf-foreign')

    expect(status().connected).toBe(false)
    expect(status().lastFrameType).toBeNull()
    expect(sessionStorage.getItem('Comfy.Agent.CrdtDocId')).toBeNull()
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

  it('arms contract-scheme id allocation while bound and restores counters on detach and unmount', async () => {
    const { unmount, workflowId } = mountFollower('wf-1')

    // Bound: local node/link creation allocates coordination-free ids.
    expect(idAllocationState.setCoordinationFreeIds).toHaveBeenLastCalledWith(
      true
    )

    workflowId.value = null
    await nextTick()
    expect(idAllocationState.setCoordinationFreeIds).toHaveBeenLastCalledWith(
      false
    )

    workflowId.value = 'wf-2'
    await nextTick()
    expect(idAllocationState.setCoordinationFreeIds).toHaveBeenLastCalledWith(
      true
    )

    unmount()
    expect(idAllocationState.setCoordinationFreeIds).toHaveBeenLastCalledWith(
      false
    )
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

  it('resubscribes on a socket reconnect without resetting the projector', () => {
    const { unmount, status } = mountFollower('wf-1')
    projectorState.current?.reset.mockClear()
    dispatchFrame('doc_subscribed', { ok: true })
    expect(status().connected).toBe(true)

    apiState.target.dispatchEvent(new Event('reconnected'))

    // Same-lineage recovery: the bridge's state-vector catch-up is
    // incremental, so the projector's canvas-matching snapshot must survive.
    // Resetting it rediffed EMPTY -> full against a materialized canvas and
    // duplicated the graph.
    expect(status().connected).toBe(false)
    expect(bridge().resubscribe).toHaveBeenCalled()
    expect(projectorState.current?.reset).not.toHaveBeenCalled()
    unmount()
  })

  it('retains the projector across a doc_reset refetch', () => {
    const { unmount, status } = mountFollower('wf-1')
    projectorState.current?.reset.mockClear()
    dispatchFrame('doc_subscribed', { ok: true })

    dispatchFrame('doc_reset', { workflowId: 'wf-1', seq: 9 })

    // The bridge replaced its doc; the refetched state diffs against the
    // projector's record of the still-populated canvas, so only the delta
    // applies.
    expect(status().connected).toBe(false)
    expect(status().updatesApplied).toBe(0)
    expect(projectorState.current?.reset).not.toHaveBeenCalled()
    unmount()
  })

  it('resets the projector on a workflow switch, with the doc replaced by the bridge', () => {
    const { unmount, workflowId } = mountFollower('wf-1')
    projectorState.current?.reset.mockClear()

    workflowId.value = 'wf-2'
    return nextTick().then(() => {
      // The canvas itself is being replaced here, so document and projection
      // state restart together.
      expect(projectorState.current?.reset).toHaveBeenCalled()
      expect(bridge().subscribe).toHaveBeenCalledWith('wf-2')
      unmount()
    })
  })

  it('retains the projector across detach and same-workflow rebind', async () => {
    const { unmount, workflowId } = mountFollower('wf-1')
    projectorState.current?.reset.mockClear()

    workflowId.value = null
    await nextTick()
    workflowId.value = 'wf-1'
    await nextTick()

    expect(projectorState.current?.reset).not.toHaveBeenCalled()
    expect(bridge().subscribe).toHaveBeenLastCalledWith('wf-1')
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

    dispatchFrame('schema_error', { code: 'unreadable' })

    expect(status().connected).toBe(false)
    expect(status().workflowId).toBe('wf-1')
    unmount()
  })

  it('surfaces applied updates and the last frame type in status', () => {
    const { unmount, status } = mountFollower('wf-1')
    bridge().follower.updatesApplied = 3

    dispatchFrame('doc_update', { seq: 7 })

    expect(status().updatesApplied).toBe(3)
    expect(status().lastFrameType).toBe('doc_update')
    unmount()
  })

  it('sends human ops through the bridge with the session tab', () => {
    const workflowId = ref<string | null>('wf-1')
    let send!: (ops: never[]) => void
    const host = defineComponent({
      setup() {
        const { sendHumanOps } = useAgentCrdtFollower(workflowId)
        send = sendHumanOps as (ops: never[]) => void
        return () => null
      }
    })
    const { unmount } = render(host)

    send([])

    expect(bridge().sendHumanOps).toHaveBeenCalledWith(expect.any(String), [])
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
    dispatchFrame('doc_update', { seq: 2 })
    vi.advanceTimersByTime(STALE_AFTER_MS - 1000)
    expect(bridge().resubscribe).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('probes reconnects but not unconfirmed or switched bindings', async () => {
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

    // Confirmed then reconnected: the first resubscribe is immediate, and an
    // unanswered subscribe remains covered by the stale-channel probe.
    dispatchFrame('doc_subscribed', { ok: true })
    bridge().resubscribe.mockClear()
    apiState.target.dispatchEvent(new Event('reconnected'))
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(STALE_AFTER_MS)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(2)
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
        useAgentCrdtFollower(workflowId)
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

describe('summarizeOutboundDocFrame', () => {
  it('records metadata only, never the doc_ops payload', () => {
    const frame = JSON.stringify({
      type: 'doc_ops',
      data: {
        v: 1,
        workflow_id: 'wf-1',
        tab: 'tab-1',
        ops: [
          {
            op_id: 'op-1',
            op: 'set_widget',
            actor: 'human:u:t',
            value: 'a private prompt string'
          },
          { op_id: 'op-2', op: 'add_node', actor: 'human:u:t' }
        ]
      }
    })

    const summary = summarizeOutboundDocFrame(frame)

    expect(summary).toEqual({
      bytes: frame.length,
      type: 'doc_ops',
      workflow_id: 'wf-1',
      op_count: 2,
      ops: [
        { op_id: 'op-1', op: 'set_widget' },
        { op_id: 'op-2', op: 'add_node' }
      ]
    })
    expect(JSON.stringify(summary)).not.toContain('private prompt')
  })

  it('degrades to byte size alone for a non-JSON frame', () => {
    expect(summarizeOutboundDocFrame('not json')).toEqual({ bytes: 8 })
  })
})
