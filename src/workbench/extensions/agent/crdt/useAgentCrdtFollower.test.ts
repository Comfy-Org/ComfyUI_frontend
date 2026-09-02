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

import type { GraphMutations } from '@/core/graph/graphMutations'

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
    /** Root-map contents by name (`nodes`, `links`), mutable per test. */
    docMaps: Record<string, Record<string, unknown>> = {}
    follower = {
      updatesApplied: 0,
      doc: {
        getMap: (name: string) => ({
          toJSON: () => this.docMaps[name] ?? {},
          has: (key: string) => key in (this.docMaps[name] ?? {})
        })
      }
    }
  }
  return { FakeBridge, current: null as InstanceType<typeof FakeBridge> | null }
})

const clientState = vi.hoisted(() => ({
  destroy: vi.fn(),
  sendOps: vi.fn(() => true)
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

import { recordDevEvent } from './devPanelLog'
import { REPLAY_STORAGE_KEY } from './replayGate'

vi.mock('@/scripts/api', () => ({ api: apiState.api }))
vi.mock('@/scripts/app', () => ({ app: { graph: null, canvas: null } }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ userId: 'user-1' })
}))

import {
  STALE_AFTER_MS,
  linkEndpoints,
  useAgentCrdtFollower
} from './useAgentCrdtFollower'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

const graphMutations = {} as GraphMutations
const DOC_ID_KEY = 'Comfy.Agent.CrdtDocId'

function persistedRecord(): {
  docId: string
  nonce: string
  expiresAt: number
} | null {
  const raw = sessionStorage.getItem(DOC_ID_KEY)
  return raw ? JSON.parse(raw) : null
}

function writeRawRecord(overrides: {
  docId: string
  nonce?: string
  expiresAt?: number
}): void {
  const base = persistedRecord()
  sessionStorage.setItem(
    DOC_ID_KEY,
    JSON.stringify({
      docId: overrides.docId,
      nonce: overrides.nonce ?? base?.nonce ?? 'foreign-nonce',
      expiresAt: overrides.expiresAt ?? Date.now() + 60_000
    })
  )
}

