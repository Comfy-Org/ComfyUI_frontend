/**
 * Composable-owned behavior only (plan 3.5's subscribe-robustness probes):
 * the bridge/client mechanics have their own suites
 * (followerSubscription.test.ts, docFrameClient.test.ts), so both are
 * module-mocked here and every assertion targets what the COMPOSABLE adds -
 * the FE-1901 bounded subscribe retry, the FE-1902 sessionStorage rebind,
 * the frame-handler status surface, and total teardown.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref, shallowRef } from 'vue'
import type { Ref } from 'vue'
import * as Y from 'yjs'

import { render } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'

import type { GraphMutations } from './graphMutations'
import type { ExportedSubgraph } from '@/lib/litegraph/src/types/serialisation'
import type { reportError as reportErrorFn } from '@/platform/telemetry/reportError'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import type {
  MaterializableGraph,
  SubgraphDefinitionReadState
} from './agentNodeMaterializer'
import type { DocFrameTransport } from './docFrameClient'
import type { GraphOperation } from './graphOperations'
import type { BatchOutcome, OpSenderDeps } from './opSender'

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
  return {
    FakeBridge,
    current: null as InstanceType<typeof FakeBridge> | null
  }
})

const clientState = vi.hoisted(() => ({
  destroy: vi.fn(),
  sendOps: vi.fn<OpSenderDeps['sendOps']>(() => true),
  transport: null as DocFrameTransport | null
}))

const adapterState = vi.hoisted(() => ({
  intent: null as {
    pendingDeletes(workflowId: string): ReadonlySet<string>
  } | null,
  bind: vi.fn(),
  unbind: vi.fn(),
  applyFrame: vi.fn(() => true),
  clearForReset: vi.fn(),
  discardPending: vi.fn(),
  destroy: vi.fn()
}))

const materializerState = vi.hoisted(() => ({
  reconcileAgentAdapters: vi.fn(() => [] as NodeId[]),
  subgraphDefinitionReadState: vi.fn<
    (
      rootGraph: MaterializableGraph['rootGraph'],
      id: string
    ) => SubgraphDefinitionReadState
  >((rootGraph: MaterializableGraph['rootGraph'], id: string) =>
    rootGraph.subgraphs.has(id) ? ('registered' as const) : ('missing' as const)
  )
}))

// The reader is module-mocked too: these tests only check that the composable
// hands whatever it read from the bridge's doc through to the materializer.
const definitionsState = vi.hoisted(() => ({
  fakeDefinitions: [
    { id: '11111111-1111-4111-8111-111111111111' } as ExportedSubgraph
  ],
  readSubgraphDefinitionIds: vi.fn(() => [
    '11111111-1111-4111-8111-111111111111'
  ]),
  readSubgraphDefinitions: vi.fn(() => definitionsState.fakeDefinitions)
}))

const telemetryState = vi.hoisted(() => ({
  reportError: vi.fn<typeof reportErrorFn>()
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
    constructor(transport: DocFrameTransport) {
      clientState.transport = transport
    }
  }
}))

vi.mock<unknown>(import('./ecsFollowerAdapter'), () => ({
  EcsFollowerAdapter: class {
    constructor(
      _mutations: unknown,
      intent: {
        pendingDeletes(workflowId: string): ReadonlySet<string>
      }
    ) {
      adapterState.intent = intent
    }

    bind = adapterState.bind
    unbind = adapterState.unbind
    applyFrame = adapterState.applyFrame
    clearForReset = adapterState.clearForReset
    discardPending = adapterState.discardPending
    destroy = adapterState.destroy
  }
}))

vi.mock(import('./agentNodeMaterializer'), () => ({
  reconcileAgentAdapters: materializerState.reconcileAgentAdapters,
  subgraphDefinitionReadState: materializerState.subgraphDefinitionReadState
}))

vi.mock(import('./agentSubgraphDefinitions'), () => ({
  allSubgraphDefinitions: (definitions: readonly ExportedSubgraph[]) => [
    ...definitions
  ],
  readSubgraphDefinitionIds: definitionsState.readSubgraphDefinitionIds,
  readSubgraphDefinitions: definitionsState.readSubgraphDefinitions
}))

vi.mock(import('./devPanelLog'), () => ({
  recordDevEvent: vi.fn(),
  sanitizeDevEventDetail: vi.fn((detail: unknown) => detail)
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: telemetryState.reportError
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({ api: apiState.api }))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { graph: null, canvas: null }
}))

import { SUBSCRIBE_ACK_TIMEOUT_MS } from './agentCrdtDocLifecycle'
import {
  STALE_AFTER_MS,
  SUBSCRIBE_CATCHUP_GRACE_MS,
  useAgentCrdtFollower
} from './useAgentCrdtFollower'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

const graphMutations = {} as GraphMutations
const DOC_ID_KEY = 'Comfy.Agent.CrdtDocId'
const TEARDOWN_ERROR_TYPE = 'failure_tearing_down_agent_crdt_follower'

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
  initiallyActive = true,
  getGraph: () => MaterializableGraph | null = () => null,
  events: Parameters<typeof useAgentCrdtFollower>[5] = {}
): {
  unmount: () => void
  workflowId: Ref<string | null>
  isTargetActive: Ref<boolean>
  status: () => AgentCrdtStatus
  enqueue: (operations: GraphOperation[]) => void
} {
  const workflowId = ref<string | null>(initial)
  const isTargetActive = ref(initiallyActive)
  let exposedStatus!: () => AgentCrdtStatus
  let enqueue!: (operations: GraphOperation[]) => void
  const host = defineComponent({
    setup() {
      const { status, enqueueHumanOperations } = useAgentCrdtFollower(
        workflowId,
        graphMutations,
        () => null,
        isTargetActive,
        getGraph,
        events
      )
      exposedStatus = () => status.value as AgentCrdtStatus
      enqueue = enqueueHumanOperations
      return () => null
    }
  })
  const { unmount } = render(host)
  return { unmount, workflowId, isTargetActive, status: exposedStatus, enqueue }
}

function bridge(): InstanceType<(typeof bridgeState)['FakeBridge']> {
  const current = bridgeState.current
  if (!current) throw new Error('no bridge constructed')
  return current
}

function reportedTeardownErrors(): unknown[] {
  return telemetryState.reportError.mock.calls
    .filter(([, options]) => options.errorType === TEARDOWN_ERROR_TYPE)
    .map(([cause]) => cause)
}

function dispatchFrame(type: string, detail: unknown): void {
  bridge().dispatchEvent(new CustomEvent(type, { detail }))
}

describe('useAgentCrdtFollower', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
    sessionStorage.clear()
    bridgeState.current = null
    clientState.transport = null
    materializerState.reconcileAgentAdapters.mockReset().mockReturnValue([])
    materializerState.subgraphDefinitionReadState.mockImplementation(
      (rootGraph, id) =>
        rootGraph.subgraphs.has(id) ? 'registered' : 'missing'
    )
    definitionsState.readSubgraphDefinitionIds.mockClear()
    definitionsState.readSubgraphDefinitions.mockClear()
  })

  it('records only the length of an outbound frame that is not a JSON object', async () => {
    const { recordDevEvent } = await import('./devPanelLog')
    const { unmount } = mountFollower('wf-1')
    const transport = clientState.transport
    if (!transport) throw new Error('Expected the client transport')

    expect(transport.send('not json')).toBe(true)
    expect(transport.send('[1,2]')).toBe(true)
    expect(transport.send('null')).toBe(true)
    expect(transport.send('42')).toBe(true)
    expect(transport.send('{"type":"doc_subscribe"}')).toBe(true)

    const outbound = vi
      .mocked(recordDevEvent)
      .mock.calls.filter(([kind]) => kind === 'ws_out')
      .map(([, detail]) => detail)
    expect(outbound).toEqual([
      { delivered: true, frame: null, unparsed_chars: 8 },
      { delivered: true, frame: null, unparsed_chars: 5 },
      { delivered: true, frame: null, unparsed_chars: 4 },
      { delivered: true, frame: null, unparsed_chars: 2 },
      { delivered: true, frame: { type: 'doc_subscribe' } }
    ])
    expect(JSON.stringify(outbound)).not.toContain('not json')
    unmount()
  })

  it('does not construct a follower when the product gate is disabled', () => {
    useAgentPanelStore().enabled = false
    const { status, unmount } = mountFollower('wf-1')

    expect(status()).toMatchObject({
      enabled: false,
      connected: false,
      workflowId: null,
      updatesApplied: 0
    })
    expect(bridgeState.current).toBeNull()
    expect(adapterState.bind).not.toHaveBeenCalled()
    unmount()
  })

  it('starts on flag delivery and stops synchronously on revocation', async () => {
    const store = useAgentPanelStore()
    store.enabled = false
    const { status, workflowId, unmount } = mountFollower('wf-1')
    expect(bridgeState.current).toBeNull()

    store.enabled = true
    const first = bridge()
    expect(first.subscribe).toHaveBeenCalledExactlyOnceWith('wf-1')
    first.dispatchEvent(
      new CustomEvent('doc_subscribed', { detail: { ok: true } })
    )
    expect(status().connected).toBe(true)

    store.enabled = false
    expect(first.destroy).toHaveBeenCalledOnce()
    expect(clientState.destroy).toHaveBeenCalledOnce()
    expect(adapterState.destroy).toHaveBeenCalledOnce()
    expect(status()).toMatchObject({
      enabled: false,
      connected: false,
      workflowId: null
    })

    const applies = adapterState.applyFrame.mock.calls.length
    first.dispatchEvent(
      new CustomEvent('doc_update', { detail: { workflowId: 'wf-1', seq: 42 } })
    )
    apiState.target.dispatchEvent(new Event('reconnected'))
    vi.advanceTimersByTime(STALE_AFTER_MS * 2)
    workflowId.value = 'wf-2'
    await nextTick()
    expect(first.subscribe).toHaveBeenCalledTimes(1)
    expect(first.resubscribe).not.toHaveBeenCalled()
    expect(adapterState.applyFrame).toHaveBeenCalledTimes(applies)

    store.enabled = true
    expect(bridge()).not.toBe(first)
    expect(bridge().subscribe).toHaveBeenCalledExactlyOnceWith('wf-2')
    unmount()
    expect(first.destroy).toHaveBeenCalledOnce()
    expect(bridge().destroy).toHaveBeenCalledOnce()
  })

  it('cannot enable transport through diagnostic, legacy URL, storage or build controls', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_AGENT_CRDT_FOLLOWER', 'true')
    window.history.replaceState({}, '', '/?crdtDebug=1&agentCrdtFollower=1')
    localStorage.setItem('Comfy.Agent.CrdtFollower', 'true')
    vi.resetModules()
    const diagnostics = await import('./crdtDebugGate')
    expect(diagnostics.isCrdtDebugEnabled()).toBe(true)
    expect(diagnostics.resolveDebugPanelEnabled(false)).toBe(false)

    useAgentPanelStore().enabled = false
    const { status, unmount } = mountFollower('wf-1')
    expect(status().enabled).toBe(false)
    expect(bridgeState.current).toBeNull()
    expect('__agentCrdtPoc' in window).toBe(false)
    unmount()
  })

  it('keeps product transport enabled when diagnostics and legacy controls are off', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_AGENT_CRDT_FOLLOWER', 'false')
    window.history.replaceState({}, '', '/?crdtDebug=0&agentCrdtFollower=0')
    vi.resetModules()
    const diagnostics = await import('./crdtDebugGate')
    expect(diagnostics.isCrdtDebugEnabled()).toBe(false)
    expect(diagnostics.resolveDebugPanelEnabled(true)).toBe(false)

    const { status, unmount } = mountFollower('wf-1')
    expect(status().enabled).toBe(true)
    expect(bridge().subscribe).toHaveBeenCalledExactlyOnceWith('wf-1')
    expect('__agentCrdtPoc' in window).toBe(false)
    unmount()
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
    // Below the retry backoff's own delay: anything firing here would be
    // FE-1901's refused-subscribe retry, not the PM-1405 catch-up probe.
    vi.advanceTimersByTime(499)

    expect(bridge().resubscribe).not.toHaveBeenCalled()
    expect(status().connected).toBe(true)
    unmount()
  })

  it('PM-1405: a confirmed subscribe with no catch-up actively resubscribes well before the stale budget', () => {
    vi.useFakeTimers()
    const { unmount, status } = mountFollower('wf-1')

    dispatchFrame('doc_subscribed', { ok: true })
    expect(status().connected).toBe(true)

    // No catch-up doc_update ever arrives: the missing-catch-up probe should
    // fire, not the full STALE_AFTER_MS heartbeat.
    vi.advanceTimersByTime(SUBSCRIBE_CATCHUP_GRACE_MS - 1)
    expect(bridge().resubscribe).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('PM-1405: a catch-up that lands before the probe cancels it', () => {
    vi.useFakeTimers()
    const { unmount } = mountFollower('wf-1')

    dispatchFrame('doc_subscribed', { ok: true })
    vi.advanceTimersByTime(SUBSCRIBE_CATCHUP_GRACE_MS - 1)
    dispatchFrame('doc_update', {
      workflowId: 'wf-1',
      seq: 1,
      actor: 'agent',
      update: new Uint8Array()
    })

    // The catch-up landed just in time: the probe is disarmed and the
    // channel now follows the full recency budget, not the short grace one.
    vi.advanceTimersByTime(STALE_AFTER_MS - 2)
    expect(bridge().resubscribe).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
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

  it('FEC-5: refuses an empty doc id rather than subscribing to it', () => {
    const setup = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    setup.unmount()
    bridgeState.current = null
    writeRawRecord({ docId: '', nonce: persistedRecord()?.nonce })

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
    // The catch-up: clears the PM-1405 grace probe before it can fire, same
    // as a healthy subscribe would in production.
    dispatchFrame('doc_update', {
      workflowId: 'wf-1',
      seq: 0,
      actor: 'agent',
      update: new Uint8Array()
    })
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

  it('FEC-5: only active-workflow op results slide the persisted expiry', () => {
    vi.useFakeTimers()
    const { isTargetActive, unmount } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    const stampedAt = persistedRecord()?.expiresAt
    expect(stampedAt).toBeTypeOf('number')

    vi.advanceTimersByTime(3 * 60 * 1000)
    dispatchFrame('doc_ops_result', { workflowId: 'wf-2', ok: true })
    expect(persistedRecord()?.expiresAt).toBe(stampedAt)

    isTargetActive.value = false
    dispatchFrame('doc_ops_result', { workflowId: 'wf-1', ok: true })
    expect(persistedRecord()?.expiresAt).toBe(stampedAt)

    isTargetActive.value = true
    dispatchFrame('doc_ops_result', { workflowId: 'wf-1', ok: true })
    expect(persistedRecord()?.expiresAt).toBeGreaterThan(stampedAt ?? 0)
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

  it('does not bypass refused-subscribe backoff on status frames', () => {
    vi.useFakeTimers()
    const { unmount } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: false })

    apiState.target.dispatchEvent(new Event('status'))
    expect(bridge().reconcile).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
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

  describe('s5-metrics-1: per-outcome counters', () => {
    it('counts received and applied for a frame that passes the filter', () => {
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 7 })

      expect(status().outcomes).toEqual({
        received: 1,
        applied: 1,
        skipped: 0,
        errored: 0,
        gap: 0,
        reset: 0,
        dropped: 0
      })
      unmount()
    })

    it('counts received and skipped for a frame from an unsubscribed workflow, without applying it', () => {
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('doc_update', { workflowId: 'wf-other', seq: 7 })

      expect(status().outcomes.received).toBe(1)
      expect(status().outcomes.skipped).toBe(1)
      expect(status().outcomes.applied).toBe(0)
      expect(adapterState.applyFrame).not.toHaveBeenCalled()
      unmount()
    })

    it('counts skipped, not applied, while the target is inactive', () => {
      const { unmount, status } = mountFollower('wf-a', false)

      dispatchFrame('doc_update', { workflowId: 'wf-a', seq: 7 })

      expect(status().outcomes.received).toBe(1)
      expect(status().outcomes.skipped).toBe(1)
      expect(status().outcomes.applied).toBe(0)
      unmount()
    })

    it('counts skipped, not applied, when the adapter has no bound session for the frame', () => {
      adapterState.applyFrame.mockReturnValueOnce(false)
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 7 })

      expect(adapterState.applyFrame).toHaveBeenCalledTimes(1)
      expect(status().outcomes.received).toBe(1)
      expect(status().outcomes.skipped).toBe(1)
      expect(status().outcomes.applied).toBe(0)
      unmount()
    })

    it('counts errored on a schema_error and does not touch applied/received', () => {
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('schema_error', { workflowId: 'wf-1', code: 'unreadable' })

      expect(status().outcomes.errored).toBe(1)
      expect(status().outcomes.received).toBe(0)
      unmount()
    })

    it('counts gap on the bridge doc_gap signal, which never becomes a doc_update', () => {
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('doc_gap', { workflowId: 'wf-1', expected: 3, received: 5 })

      expect(status().outcomes.gap).toBe(1)
      expect(status().outcomes.received).toBe(0)
      expect(status().outcomes.applied).toBe(0)
      unmount()
    })

    it('counts dropped on the bridge doc_stale signal, which never becomes a doc_update', () => {
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('doc_stale', { workflowId: 'wf-1', seq: 2 })

      expect(status().outcomes.dropped).toBe(1)
      expect(status().outcomes.received).toBe(0)
      unmount()
    })

    it('counts reset on an explicit doc_reset for the bound workflow', () => {
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('doc_reset', {
        workflowId: 'wf-1',
        actor: 'agent:turn',
        seq: 43
      })

      expect(status().outcomes.reset).toBe(1)
      unmount()
    })

    it('counts reset while the target is inactive, since the bridge replaced its doc regardless', () => {
      const { unmount, status } = mountFollower('wf-a', false)

      dispatchFrame('doc_reset', {
        workflowId: 'wf-a',
        actor: 'agent:turn',
        seq: 43
      })

      expect(status().outcomes.reset).toBe(1)
      expect(adapterState.clearForReset).not.toHaveBeenCalled()
      unmount()
    })

    it('does not double-count reset on the follower_replaced that follows a doc_reset', () => {
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('doc_reset', {
        workflowId: 'wf-1',
        actor: 'agent:turn',
        seq: 43
      })
      dispatchFrame('follower_replaced', { workflowId: 'wf-1' })

      expect(status().outcomes.reset).toBe(1)
      unmount()
    })

    it('accumulates received/applied/skipped across mixed frames without resetting on unrelated activity', () => {
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 1 })
      dispatchFrame('doc_update', { workflowId: 'wf-other', seq: 2 })
      dispatchFrame('doc_gap', { workflowId: 'wf-1', expected: 2, received: 4 })
      dispatchFrame('doc_stale', { workflowId: 'wf-1', seq: 1 })
      dispatchFrame('schema_error', { workflowId: 'wf-1', code: 'unreadable' })
      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 4 })

      expect(status().outcomes).toEqual({
        received: 3,
        applied: 2,
        skipped: 1,
        errored: 1,
        gap: 1,
        reset: 0,
        dropped: 1
      })
      unmount()
    })
  })

  describe('live-graph reconcile', () => {
    // The materializer is module-mocked, so the graph only needs to be a
    // distinct reference the composable hands through.
    const { fakeDefinitions } = definitionsState
    const fakeGraph = {
      rootGraph: { subgraphs: new Map() },
      setDirtyCanvas: vi.fn()
    } as unknown as MaterializableGraph

    it('counts the frame even when a removal hook throws out of the reconcile', () => {
      // The orphan sweep inside `reconcileAgentAdapters` calls `graph.remove()`,
      // which runs extension `onRemoved()` uncaught. `received === applied +
      // skipped` has to survive that, so the outcome must be decided before the
      // sweep runs.
      materializerState.reconcileAgentAdapters.mockImplementationOnce(() => {
        throw new Error('onRemoved threw')
      })
      const { unmount, status } = mountFollower('wf-1', true, () => fakeGraph)

      expect(() =>
        dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 9 })
      ).toThrow('onRemoved threw')

      const { received, applied, skipped } = status().outcomes
      expect(received).toBe(1)
      expect(applied + skipped).toBe(received)
      unmount()
    })

    it('reconciles the live graph after every applied frame', () => {
      const { unmount } = mountFollower('wf-1', true, () => fakeGraph)

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 9 })

      expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledTimes(1)
      expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
        fakeGraph,
        fakeDefinitions
      )
      // A frame that only connects nodes changes no layout, so the repaint
      // has to come from here or the new wire stays invisible until a pan.
      expect(fakeGraph.setDirtyCanvas).toHaveBeenCalledWith(true, true)
      // Definitions come from the doc the bridge currently follows, so a
      // doc_reset remint (which swaps the FollowerDoc) is read fresh.
      expect(definitionsState.readSubgraphDefinitions).toHaveBeenCalledWith(
        bridge().follower.doc,
        new Set()
      )
      unmount()
    })

    it('does not deep-copy definitions for a frame when all are registered', () => {
      const registeredGraph = {
        rootGraph: {
          subgraphs: new Map([[fakeDefinitions[0].id, {}]])
        },
        setDirtyCanvas: vi.fn()
      } as unknown as MaterializableGraph
      const { unmount } = mountFollower('wf-1', true, () => registeredGraph)

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 9 })

      expect(definitionsState.readSubgraphDefinitionIds).toHaveBeenCalledWith(
        bridge().follower.doc
      )
      expect(definitionsState.readSubgraphDefinitions).not.toHaveBeenCalled()
      expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
        registeredGraph,
        []
      )
      unmount()
    })

    it('does not deep-copy a definition body after registration already failed', () => {
      materializerState.subgraphDefinitionReadState.mockReturnValue('failed')
      const { unmount } = mountFollower('wf-1', true, () => fakeGraph)

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 9 })

      expect(
        materializerState.subgraphDefinitionReadState
      ).toHaveBeenCalledWith(fakeGraph.rootGraph, fakeDefinitions[0].id)
      expect(definitionsState.readSubgraphDefinitions).not.toHaveBeenCalled()
      expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
        fakeGraph,
        [],
        new Set([fakeDefinitions[0].id])
      )
      unmount()
    })

    it('does not reconcile after a frame the adapter skipped', () => {
      adapterState.applyFrame.mockReturnValueOnce(false)
      const { unmount, status } = mountFollower('wf-1', true, () => fakeGraph)

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 9 })

      expect(status().outcomes.skipped).toBe(1)
      expect(materializerState.reconcileAgentAdapters).not.toHaveBeenCalled()
      unmount()
    })

    it('skips the reconcile while no graph exists', () => {
      // Default getGraph (no override) always returns null — mirrors the
      // panel mounting before the root graph exists.
      const { unmount } = mountFollower('wf-1')

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 9 })

      expect(materializerState.reconcileAgentAdapters).not.toHaveBeenCalled()
      unmount()
    })

    it('reconciles once the graph appears, without waiting for another frame', async () => {
      const graph = shallowRef<MaterializableGraph | null>(null)
      const { unmount } = mountFollower('wf-1', true, () => graph.value)

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 9 })
      expect(materializerState.reconcileAgentAdapters).not.toHaveBeenCalled()

      graph.value = fakeGraph
      await nextTick()

      expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledTimes(1)
      expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
        fakeGraph,
        fakeDefinitions
      )
      unmount()
    })

    it('reports a pending live arrival when graph readiness materializes it', async () => {
      const graph = shallowRef<MaterializableGraph | null>(null)
      const onMaterialized = vi.fn()
      const { unmount } = mountFollower('wf-1', true, () => graph.value, {
        onMaterialized
      })
      bridge().follower.doc = {
        getMap: () => ({ toJSON: () => ({ '3': {} }) })
      }

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn',
        catchUp: false
      })
      expect(onMaterialized).not.toHaveBeenCalled()

      materializerState.reconcileAgentAdapters.mockReturnValue([toNodeId(3)])
      graph.value = fakeGraph
      await nextTick()

      expect(onMaterialized).toHaveBeenCalledExactlyOnceWith({
        workflowId: 'wf-1',
        actor: undefined,
        nodeIds: [toNodeId(3)]
      })
      unmount()
    })

    it('does not reconcile for a graph that appears while the target is inactive', async () => {
      const graph = shallowRef<MaterializableGraph | null>(null)
      const { unmount } = mountFollower('wf-1', false, () => graph.value)

      graph.value = fakeGraph
      await nextTick()

      expect(materializerState.reconcileAgentAdapters).not.toHaveBeenCalled()
      unmount()
    })

    it('reconciles when the target is activated after the graph became ready', async () => {
      // The other readiness ordering: the graph arrives while inactive, so the
      // `getGraph` watcher correctly skips it. Activation does not change the
      // graph identity, so nothing re-triggers that watcher -- the reconcile
      // has to happen where the active binding is established.
      const graph = shallowRef<MaterializableGraph | null>(null)
      const { unmount, isTargetActive } = mountFollower(
        'wf-1',
        false,
        () => graph.value
      )

      graph.value = fakeGraph
      await nextTick()
      expect(materializerState.reconcileAgentAdapters).not.toHaveBeenCalled()

      isTargetActive.value = true
      await nextTick()

      expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
        fakeGraph,
        fakeDefinitions
      )
      unmount()
    })

    it('reconciles after a doc_reset clear, without waiting for another frame', () => {
      // `clearForReset` empties the stores only. Every live adapter survives it
      // and would be serialised back into a save until some later frame landed.
      const { unmount } = mountFollower('wf-1', true, () => fakeGraph)

      dispatchFrame('doc_reset', {
        workflowId: 'wf-1',
        actor: 'agent:turn',
        seq: 43
      })

      expect(adapterState.clearForReset).toHaveBeenCalled()
      expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
        fakeGraph,
        fakeDefinitions
      )
      unmount()
    })

    it('reconciles a follower_replaced clear against the replacement document', () => {
      const { unmount } = mountFollower('wf-1', true, () => fakeGraph)
      const replacementDoc = { getMap: () => ({ toJSON: () => ({}) }) }
      bridge().follower = { updatesApplied: 0, doc: replacementDoc }

      dispatchFrame('follower_replaced', { workflowId: 'wf-1' })

      expect(adapterState.clearForReset).toHaveBeenCalled()
      expect(
        definitionsState.readSubgraphDefinitionIds
      ).toHaveBeenLastCalledWith(replacementDoc)
      expect(definitionsState.readSubgraphDefinitions).toHaveBeenLastCalledWith(
        replacementDoc,
        new Set()
      )
      expect(materializerState.reconcileAgentAdapters).toHaveBeenCalledWith(
        fakeGraph,
        fakeDefinitions
      )
      unmount()
    })

    it('records a dev event only when nodes were materialized', async () => {
      const { recordDevEvent } = await import('./devPanelLog')
      const { unmount } = mountFollower('wf-1', true, () => fakeGraph)

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 9 })
      materializerState.reconcileAgentAdapters.mockReturnValue([toNodeId(1)])
      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 10 })

      const materializedEvents = vi
        .mocked(recordDevEvent)
        .mock.calls.filter(
          ([event]) => event === 'agent_node_adapters_materialized'
        )
      expect(materializedEvents).toEqual([
        [
          'agent_node_adapters_materialized',
          { workflowId: 'wf-1', nodeIds: [toNodeId(1)] }
        ]
      ])
      unmount()
    })

    it('reports only live agent materializations, not reconnect catch-up', () => {
      const onMaterialized = vi.fn()
      materializerState.reconcileAgentAdapters.mockReturnValue([toNodeId(1)])
      const { unmount } = mountFollower('wf-1', true, () => fakeGraph, {
        onMaterialized
      })

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn',
        catchUp: true
      })
      expect(onMaterialized).not.toHaveBeenCalled()

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 10,
        actor: 'human:user:tab',
        catchUp: false
      })
      expect(onMaterialized).not.toHaveBeenCalled()

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 11,
        actor: 'agent:thread:turn',
        catchUp: false
      })
      expect(onMaterialized).toHaveBeenCalledExactlyOnceWith({
        workflowId: 'wf-1',
        actor: 'agent:thread:turn',
        nodeIds: [toNodeId(1)]
      })
      unmount()
    })

    it('retains a live add until a dependency makes the node visible', () => {
      const onMaterialized = vi.fn()
      const graph = fromPartial<MaterializableGraph>({
        ...fakeGraph,
        _nodes_by_id: { [toNodeId(3)]: {} }
      })
      const { unmount } = mountFollower('wf-1', true, () => graph, {
        onMaterialized
      })
      let nodes: Record<string, unknown> = {}
      bridge().follower.doc = {
        getMap: () => ({ toJSON: () => nodes })
      }
      const source = new Y.Doc()
      source.getMap('nodes').set('3', { type: 'KSampler' })

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 5,
        actor: 'agent:thread:turn',
        catchUp: false,
        update: Y.encodeStateAsUpdate(source)
      })
      expect(onMaterialized).not.toHaveBeenCalled()

      nodes = { '3': {} }
      materializerState.reconcileAgentAdapters.mockReturnValue([toNodeId(3)])
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 4,
        actor: 'host:catch-up',
        catchUp: true,
        update: new Uint8Array()
      })

      expect(onMaterialized).toHaveBeenCalledExactlyOnceWith({
        workflowId: 'wf-1',
        actor: undefined,
        nodeIds: [toNodeId(3)]
      })
      unmount()
    })

    it('does not attribute a human recreation after a pending node was deleted', () => {
      const onMaterialized = vi.fn()
      const graph = shallowRef<MaterializableGraph | null>(null)
      const readyGraph = fromPartial<MaterializableGraph>({
        ...fakeGraph,
        _nodes_by_id: { [toNodeId(3)]: {} }
      })
      let nodes: Record<string, unknown> = {}
      const { unmount } = mountFollower('wf-1', true, () => graph.value, {
        onMaterialized
      })
      bridge().follower.doc = {
        getMap: () => ({ toJSON: () => nodes })
      }

      const source = new Y.Doc()
      source.getMap('nodes').set('3', { type: 'KSampler' })
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn',
        catchUp: false,
        update: Y.encodeStateAsUpdate(source)
      })
      // The add never enters the observable document set because projection is
      // still waiting on a dependency; a later delete must still retire it.
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 10,
        actor: 'human:user:tab',
        catchUp: false
      })

      graph.value = readyGraph
      nodes = { '3': {} }
      materializerState.reconcileAgentAdapters.mockReturnValue([toNodeId(3)])
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 11,
        actor: 'human:user:tab',
        catchUp: false
      })

      expect(onMaterialized).not.toHaveBeenCalled()
      unmount()
    })
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

  it('sends minted human operations through the doc client', async () => {
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
    await Promise.resolve()

    expect(clientState.sendOps).toHaveBeenCalledWith(
      'wf-1',
      expect.any(String),
      [expect.objectContaining({ op: 'delete_node', node_id: '1' })]
    )
    unmount()
  })

  it('a refused subscription settles the transmitted in-flight batch unconfirmed at the resend instead of reaching the client', async () => {
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
    await Promise.resolve()
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
      .map(([, detail]) => (detail as BatchOutcome).state)
    expect(settledStates).toEqual(['unconfirmed'])
    unmount()
  })

  it('a refused subscription settles the transmitted in-flight batch unconfirmed immediately, without waiting the resend (residual of #16637)', async () => {
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
    await Promise.resolve()
    expect(clientState.sendOps).toHaveBeenCalledTimes(1)

    // Mirror the real bridge's onDocSubscribed: it clears send reality
    // BEFORE dispatching the event (layoutFollowerBridge.ts), so the
    // composable's onSubscribed handler observes the clear synchronously.
    bridge().subscribedWorkflowId = null
    dispatchFrame('doc_subscribed', { ok: false, workflowId: 'wf-1' })

    // No timer advance: the refusal itself is the abort signal.
    expect(clientState.sendOps).toHaveBeenCalledTimes(1)
    const settledStates = vi
      .mocked(recordDevEvent)
      .mock.calls.filter(([event]) => event === 'human_ops_settled')
      .map(([, detail]) => (detail as BatchOutcome).state)
    expect(settledStates).toEqual(['unconfirmed'])
    unmount()
  })

  it('a doc switch settles the transmitted in-flight batch for the old doc unconfirmed immediately, without waiting the resend', async () => {
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
    // Mirror the real bridge's reconcile(): a changed desired doc clears send
    // reality synchronously inside subscribe()/unsubscribe().
    bridge().subscribe.mockImplementation((next: string) => {
      bridge().subscribedWorkflowId = next === 'wf-1' ? 'wf-1' : null
    })

    enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
    await Promise.resolve()
    expect(clientState.sendOps).toHaveBeenCalledTimes(1)

    workflowId.value = 'wf-2'
    await nextTick()

    // No timer advance: the retarget itself is the abort signal.
    expect(clientState.sendOps).toHaveBeenCalledTimes(1)
    const settledStates = vi
      .mocked(recordDevEvent)
      .mock.calls.filter(([event]) => event === 'human_ops_settled')
      .map(([, detail]) => (detail as BatchOutcome).state)
    expect(settledStates).toEqual(['unconfirmed'])
    unmount()
  })

  it('pins a same-tick human edit to the workflow active at admission', async () => {
    const { enqueue, workflowId, unmount } = mountWithHumanOps()
    bridge().subscribe.mockImplementation((next: string) => {
      bridge().subscribedWorkflowId = next
    })

    enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
    workflowId.value = 'wf-2'
    await nextTick()

    expect(clientState.sendOps).toHaveBeenCalledTimes(1)
    expect(clientState.sendOps).toHaveBeenCalledWith(
      'wf-1',
      expect.any(String),
      [expect.objectContaining({ op: 'delete_node', node_id: '1' })]
    )
    unmount()
  })

  function mountWithHumanOps(): {
    enqueue: ReturnType<typeof useAgentCrdtFollower>['enqueueHumanOperations']
    workflowId: Ref<string | null>
    unmount: () => void
  } {
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
    return { enqueue, workflowId, unmount }
  }

  async function settledHumanOpStates(): Promise<string[]> {
    const { recordDevEvent } = await import('./devPanelLog')
    return vi
      .mocked(recordDevEvent)
      .mock.calls.filter(([event]) => event === 'human_ops_settled')
      .map(([, detail]) => (detail as BatchOutcome).state)
  }

  it('sends eight same-tick human deletes as one doc_ops batch in node order', async () => {
    const { enqueue, unmount } = mountWithHumanOps()

    for (let id = 1; id <= 8; id++)
      enqueue([{ op: 'delete_node', node_id: String(id), removed_links: [] }])
    await Promise.resolve()

    expect(clientState.sendOps).toHaveBeenCalledTimes(1)
    const [, , ops] = clientState.sendOps.mock.calls[0]
    expect(ops.map((op) => ('node_id' in op ? op.node_id : undefined))).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8']
    )
    unmount()
  })

  it('a doc_reset settles sent and queued human batches without another send', async () => {
    vi.useFakeTimers()
    const { enqueue, unmount } = mountWithHumanOps()

    enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
    await Promise.resolve()
    enqueue([{ op: 'delete_node', node_id: '2', removed_links: [] }])
    await Promise.resolve()
    expect(clientState.sendOps).toHaveBeenCalledTimes(1)

    dispatchFrame('doc_reset', { workflowId: 'wf-1', seq: 9, actor: 'agent:x' })

    expect(clientState.sendOps).toHaveBeenCalledTimes(1)
    expect(await settledHumanOpStates()).toEqual([
      'unconfirmed',
      'undeliverable'
    ])
    unmount()
  })

  it('a doc_reset cancels an admitted human edit before its deferred flush', async () => {
    const { enqueue, unmount } = mountWithHumanOps()

    enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
    dispatchFrame('doc_reset', { workflowId: 'wf-1', seq: 9, actor: 'agent:x' })
    await Promise.resolve()

    expect(clientState.sendOps).not.toHaveBeenCalled()
    expect(await settledHumanOpStates()).toEqual(['undeliverable'])
    unmount()
  })

  it('unbinding settles queued human batches and sends nothing more', async () => {
    vi.useFakeTimers()
    const { enqueue, workflowId, unmount } = mountWithHumanOps()
    bridge().unsubscribe.mockImplementation(() => {
      bridge().subscribedWorkflowId = null
    })

    enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
    await Promise.resolve()
    enqueue([{ op: 'delete_node', node_id: '2', removed_links: [] }])
    await Promise.resolve()
    enqueue([{ op: 'delete_node', node_id: '3', removed_links: [] }])
    await Promise.resolve()

    workflowId.value = null
    await nextTick()

    expect(clientState.sendOps).toHaveBeenCalledTimes(1)
    expect(await settledHumanOpStates()).toEqual([
      'unconfirmed',
      'undeliverable',
      'undeliverable'
    ])
    unmount()
  })

  describe('tab suspension of the human write leg', () => {
    type Enqueue = ReturnType<
      typeof useAgentCrdtFollower
    >['enqueueHumanOperations']

    function mountWriter(initial: string): {
      unmount: () => void
      workflowId: Ref<string | null>
      isTargetActive: Ref<boolean>
      enqueue: Enqueue
    } {
      const workflowId = ref<string | null>(initial)
      const isTargetActive = ref(true)
      let enqueue!: Enqueue
      const host = defineComponent({
        setup() {
          const { enqueueHumanOperations } = useAgentCrdtFollower(
            workflowId,
            graphMutations,
            () => null,
            isTargetActive
          )
          enqueue = enqueueHumanOperations
          return () => null
        }
      })
      const { unmount } = render(host)
      // Mirror the real bridge: reconcile() sets send reality synchronously
      // when a subscribe leaves the transport and clears it on unsubscribe.
      bridge().subscribe.mockImplementation((next: string) => {
        bridge().subscribedWorkflowId = next
      })
      bridge().unsubscribe.mockImplementation(() => {
        bridge().subscribedWorkflowId = null
      })
      return { unmount, workflowId, isTargetActive, enqueue }
    }

    function deleteNode(nodeId: string) {
      return { op: 'delete_node' as const, node_id: nodeId, removed_links: [] }
    }

    async function settledStates(): Promise<string[]> {
      const { recordDevEvent } = await import('./devPanelLog')
      return vi
        .mocked(recordDevEvent)
        .mock.calls.filter(([event]) => event === 'human_ops_settled')
        .map(([, detail]) => (detail as BatchOutcome).state)
    }

    function ackSent(index: number): void {
      const [workflowId, , ops] = clientState.sendOps.mock.calls[index]
      dispatchFrame('doc_ops_result', {
        workflowId,
        ok: true,
        applied: ops.map((op) => op.op_id),
        skipped: []
      })
    }

    beforeEach(async () => {
      vi.useFakeTimers()
      clientState.sendOps.mockClear()
      const { recordDevEvent } = await import('./devPanelLog')
      vi.mocked(recordDevEvent).mockClear()
    })

    it('holds the queued batch when the bound workflow tab goes inactive instead of settling it undeliverable', async () => {
      const { unmount, isTargetActive, enqueue } = mountWriter('wf-1')
      enqueue([deleteNode('1')])
      await Promise.resolve()
      enqueue([deleteNode('2')])
      expect(clientState.sendOps).toHaveBeenCalledTimes(1)

      isTargetActive.value = false
      await nextTick()
      ackSent(0)

      expect(bridge().unsubscribe).toHaveBeenCalled()
      expect(clientState.sendOps).toHaveBeenCalledTimes(1)
      expect(await settledStates()).toEqual(['acknowledged'])
      unmount()
    })

    it('sends the held batch to the same workflow when its tab becomes active again', async () => {
      const { unmount, isTargetActive, enqueue } = mountWriter('wf-1')
      enqueue([deleteNode('1')])
      await Promise.resolve()
      enqueue([deleteNode('2')])
      isTargetActive.value = false
      await nextTick()
      ackSent(0)

      isTargetActive.value = true
      await nextTick()

      expect(clientState.sendOps).toHaveBeenCalledTimes(2)
      expect(clientState.sendOps).toHaveBeenLastCalledWith(
        'wf-1',
        expect.any(String),
        [expect.objectContaining({ op: 'delete_node', node_id: '2' })]
      )
      expect(await settledStates()).toEqual(['acknowledged'])
      unmount()
    })

    it('a rebind to another workflow while its tab is not active settles the held batch undeliverable at once', async () => {
      const { unmount, workflowId, isTargetActive, enqueue } =
        mountWriter('wf-1')
      enqueue([deleteNode('1')])
      await Promise.resolve()
      enqueue([deleteNode('2')])
      isTargetActive.value = false
      await nextTick()
      ackSent(0)

      workflowId.value = 'wf-2'
      await nextTick()

      expect(clientState.sendOps).toHaveBeenCalledTimes(1)
      expect(await settledStates()).toEqual(['acknowledged', 'undeliverable'])
      unmount()
    })

    it('a rebind to another workflow fired together with the inactive edge aborts instead of holding', async () => {
      const { unmount, workflowId, isTargetActive, enqueue } =
        mountWriter('wf-1')
      enqueue([deleteNode('1')])
      await Promise.resolve()
      enqueue([deleteNode('2')])

      workflowId.value = 'wf-2'
      isTargetActive.value = false
      await nextTick()

      expect(clientState.sendOps).toHaveBeenCalledTimes(1)
      expect(await settledStates()).toEqual(['unconfirmed', 'undeliverable'])
      unmount()
    })

    it('a real detach while the tab is inactive settles the held batch undeliverable', async () => {
      const { unmount, workflowId, isTargetActive, enqueue } =
        mountWriter('wf-1')
      enqueue([deleteNode('1')])
      await Promise.resolve()
      enqueue([deleteNode('2')])
      isTargetActive.value = false
      await nextTick()
      ackSent(0)

      workflowId.value = null
      await nextTick()

      expect(await settledStates()).toEqual(['acknowledged', 'undeliverable'])
      unmount()
    })

    it('returning while the socket is down keeps the held batch and sends it once the subscribe is acknowledged', async () => {
      const { unmount, isTargetActive, enqueue } = mountWriter('wf-1')
      enqueue([deleteNode('1')])
      await Promise.resolve()
      enqueue([deleteNode('2')])
      isTargetActive.value = false
      await nextTick()
      ackSent(0)

      bridge().subscribe.mockImplementation(() => {})
      isTargetActive.value = true
      await nextTick()
      expect(clientState.sendOps).toHaveBeenCalledTimes(1)
      expect(await settledStates()).toEqual(['acknowledged'])

      bridge().subscribedWorkflowId = 'wf-1'
      dispatchFrame('doc_subscribed', { ok: true, workflowId: 'wf-1' })

      expect(clientState.sendOps).toHaveBeenCalledTimes(2)
      expect(clientState.sendOps).toHaveBeenLastCalledWith(
        'wf-1',
        expect.any(String),
        [expect.objectContaining({ op: 'delete_node', node_id: '2' })]
      )
      unmount()
    })

    it('keeps a human delete pending for the reconcile until the doc no longer holds the node', async () => {
      const { unmount, enqueue } = mountWriter('wf-1')
      const intent = adapterState.intent!
      let docNodes: Record<string, unknown> = { '1': {} }
      bridge().follower.doc.getMap = () => ({ toJSON: () => docNodes })

      enqueue([deleteNode('1')])
      expect([...intent.pendingDeletes('wf-1')]).toEqual(['1'])
      expect([...intent.pendingDeletes('wf-2')]).toEqual([])

      await Promise.resolve()
      ackSent(0)
      expect(await settledStates()).toEqual(['acknowledged'])
      expect([...intent.pendingDeletes('wf-1')]).toEqual(['1'])

      docNodes = {}
      expect([...intent.pendingDeletes('wf-1')]).toEqual([])
      unmount()
    })

    it('a refused resubscribe on return still settles the held batch undeliverable', async () => {
      const { unmount, isTargetActive, enqueue } = mountWriter('wf-1')
      enqueue([deleteNode('1')])
      await Promise.resolve()
      enqueue([deleteNode('2')])
      isTargetActive.value = false
      await nextTick()
      ackSent(0)

      bridge().subscribe.mockImplementation(() => {})
      isTargetActive.value = true
      await nextTick()
      dispatchFrame('doc_subscribed', { ok: false, workflowId: 'wf-1' })

      expect(clientState.sendOps).toHaveBeenCalledTimes(1)
      expect(await settledStates()).toEqual(['acknowledged', 'undeliverable'])
      unmount()
    })
  })

  it('probes a quiet bound channel once per budget and re-arms (BE-9740)', () => {
    vi.useFakeTimers()
    const { unmount } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    // The catch-up: past the PM-1405 grace window, this suite is about the
    // full-budget cadence on an already-current channel that then goes quiet.
    dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 1 })

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
    // The catch-up: clears the PM-1405 grace probe so what follows exercises
    // the full-budget sliding window, not the shorter grace one.
    dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 1 })

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

  it('retries a subscribe the bridge sent but nobody acknowledged', () => {
    vi.useFakeTimers()
    const { unmount } = mountFollower('wf-1')
    dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })

    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS - 1)
    expect(bridge().resubscribe).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('unmounting before the ack timeout leaves the retry unsent', () => {
    vi.useFakeTimers()
    const { unmount } = mountFollower('wf-1')
    dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })

    unmount()
    vi.advanceTimersByTime(3 * SUBSCRIBE_ACK_TIMEOUT_MS)

    expect(bridge().resubscribe).not.toHaveBeenCalled()
  })

  it('a reconnect mid-budget gives the silent subscribe a fresh budget', () => {
    vi.useFakeTimers()
    const { unmount } = mountFollower('wf-1')
    dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)
    dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(2)

    apiState.target.dispatchEvent(new Event('reconnected'))
    expect(bridge().resubscribe).toHaveBeenCalledTimes(3)
    dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)

    expect(bridge().resubscribe).toHaveBeenCalledTimes(4)
    unmount()
  })

  it('reports the follower disconnected once the silent-subscribe budget is spent', () => {
    vi.useFakeTimers()
    const { unmount, status } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    vi.advanceTimersByTime(1000)
    dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)
    dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)
    dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
    expect(status().connected).toBe(true)

    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)

    expect(status().connected).toBe(false)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(2)
    expect(telemetryState.reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      {
        errorType: 'failure_confirming_agent_doc_subscribe',
        level: 'warning',
        tags: { feature_area: 'agent', operation: 'sync', outcome: 'gave_up' }
      }
    )
    bridge().reconcile.mockClear()
    dispatchFrame('doc_subscribed', { ok: false })
    vi.advanceTimersByTime(30_000)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(2)
    apiState.target.dispatchEvent(new Event('status'))
    expect(bridge().reconcile).not.toHaveBeenCalled()

    apiState.target.dispatchEvent(new Event('reconnected'))
    expect(bridge().resubscribe).toHaveBeenCalledTimes(3)
    dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(4)
    unmount()
  })

  it('tears down totally on unmount, reporting every cleanup failure instead of throwing', () => {
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
    const listenerFailure = new Error('listener removal failed')
    const clientFailure = new Error('client destroy failed')
    apiState.api.removeEventListener.mockImplementation((type, listener) => {
      if (type === 'reconnected') throw listenerFailure
      apiState.target.removeEventListener(type, listener)
    })
    clientState.destroy.mockImplementation(() => {
      throw clientFailure
    })

    unmount()

    expect(hookErrors).toEqual([])
    expect(reportedTeardownErrors()).toStrictEqual([
      listenerFailure,
      clientFailure
    ])
    expect(adapterState.destroy).toHaveBeenCalled()
    expect(bridge().destroy).toHaveBeenCalled()
    expect(clientState.destroy).toHaveBeenCalled()
    expect(apiState.api.removeEventListener).toHaveBeenCalledWith(
      'status',
      expect.any(Function)
    )
  })

  it('reports cleanup failures that throw a nullish value', () => {
    const { unmount } = mountFollower('wf-1')
    apiState.api.removeEventListener.mockImplementation((type, listener) => {
      if (type === 'reconnected') throw null
      if (type === 'status') throw undefined
      apiState.target.removeEventListener(type, listener)
    })

    unmount()

    expect(reportedTeardownErrors()).toStrictEqual([null, undefined])
    expect(clientState.destroy).toHaveBeenCalled()
  })
})