function mountFollower(
  initial: string | null = null,
  initiallyActive = true
): {
  unmount: () => void
  workflowId: Ref<string | null>
  isTargetActive: Ref<boolean>
  status: () => AgentCrdtStatus
  pendingReplayNodeIds: () => ReadonlySet<string>
} {
  const workflowId = ref<string | null>(initial)
  const isTargetActive = ref(initiallyActive)
  let exposedStatus!: () => AgentCrdtStatus
  let exposedPending!: () => ReadonlySet<string>
  const host = defineComponent({
    setup() {
      const { status, pendingReplayNodeIds } = useAgentCrdtFollower(
        workflowId,
        graphMutations,
        () => null,
        isTargetActive
      )
      exposedStatus = () => status.value as AgentCrdtStatus
      exposedPending = () => pendingReplayNodeIds.value
      return () => null
    }
  })
  const { unmount } = render(host)
  return {
    unmount,
    workflowId,
    isTargetActive,
    status: exposedStatus,
    pendingReplayNodeIds: exposedPending
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
    localStorage.removeItem(REPLAY_STORAGE_KEY)
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
    expect(persistedRecord()).toBeNull()

    dispatchFrame('doc_subscribed', { ok: true })

    expect(persistedRecord()?.docId).toBe('wf-1')
    unmount()
  })

  it('FE-1902: a remount with no in-memory binding rebinds from sessionStorage', () => {
    const setup = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    setup.unmount()
    bridgeState.current = null

    const { unmount, status } = mountFollower(null)

    expect(bridge().subscribe).toHaveBeenCalledWith('wf-1')
    expect(status().workflowId).toBe('wf-1')
    unmount()
  })

  it('FE-1902: a real detach clears the persisted binding and unsubscribes', async () => {
    const { unmount, workflowId } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    expect(persistedRecord()?.docId).toBe('wf-1')

    workflowId.value = null
    await Promise.resolve()
    await Promise.resolve()

    expect(persistedRecord()).toBeNull()
    expect(bridge().unsubscribe).toHaveBeenCalled()
    unmount()
  })

  it('FEC-5: refuses a record from a different page session (e.g. a duplicated tab)', () => {
    const setup = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    setup.unmount()
    bridgeState.current = null
    // Simulate sessionStorage cloned into a fresh tab: same docId, foreign nonce.
    writeRawRecord({ docId: 'wf-1', nonce: 'a-different-page-session' })

    const { unmount, status } = mountFollower(null)

    expect(bridge().subscribe).not.toHaveBeenCalled()
    expect(status().workflowId).toBeNull()
    unmount()
  })

  it('FEC-5: refuses an expired record', () => {
    const setup = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    setup.unmount()
    bridgeState.current = null
    const record = persistedRecord()
    writeRawRecord({
      docId: 'wf-1',
      nonce: record?.nonce,
      expiresAt: Date.now() - 1
    })

    const { unmount, status } = mountFollower(null)

    expect(bridge().subscribe).not.toHaveBeenCalled()
    expect(status().workflowId).toBeNull()
    unmount()
  })

  it('FEC-5: refuses a legacy bare-string record', () => {
    sessionStorage.setItem(DOC_ID_KEY, 'wf-legacy')

    const { unmount, status } = mountFollower(null)

    expect(bridge().subscribe).not.toHaveBeenCalled()
    expect(status().workflowId).toBeNull()
    unmount()
  })

  it('FEC-5: a refused legacy record is dropped by the first unbound mount', () => {
    sessionStorage.setItem(DOC_ID_KEY, 'wf-legacy')

    const { unmount } = mountFollower(null)

    expect(sessionStorage.getItem(DOC_ID_KEY)).toBeNull()
    unmount()
  })

  it('FEC-5: live doc traffic slides the persisted expiry', () => {
    vi.useFakeTimers()
    const setup = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    const stampedAt = persistedRecord()?.expiresAt
    expect(stampedAt).toBeTypeOf('number')

    // Six minutes of steady updates: past the 5-minute TTL, but the channel is
    // healthy so the stale probe never fires and nothing resubscribes.
    for (let seq = 1; seq <= 18; seq++) {
      vi.advanceTimersByTime(20_000)
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq,
        actor: 'agent',
        update: new Uint8Array()
      })
    }
    expect(bridge().resubscribe).not.toHaveBeenCalled()
    expect(persistedRecord()?.expiresAt).toBeGreaterThan(stampedAt ?? 0)
    setup.unmount()
    bridgeState.current = null

    const { unmount, status } = mountFollower(null)

    expect(bridge().subscribe).toHaveBeenCalledWith('wf-1')
    expect(status().workflowId).toBe('wf-1')
    unmount()
  })

  it('FEC-5: an idle doc still expires', () => {
    vi.useFakeTimers()
    const setup = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    setup.unmount()
    bridgeState.current = null

    vi.advanceTimersByTime(5 * 60 * 1000)
    const { unmount, status } = mountFollower(null)

    expect(bridge().subscribe).not.toHaveBeenCalled()
    expect(status().workflowId).toBeNull()
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
    const { unmount, status } = mountFollower('wf-1')
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

    bridge().follower.updatesApplied = 3
    dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 44 })
    expect(status().updatesApplied).toBe(3)

    dispatchFrame('follower_replaced', { workflowId: 'wf-2' })
    expect(status().updatesApplied).toBe(3)
    expect(adapterState.bind).toHaveBeenCalledTimes(1)

    dispatchFrame('follower_replaced', { workflowId: 'wf-1' })
    expect(status().updatesApplied).toBe(0)
    expect(adapterState.clearForReset).toHaveBeenLastCalledWith('wf-1', {
      source: 'agent-remote',
      actor: 'agent-lineage',
      opId: 'follower-replaced:wf-1'
    })
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

    enqueue([
      {
        op: 'delete_node',
        node_id: '1',
        removed_links: []
      }
    ])

    expect(clientState.sendOps).toHaveBeenCalledWith(
      'wf-1',
      expect.any(String),
      [expect.objectContaining({ op: 'delete_node', node_id: '1' })]
    )
    unmount()
  })

  it('a refused subscription settles the in-flight batch undeliverable at the resend instead of reaching the client', async () => {
    vi.useFakeTimers()
    const { recordDevEvent } = await import('./devPanelLog')
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

    enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
    expect(clientState.sendOps).toHaveBeenCalledTimes(1)

    // The real bridge clears its send reality on doc_subscribed{ok:false}
    // (LayoutFollowerBridge.onDocSubscribed); FakeBridge does not, so mirror
    // that effect by hand. The sender gates on this value alone.
    bridge().subscribedWorkflowId = null
    vi.advanceTimersByTime(10_000)

    expect(clientState.sendOps).toHaveBeenCalledTimes(1)
    const settledStates = vi
      .mocked(recordDevEvent)
      .mock.calls.filter(([event]) => event === 'human_ops_settled')
      .map(([, detail]) => (detail as { state: string }).state)
    expect(settledStates).toEqual(['undeliverable'])
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

  describe('linkEndpoints', () => {
    it('reads origin/target from the LiteGraph tuple stored in the root links map', () => {
      expect(linkEndpoints([7, 1, 0, 2, 0, 'IMAGE'])).toEqual({
        originId: '1',
        targetId: '2'
      })
      expect(linkEndpoints([7, 'n1', 0, 'n2', 0, 'IMAGE'])).toEqual({
        originId: 'n1',
        targetId: 'n2'
      })
    })

    it('falls back to the object form used under definitions.<id>.links', () => {
      expect(linkEndpoints({ origin_id: 'a', target_id: 'b' })).toEqual({
        originId: 'a',
        targetId: 'b'
      })
    })

    it('returns null for anything that is not a link record', () => {
      expect(linkEndpoints(null)).toBeNull()
      expect(linkEndpoints('nope')).toBeNull()
      expect(linkEndpoints([7])).toBeNull()
      expect(linkEndpoints({ origin_id: 'a' })).toBeNull()
    })
  })

  describe('replay queue wiring', () => {
    it('mm3-20: enqueues added nodes and tuple-form links when the gate is on', () => {
      localStorage.setItem(REPLAY_STORAGE_KEY, 'true')
      vi.useFakeTimers()
      const { unmount, status, pendingReplayNodeIds } = mountFollower('wf-1')

      bridge().docMaps = {
        nodes: { n1: {}, n2: {} },
        links: { '7': [7, 'n1', 0, 'n2', 0, 'IMAGE'] }
      }
      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 1 })

      expect(pendingReplayNodeIds()).toEqual(new Set(['n1', 'n2']))
      expect(status().replayState).toBe('loading')

      vi.runAllTimers()

      const stepEvents = vi
        .mocked(recordDevEvent)
        .mock.calls.filter(([type]) => type === 'replay_step')
      expect(stepEvents.length).toBeGreaterThan(0)
      const linkIds = stepEvents.flatMap(
        ([, payload]) => (payload as { linkIds: readonly string[] }).linkIds
      )
      expect(linkIds).toContain('7')
      expect(status().replayState).toBe('complete')
      expect(pendingReplayNodeIds().size).toBe(0)
      unmount()
    })

    it('mm3-20: leaves the queue untouched when the gate is off (default)', () => {
      vi.useFakeTimers()
      const { unmount, status, pendingReplayNodeIds } = mountFollower('wf-1')

      bridge().docMaps = {
        nodes: { n1: {} },
        links: { '7': [7, 'n1', 0, 'n2', 0, 'IMAGE'] }
      }
      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 1 })
      vi.runAllTimers()

      expect(pendingReplayNodeIds().size).toBe(0)
      expect(status().replayState).toBe('idle')
      expect(
        vi
          .mocked(recordDevEvent)
          .mock.calls.some(([type]) => type === 'replay_step')
      ).toBe(false)
      unmount()
    })
  })
})
