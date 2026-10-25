/**
 * Composable-owned behavior only (plan 3.5's subscribe-robustness probes):
 * the bridge/client mechanics have their own suites
 * (followerSubscription.test.ts, docFrameClient.test.ts), so both are
 * module-mocked here and every assertion targets what the COMPOSABLE adds -
 * the FE-1901 bounded subscribe retry, the FE-1902 sessionStorage rebind,
 * the frame-handler status surface, and total teardown.
 */
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, nextTick, ref, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { SCHEMA_VERSION } from '@comfyorg/comfy-multi-player'
import type { Op } from '@comfyorg/comfy-multi-player'

import { render } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'

import type { LGraph } from '@/lib/litegraph/src/litegraph'

import { useTelemetry } from '@/platform/telemetry'
import type { reportError as reportErrorFn } from '@/platform/telemetry/reportError'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import type { DocNodeDelta, FrameOutcome } from './agentCrdtProjection'
import type { DocFrameTransport } from './docFrameClient'
import type { GraphOperation } from './graphOperations'
import { LayoutFollowerBridge } from './layoutFollowerBridge'
import type { BatchOutcome, OpSenderDeps } from './opSender'
import { createFakeAgentSocket } from './__fixtures__/agentSocket'

const bridgeState = (() => {
  const liveSubscriptions = new Map<object, Set<string>>()
  let maxLiveSubscriptions = 0
  const countLiveSubscriptions = () =>
    [...liveSubscriptions.values()].reduce(
      (count, workflows) => count + workflows.size,
      0
    )

  class FakeBridge extends EventTarget {
    subscribe = vi.fn((workflowId: string) => {
      // A bridge retargets its single subscription; concurrency is measured
      // across bridge instances, not across its historical workflow ids.
      liveSubscriptions.set(this, new Set([workflowId]))
      maxLiveSubscriptions = Math.max(
        maxLiveSubscriptions,
        countLiveSubscriptions()
      )
    })
    unsubscribe = vi.fn(() => {
      liveSubscriptions.delete(this)
    })
    resubscribe = vi.fn(() => true)
    reconnect = vi.fn()
    reconcile = vi.fn()
    destroy = vi.fn(() => {
      liveSubscriptions.delete(this)
    })
    sendHumanOps = vi.fn()
    reseed = vi.fn(() => true)
    canReseed = vi.fn(() => false)
    subscribedWorkflowId: string | null = 'wf-1'
    lastSequence = 41
    isSubscribeBaselineIntegrated = false
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
    get maxLiveSubscriptions() {
      return maxLiveSubscriptions
    },
    resetLiveSubscriptions() {
      liveSubscriptions.clear()
      maxLiveSubscriptions = 0
    }
  }
})()

const clientState = vi.hoisted(() => ({
  destroy: vi.fn(),
  sendOps: vi.fn<OpSenderDeps['sendOps']>(() => true),
  transport: null as DocFrameTransport | null
}))

const projectionState = vi.hoisted(() => {
  const NO_NODES: DocNodeDelta = { added: [], removed: [] }
  const notApplied = (nodes: DocNodeDelta = NO_NODES): FrameOutcome => ({
    applied: false,
    nodes
  })
  const applied = (
    createdNodeIds: NodeId[] = [],
    nodes: DocNodeDelta = NO_NODES,
    failureCount = 0
  ): Extract<FrameOutcome, { applied: true }> => ({
    applied: true,
    nodes,
    createdNodeIds,
    failureCount
  })
  return {
    NO_NODES,
    notApplied,
    applied,
    bind: vi.fn(),
    unbind: vi.fn(),
    applyFrame: vi.fn((_update: unknown): FrameOutcome => applied()),
    applyCollected: vi.fn((_workflowId: string): FrameOutcome => applied()),
    retryFailed: vi.fn(
      (_workflowId: string): Extract<FrameOutcome, { applied: true }> | null =>
        null
    ),
    hasPendingFailure: vi.fn((_workflowId: string) => false),
    revertRejected: vi.fn(
      (_workflowId: string, _ops: readonly Op[]): FrameOutcome => applied()
    ),
    replaceOnNextFrame: vi.fn(),
    discardPending: vi.fn((_workflowId: string): DocNodeDelta => NO_NODES),
    noteLocalWrites: vi.fn(),
    settleLocalWrites: vi.fn(),
    destroy: vi.fn()
  }
})

const telemetryState = vi.hoisted(() => ({
  reportError: vi.fn<typeof reportErrorFn>()
}))

vi.mock(import('./layoutFollowerBridge'), { spy: true })

vi.mock<unknown>(import('./docFrameClient'), () => ({
  DocFrameClient: class {
    destroy = clientState.destroy
    sendOps = clientState.sendOps
    constructor(transport: DocFrameTransport) {
      clientState.transport = transport
    }
  }
}))

vi.mock<unknown>(import('./agentCrdtProjection'), () => ({
  AgentCrdtProjection: class {
    bind = projectionState.bind
    unbind = projectionState.unbind
    applyFrame = projectionState.applyFrame
    applyCollected = projectionState.applyCollected
    retryFailed = projectionState.retryFailed
    hasPendingFailure = projectionState.hasPendingFailure
    revertRejected = projectionState.revertRejected
    replaceOnNextFrame = projectionState.replaceOnNextFrame
    discardPending = projectionState.discardPending
    noteLocalWrites = projectionState.noteLocalWrites
    settleLocalWrites = projectionState.settleLocalWrites
    destroy = projectionState.destroy
  }
}))

vi.mock(import('./devPanelLog'), { spy: true })

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: telemetryState.reportError
}))
vi.mock(import('@/platform/telemetry'))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { graph: null, canvas: null }
}))

import { SUBSCRIBE_ACK_TIMEOUT_MS } from './agentCrdtDocLifecycle'
import { clearDevEvents, devEvents } from './devPanelLog'
import {
  STALE_AFTER_MS,
  SUBSCRIBE_CATCHUP_GRACE_MS,
  useAgentCrdtFollower
} from './useAgentCrdtFollower'
import type { AgentCrdtFollowerOptions } from './useAgentCrdtFollower'
import type { AgentCrdtStatus } from './agentCrdtStatus'

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
  getGraph: () => LGraph | null = () => null,
  events: AgentCrdtFollowerOptions['events'] = {},
  {
    transport = agentSocket.transport,
    canvasFor
  }: Pick<AgentCrdtFollowerOptions, 'canvasFor'> & {
    transport?: AgentCrdtFollowerOptions['transport']
  } = {}
): {
  unmount: () => void
  workflowId: Ref<string | null>
  isTargetActive: Ref<boolean>
  status: () => AgentCrdtStatus
  enqueue: (operations: GraphOperation[]) => void
  retry: () => void
} {
  const workflowId = ref<string | null>(initial)
  const isTargetActive = ref(initiallyActive)
  let exposedStatus!: () => AgentCrdtStatus
  let enqueue!: (operations: GraphOperation[]) => void
  let retry!: () => void
  const host = defineComponent({
    setup() {
      const { status, enqueueHumanOperations, retrySubscription } =
        useAgentCrdtFollower(workflowId, {
          transport,
          isTargetActive,
          getGraph,
          events,
          canvasFor
        })
      exposedStatus = () => status.value as AgentCrdtStatus
      enqueue = enqueueHumanOperations
      retry = retrySubscription
      return () => null
    }
  })
  const { unmount } = render(host)
  return {
    unmount,
    workflowId,
    isTargetActive,
    status: exposedStatus,
    enqueue,
    retry
  }
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

let agentSocket = createFakeAgentSocket()

function dispatchFrame(type: string, detail: unknown): void {
  bridge().dispatchEvent(new CustomEvent(type, { detail }))
}

describe('useAgentCrdtFollower', () => {
  beforeEach(() => {
    agentSocket = createFakeAgentSocket()
    useAgentPanelStore().enabled = true
    sessionStorage.clear()
    bridgeState.current = null
    bridgeState.resetLiveSubscriptions()
    vi.mocked(LayoutFollowerBridge).mockImplementation(function () {
      const bridge = new bridgeState.FakeBridge()
      bridgeState.current = bridge
      return fromPartial<LayoutFollowerBridge>(bridge)
    })
    clientState.transport = null
    projectionState.applyFrame
      .mockReset()
      .mockReturnValue(projectionState.applied())
    projectionState.applyCollected
      .mockReset()
      .mockReturnValue(projectionState.applied())
    projectionState.revertRejected
      .mockReset()
      .mockReturnValue(projectionState.applied())
    projectionState.noteLocalWrites.mockReset()
    projectionState.settleLocalWrites.mockReset()
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
      canvasMayBeStale: false,
      workflowId: null,
      updatesApplied: 0
    })
    expect(bridgeState.current).toBeNull()
    expect(projectionState.bind).not.toHaveBeenCalled()
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
    expect(projectionState.destroy).toHaveBeenCalledOnce()
    expect(status()).toMatchObject({
      enabled: false,
      connected: false,
      canvasMayBeStale: false,
      workflowId: null
    })

    const applies = projectionState.applyFrame.mock.calls.length
    first.dispatchEvent(
      new CustomEvent('doc_update', { detail: { workflowId: 'wf-1', seq: 42 } })
    )
    agentSocket.open()
    vi.advanceTimersByTime(STALE_AFTER_MS * 2)
    workflowId.value = 'wf-2'
    await nextTick()
    expect(first.subscribe).toHaveBeenCalledTimes(1)
    expect(first.resubscribe).not.toHaveBeenCalled()
    expect(projectionState.applyFrame).toHaveBeenCalledTimes(applies)

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
    onTestFinished(diagnostics.startCrdtDebugGate())
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
    onTestFinished(diagnostics.startCrdtDebugGate())
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

  describe('terminal follower state', () => {
    function refuse(): void {
      dispatchFrame('doc_subscribed', { ok: false, workflow_id: 'wf-1' })
    }

    function refuseForGood(): void {
      dispatchFrame('doc_subscribed', {
        ok: false,
        workflow_id: 'wf-1',
        code: 'schema_version_mismatch'
      })
    }

    function spendRetryBudget(): void {
      for (const delay of [500, 1_000, 2_000, 4_000, 8_000, 16_000]) {
        refuse()
        vi.advanceTimersByTime(delay)
      }
    }

    function exhaustRetryBudget(): void {
      spendRetryBudget()
      refuse()
    }

    it('stays non-terminal while a refused subscribe still has a retry behind it', () => {
      const { unmount, status } = mountFollower('wf-1')

      refuse()

      expect(status().connected).toBe(false)
      expect(status().terminal).toBeNull()
      unmount()
    })

    it('reports a permanent refusal as terminal, and clears it on the next confirmed subscribe', () => {
      const { unmount, status } = mountFollower('wf-1')

      refuseForGood()

      expect(status().terminal).toBe('refused')
      expect(status().connected).toBe(false)
      expect(status().workflowId).toBe('wf-1')

      dispatchFrame('doc_subscribed', { ok: true, workflow_id: 'wf-1', seq: 1 })

      expect(status().terminal).toBeNull()
      expect(status().connected).toBe(true)
      unmount()
    })

    it('reports a schema error as terminal, cleared by the next confirmed subscribe', () => {
      const { unmount, status } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', { ok: true, workflow_id: 'wf-1', seq: 1 })

      dispatchFrame('schema_error', { workflowId: 'wf-1', code: 'unreadable' })
      expect(status().terminal).toBe('schema_error')
      expect(status().workflowId).toBe('wf-1')

      dispatchFrame('doc_subscribed', { ok: true, workflow_id: 'wf-1', seq: 2 })
      expect(status().terminal).toBeNull()
      unmount()
    })

    it('a retarget clears the terminal state', async () => {
      const { unmount, status, workflowId } = mountFollower('wf-1')
      refuseForGood()
      expect(status().terminal).toBe('refused')

      workflowId.value = 'wf-2'
      await nextTick()

      expect(status().terminal).toBeNull()
      expect(status().workflowId).toBe('wf-2')
      unmount()
    })

    it('an ordinary reconnect drops connected without becoming terminal', () => {
      const { unmount, status } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', { ok: true, workflow_id: 'wf-1', seq: 1 })
      expect(status().connected).toBe(true)

      agentSocket.drop()

      expect(status().connected).toBe(false)
      expect(status().canvasMayBeStale).toBe(true)
      expect(status().terminal).toBeNull()
      unmount()
    })

    it('keeps a stale canvas when a reconnect is permanently refused', () => {
      const { unmount, status } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })
      agentSocket.drop()
      agentSocket.open()
      dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })

      refuseForGood()

      expect(status().terminal).toBe('refused')
      expect(status().canvasMayBeStale).toBe(true)
      unmount()
    })

    it('clears a stale canvas only after reconnect catch-up projects without failures', () => {
      const { unmount, status } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })

      agentSocket.drop()
      agentSocket.open()
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 2
      })

      expect(status().connected).toBe(true)
      expect(status().canvasMayBeStale).toBe(true)

      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.applied([], projectionState.NO_NODES, 1)
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 2,
        catchUp: true
      })

      expect(status().canvasMayBeStale).toBe(true)

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 3,
        catchUp: true
      })

      expect(status().canvasMayBeStale).toBe(false)
      unmount()
    })

    it('releases a failed catch-up after a live frame retries its projection', () => {
      const { unmount, status } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })
      agentSocket.drop()
      agentSocket.open()
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 2
      })
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.applied([], projectionState.NO_NODES, 1)
      )

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 2,
        catchUp: true
      })

      expect(status().canvasMayBeStale).toBe(true)

      projectionState.retryFailed.mockReturnValueOnce(projectionState.applied())
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 3,
        catchUp: false
      })

      expect(status().canvasMayBeStale).toBe(false)
      unmount()
    })

    it('keeps a stale canvas through deferred catch-up until projection applies', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const { unmount, status } = mountFollower('wf-1', true, () => graph.value)
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })
      agentSocket.drop()
      agentSocket.open()
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 2
      })
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied()
      )

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 2,
        catchUp: true
      })

      expect(status().canvasMayBeStale).toBe(true)

      projectionState.applyCollected.mockReturnValueOnce(
        projectionState.applied([], projectionState.NO_NODES, 1)
      )
      graph.value = fromPartial<LGraph>({})
      await nextTick()

      expect(projectionState.applyCollected).toHaveBeenCalledWith('wf-1')
      expect(status().canvasMayBeStale).toBe(true)

      graph.value = null
      await nextTick()
      graph.value = fromPartial<LGraph>({})
      await nextTick()

      expect(status().canvasMayBeStale).toBe(false)
      unmount()
    })

    it('keeps a stale canvas through a deferred live frame until projection applies', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const { unmount, status } = mountFollower('wf-1', true, () => graph.value)
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 0
      })
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied()
      )

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 1,
        catchUp: false
      })

      expect(status().canvasMayBeStale).toBe(true)

      graph.value = fromPartial<LGraph>({})
      await nextTick()

      expect(status().canvasMayBeStale).toBe(false)
      unmount()
    })

    it('keeps a deferred live frame stale through a resubscribe while the graph is missing', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const { unmount, status } = mountFollower('wf-1', true, () => graph.value)
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 0
      })
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied()
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 1,
        catchUp: false
      })
      expect(status().canvasMayBeStale).toBe(true)

      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 0
      })

      expect(status().canvasMayBeStale).toBe(true)

      graph.value = fromPartial<LGraph>({})
      await nextTick()

      expect(status().canvasMayBeStale).toBe(false)
      unmount()
    })

    it('keeps a deferred catch-up frame stale through a drop and an integrated ack', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const { unmount, status } = mountFollower('wf-1', true, () => graph.value)
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 0
      })
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied()
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 1,
        catchUp: true
      })
      expect(status().canvasMayBeStale).toBe(true)

      agentSocket.drop()
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 0
      })

      expect(status().canvasMayBeStale).toBe(true)
      unmount()
    })

    it('keeps a subscribed canvas stale across a tab detour until catch-up applies', async () => {
      const { unmount, status, isTargetActive } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })

      isTargetActive.value = false
      await nextTick()
      expect(status().canvasMayBeStale).toBe(true)

      isTargetActive.value = true
      await nextTick()
      expect(status().canvasMayBeStale).toBe(true)

      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 2
      })
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 2,
        catchUp: true
      })

      expect(status().canvasMayBeStale).toBe(false)
      unmount()
    })

    it('clears a stale canvas when the workflow binding changes', async () => {
      const { unmount, status, workflowId } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })
      agentSocket.drop()
      expect(status().canvasMayBeStale).toBe(true)

      workflowId.value = 'wf-2'
      await nextTick()

      expect(status().canvasMayBeStale).toBe(false)
      unmount()
    })

    it.for([
      { name: 'confirms', baseline: { seq: 0 } },
      { name: 'omits', baseline: {} }
    ])(
      'clears a stale canvas when reconnect $name the empty document sequence',
      ({ baseline }) => {
        const { unmount, status } = mountFollower('wf-1')
        dispatchFrame('doc_subscribed', {
          ok: true,
          workflow_id: 'wf-1',
          seq: 1
        })

        agentSocket.drop()
        agentSocket.open()
        dispatchFrame('doc_subscribed', {
          ok: true,
          workflow_id: 'wf-1',
          ...baseline
        })

        expect(status().connected).toBe(true)
        expect(status().canvasMayBeStale).toBe(false)
        unmount()
      }
    )

    it('clears a stale canvas when reconnect confirms the integrated sequence', () => {
      const { unmount, status } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 1,
        catchUp: true
      })

      agentSocket.drop()
      agentSocket.open()
      bridge().isSubscribeBaselineIntegrated = true
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })

      expect(status().connected).toBe(true)
      expect(status().canvasMayBeStale).toBe(false)
      unmount()
    })

    it('retries a failed projection before an integrated reconnect clears staleness', () => {
      const { unmount, status } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })
      agentSocket.drop()
      agentSocket.open()
      bridge().isSubscribeBaselineIntegrated = true
      projectionState.retryFailed.mockReturnValueOnce(
        projectionState.applied([], projectionState.NO_NODES, 1)
      )

      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })

      expect(projectionState.retryFailed).toHaveBeenLastCalledWith('wf-1')
      expect(status().canvasMayBeStale).toBe(true)

      agentSocket.drop()
      agentSocket.open()
      projectionState.retryFailed.mockReturnValueOnce(projectionState.applied())
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })

      expect(status().canvasMayBeStale).toBe(false)
      unmount()
    })

    it('keeps an integrated reconnect stale while a failed projection cannot retry', () => {
      const { unmount, status } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })
      agentSocket.drop()
      agentSocket.open()
      bridge().isSubscribeBaselineIntegrated = true
      projectionState.hasPendingFailure.mockReturnValue(true)

      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })

      expect(projectionState.retryFailed).toHaveBeenLastCalledWith('wf-1')
      expect(status().canvasMayBeStale).toBe(true)
      unmount()
    })

    it('withholds the canvas after a live projection failure until a later frame retries it', () => {
      const { unmount, status } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 0
      })
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.applied([], projectionState.NO_NODES, 1)
      )

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 1,
        catchUp: false
      })

      expect(status().canvasMayBeStale).toBe(true)

      projectionState.retryFailed.mockReturnValueOnce(projectionState.applied())
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 2,
        catchUp: false
      })

      expect(status().canvasMayBeStale).toBe(false)
      unmount()
    })

    it('reports a terminal timeout once the silent-subscribe budget is spent', () => {
      const { unmount, status } = mountFollower('wf-1')
      dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
      vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)
      dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
      vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)
      dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
      expect(status().terminal).toBeNull()

      vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)

      expect(status().terminal).toBe('timeout')
      expect(status().workflowId).toBe('wf-1')
      unmount()
    })

    it('a reconnect clears a terminal refusal while the new subscribe is in flight', () => {
      const { unmount, status } = mountFollower('wf-1')
      dispatchFrame('doc_subscribed', {
        ok: false,
        workflow_id: 'wf-1',
        code: 'schema_version_mismatch'
      })
      expect(status().terminal).toBe('refused')

      agentSocket.open()

      expect(status().terminal).toBeNull()
      expect(status().connected).toBe(false)
      expect(status().workflowId).toBe('wf-1')
      unmount()
    })

    it('marks the same permanent refusal terminal again after a reconnect', () => {
      const { unmount, status } = mountFollower('wf-1')
      refuseForGood()
      agentSocket.open()

      refuseForGood()

      expect(status().terminal).toBe('refused')
      unmount()
    })

    it('reports exhausted retries as recoverable and retries on request', () => {
      const { unmount, status, retry } = mountFollower('wf-1')
      spendRetryBudget()
      expect(bridge().resubscribe).toHaveBeenCalledTimes(6)
      expect(status().terminal).toBeNull()

      refuse()

      expect(status().terminal).toBe('retry_exhausted')

      bridge().resubscribe.mockReturnValueOnce(false)
      retry()

      expect(status().terminal).toBe('retry_exhausted')

      retry()

      expect(status().terminal).toBeNull()
      expect(bridge().resubscribe).toHaveBeenCalledTimes(8)
      unmount()
    })

    it('does not retry a permanent refusal that supersedes exhaustion', () => {
      const { unmount, status, retry } = mountFollower('wf-1')
      exhaustRetryBudget()
      expect(status().terminal).toBe('retry_exhausted')

      refuseForGood()
      expect(status().terminal).toBe('refused')
      const attempts = bridge().resubscribe.mock.calls.length

      retry()

      expect(status().terminal).toBe('refused')
      expect(bridge().resubscribe).toHaveBeenCalledTimes(attempts)
      unmount()
    })
  })

  it('FE-2158: one follower retargets across a tab switch and releases across remount', async () => {
    // AgentPanelRoot.vue creates a SINGLE follower and drives it with the
    // reactive boundWorkflowId / isBoundWorkflowActive. Exercising the switch
    // as two mounted followers would leave a broken direct A-to-B retarget
    // green, because no one follower would ever change workflow.
    const { unmount, workflowId, isTargetActive, status } =
      mountFollower('wf-a')
    expect(bridge().subscribe).toHaveBeenLastCalledWith('wf-a')

    isTargetActive.value = false
    await nextTick()

    workflowId.value = 'wf-b'
    isTargetActive.value = true
    await nextTick()
    expect(bridge().subscribe).toHaveBeenLastCalledWith('wf-b')

    // A frame for the workflow this follower just left must be counted and
    // dropped, never applied to the newly bound graph.
    dispatchFrame('doc_update', { workflowId: 'wf-a', seq: 99 })
    expect(status().outcomes.applied).toBe(0)
    expect(status().outcomes.skipped).toBeGreaterThan(0)
    expect(projectionState.applyFrame).not.toHaveBeenCalled()

    // Control: the retarget really did bind B, so the filter above
    // discriminated on workflow id rather than having gone silent.
    dispatchFrame('doc_update', { workflowId: 'wf-b', seq: 1 })
    expect(status().outcomes.applied).toBe(1)
    expect(projectionState.applyFrame).toHaveBeenCalledTimes(1)

    const staleBridge = bridge()
    unmount()
    await nextTick()
    expect(staleBridge.unsubscribe).toHaveBeenCalled()

    staleBridge.dispatchEvent(
      new CustomEvent('doc_update', {
        detail: { workflowId: 'wf-b', seq: 2 }
      })
    )
    expect(projectionState.applyFrame).toHaveBeenCalledTimes(1)

    const remounted = mountFollower('wf-b')
    expect(bridge()).not.toBe(staleBridge)
    expect(bridge().subscribe).toHaveBeenCalledExactlyOnceWith('wf-b')

    dispatchFrame('doc_update', { workflowId: 'wf-b', seq: 2 })
    expect(projectionState.applyFrame).toHaveBeenCalledTimes(2)
    remounted.unmount()
    expect(bridgeState.maxLiveSubscriptions).toBeLessThanOrEqual(1)
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

  it('FE-1969: naming the rebound workflow keeps its confirmed subscription', async () => {
    const setup = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    setup.unmount()
    bridgeState.current = null
    const { unmount, workflowId, status } = mountFollower(null)
    dispatchFrame('doc_subscribed', { ok: true })

    workflowId.value = 'wf-1'
    await nextTick()

    expect(status().connected).toBe(true)
    expect(bridge().subscribe).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(SUBSCRIBE_CATCHUP_GRACE_MS)
    expect(bridge().resubscribe).toHaveBeenCalledOnce()
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

  it('logs each dropped op result with its reason, subscribed target, and frame', async () => {
    clearDevEvents()
    const { workflowId, isTargetActive, unmount } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    const staleFailure = {
      workflowId: 'wf-2',
      ok: false,
      skipped: ['op-2'],
      failed: { op_id: 'op-2', code: 'unknown_node' }
    }

    dispatchFrame('doc_ops_result', staleFailure)
    workflowId.value = 'wf-2'
    await nextTick()
    dispatchFrame('doc_ops_result', { workflowId: 'wf-1', ok: true })
    isTargetActive.value = false
    await nextTick()
    dispatchFrame('doc_ops_result', { workflowId: 'wf-2', ok: true })

    expect(
      devEvents.value
        .filter((event) => event.kind === 'doc_ops_result_dropped')
        .map((event) => event.detail)
    ).toEqual([
      {
        reason: 'workflow_mismatch',
        subscribedWorkflowId: 'wf-1',
        frame: staleFailure
      },
      {
        reason: 'workflow_mismatch',
        subscribedWorkflowId: 'wf-2',
        frame: { workflowId: 'wf-1', ok: true }
      },
      {
        reason: 'inactive_target',
        subscribedWorkflowId: 'wf-2',
        frame: { workflowId: 'wf-2', ok: true }
      }
    ])
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

  it('retains the follower and reconnects the bridge on a socket reconnect', () => {
    const { unmount, status } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })
    expect(status().connected).toBe(true)

    agentSocket.open()

    expect(status().connected).toBe(false)
    expect(bridge().reconnect).toHaveBeenCalledOnce()
    expect(projectionState.replaceOnNextFrame).not.toHaveBeenCalled()
    unmount()
  })

  it('arms a lineage replacement only for an explicit reset and rebinds after replacement', () => {
    const { unmount, status } = mountFollower('wf-1')
    expect(projectionState.bind).toHaveBeenCalledTimes(1)

    dispatchFrame('doc_reset', {
      workflowId: 'wf-1',
      actor: 'agent:turn',
      seq: 43
    })
    expect(projectionState.replaceOnNextFrame).toHaveBeenCalledWith('wf-1')

    bridge().follower.updatesApplied = 3
    dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 44 })
    expect(status().updatesApplied).toBe(3)

    dispatchFrame('follower_replaced', { workflowId: 'wf-2' })
    expect(status().updatesApplied).toBe(3)
    expect(projectionState.bind).toHaveBeenCalledTimes(1)

    dispatchFrame('follower_replaced', { workflowId: 'wf-1' })
    expect(status().updatesApplied).toBe(0)
    expect(projectionState.replaceOnNextFrame).toHaveBeenCalledTimes(1)
    expect(projectionState.discardPending).toHaveBeenLastCalledWith('wf-1')
    expect(projectionState.bind).toHaveBeenCalledTimes(2)
    expect(projectionState.bind).toHaveBeenLastCalledWith(
      'wf-1',
      bridge().follower
    )
    unmount()
  })

  it('a workflow switch follower_replaced rebinds the replacement follower and clears applied state', async () => {
    const { unmount, status, workflowId } = mountFollower('wf-1')
    expect(projectionState.bind).toHaveBeenCalledTimes(1)

    bridge().follower.updatesApplied = 3
    dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 44 })
    expect(status().updatesApplied).toBe(3)

    // A workflow switch binds the new workflow before subscribe replaces the
    // follower. The ensuing follower_replaced must rebind to that replacement
    // and clear applied state without arming a lineage replacement.
    const replacementFollower = {
      updatesApplied: 7,
      doc: { getMap: () => ({ toJSON: () => ({}) }) }
    }
    const initialFollower = bridge().follower
    bridge().subscribe.mockImplementationOnce((nextWorkflowId: string) => {
      bridge().follower = replacementFollower
      dispatchFrame('follower_replaced', { workflowId: nextWorkflowId })
      bridge().subscribedWorkflowId = nextWorkflowId
    })
    workflowId.value = 'wf-2'
    await nextTick()
    expect(projectionState.unbind).toHaveBeenCalledExactlyOnceWith('wf-1')
    expect(projectionState.bind.mock.calls[1]?.[0]).toBe('wf-2')
    expect(projectionState.bind.mock.calls[1]?.[1]).toBe(initialFollower)
    expect(
      projectionState.unbind.mock.invocationCallOrder.at(-1)!
    ).toBeLessThan(projectionState.bind.mock.invocationCallOrder[1])
    expect(projectionState.bind.mock.invocationCallOrder[1]).toBeLessThan(
      bridge().subscribe.mock.invocationCallOrder.at(-1)!
    )

    expect(status().updatesApplied).toBe(0)
    expect(projectionState.discardPending).toHaveBeenCalledExactlyOnceWith(
      'wf-2'
    )
    expect(projectionState.bind).toHaveBeenCalledTimes(3)
    expect(projectionState.bind.mock.lastCall?.[0]).toBe('wf-2')
    expect(projectionState.bind.mock.lastCall?.[1]).toBe(replacementFollower)
    expect(
      projectionState.discardPending.mock.invocationCallOrder.at(-1)!
    ).toBeLessThan(projectionState.bind.mock.invocationCallOrder.at(-1)!)
    expect(projectionState.replaceOnNextFrame).not.toHaveBeenCalled()
    unmount()
  })

  it('PM-1604 / BE-11437: retries a retryable refusal code with backoff', () => {
    vi.useFakeTimers()
    const { unmount } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: false, code: 'not_found' })

    vi.advanceTimersByTime(500)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('PM-1604 / BE-11437: does not retry schema_version_mismatch and surfaces it', () => {
    vi.useFakeTimers()
    const onSyncError = vi.fn()
    const { unmount } = mountFollower('wf-1', true, () => null, {
      onSyncError
    })

    dispatchFrame('doc_subscribed', {
      ok: false,
      code: 'schema_version_mismatch',
      message: 'Expected schema 2, found 1'
    })

    vi.advanceTimersByTime(60_000)

    expect(bridge().resubscribe).not.toHaveBeenCalled()
    expect(bridge().reconcile).not.toHaveBeenCalled()
    expect(onSyncError).toHaveBeenCalledExactlyOnceWith(
      'Expected schema 2, found 1',
      'schema_version_mismatch'
    )
    unmount()
  })

  it('PM-1604 / BE-11437: does not retry catalog_mismatch and surfaces it', () => {
    vi.useFakeTimers()
    const onSyncError = vi.fn()
    const { unmount } = mountFollower('wf-1', true, () => null, {
      onSyncError
    })

    dispatchFrame('doc_subscribed', {
      ok: false,
      code: 'catalog_mismatch',
      message: 'catalog v3 required'
    })

    vi.advanceTimersByTime(60_000)

    expect(bridge().resubscribe).not.toHaveBeenCalled()
    expect(bridge().reconcile).not.toHaveBeenCalled()
    expect(onSyncError).toHaveBeenCalledExactlyOnceWith(
      'catalog v3 required',
      'catalog_mismatch'
    )
    unmount()
  })

  it('PM-1604 / BE-11437: does not retry unsupported and never surfaces it', () => {
    vi.useFakeTimers()
    const onSyncError = vi.fn()
    const { unmount } = mountFollower('wf-1', true, () => null, {
      onSyncError
    })

    dispatchFrame('doc_subscribed', {
      ok: false,
      code: 'unsupported',
      message: 'doc surface disabled'
    })

    vi.advanceTimersByTime(60_000)

    expect(bridge().resubscribe).not.toHaveBeenCalled()
    expect(bridge().reconcile).not.toHaveBeenCalled()
    expect(onSyncError).not.toHaveBeenCalled()
    unmount()
  })

  it('asks for a reload once when the document is newer than this build reads', () => {
    const onSyncError = vi.fn()
    const { unmount } = mountFollower('wf-1', true, () => null, {
      onSyncError
    })
    dispatchFrame('doc_subscribed', { ok: true })

    const found = SCHEMA_VERSION + 1
    dispatchFrame('schema_error', { workflowId: 'wf-1', found })
    dispatchFrame('schema_error', { workflowId: 'wf-1', found })

    expect(onSyncError).toHaveBeenCalledExactlyOnceWith(
      `document schema v${found} is newer than this page reads (v${SCHEMA_VERSION})`,
      'stale_client_schema'
    )
    unmount()
  })

  it('tells the person once that this page is ahead of the service when the document is older', () => {
    const onSyncError = vi.fn()
    const { unmount } = mountFollower('wf-1', true, () => null, {
      onSyncError
    })
    dispatchFrame('doc_subscribed', { ok: true })

    const found = SCHEMA_VERSION - 1
    dispatchFrame('schema_error', { workflowId: 'wf-1', found })
    dispatchFrame('schema_error', { workflowId: 'wf-1', found })

    expect(onSyncError).toHaveBeenCalledExactlyOnceWith(
      `document schema v${found} is older than this page reads (v${SCHEMA_VERSION})`,
      'stale_host_schema'
    )
    unmount()
  })

  it('still asks for a reload when an older document is later replaced by a newer one', () => {
    const onSyncError = vi.fn()
    const { unmount } = mountFollower('wf-1', true, () => null, {
      onSyncError
    })
    dispatchFrame('doc_subscribed', { ok: true })

    dispatchFrame('schema_error', {
      workflowId: 'wf-1',
      found: SCHEMA_VERSION - 1
    })
    dispatchFrame('schema_error', {
      workflowId: 'wf-1',
      found: SCHEMA_VERSION + 1
    })

    expect(onSyncError).toHaveBeenNthCalledWith(
      2,
      `document schema v${SCHEMA_VERSION + 1} is newer than this page reads (v${SCHEMA_VERSION})`,
      'stale_client_schema'
    )
    unmount()
  })

  it.for([
    { label: 'the current version', found: SCHEMA_VERSION },
    { label: 'zero', found: 0 },
    { label: 'a non-number', found: '1' },
    { label: 'negative', found: -1 },
    { label: 'fractional', found: SCHEMA_VERSION + 0.5 },
    { label: 'infinite', found: Number.POSITIVE_INFINITY },
    { label: 'NaN', found: Number.NaN }
  ])('stays silent when the document schema is $label', ({ found }) => {
    const onSyncError = vi.fn()
    const { unmount } = mountFollower('wf-1', true, () => null, {
      onSyncError
    })
    dispatchFrame('doc_subscribed', { ok: true })

    dispatchFrame('schema_error', { workflowId: 'wf-1', found })

    expect(onSyncError).not.toHaveBeenCalled()
    unmount()
  })

  it('drops to disconnected on a schema error without touching the binding', () => {
    const { unmount, status } = mountFollower('wf-1')
    dispatchFrame('doc_subscribed', { ok: true })

    dispatchFrame('schema_error', { workflowId: 'wf-1', code: 'unreadable' })

    expect(status().connected).toBe(false)
    expect(status().canvasMayBeStale).toBe(true)
    expect(status().workflowId).toBe('wf-1')
    expect(projectionState.discardPending).toHaveBeenCalledWith('wf-1')
    unmount()
  })

  it('surfaces applied updates and the last frame type in status', () => {
    const { unmount, status } = mountFollower('wf-1')
    bridge().follower.updatesApplied = 3

    const update = { workflowId: 'wf-1', seq: 7 }
    dispatchFrame('doc_update', update)

    expect(status().updatesApplied).toBe(3)
    expect(status().lastFrameType).toBe('doc_update')
    expect(projectionState.applyFrame).toHaveBeenCalledWith(update)
    unmount()
  })

  it('reports exact workflow/op evidence after live and catch-up frames apply', () => {
    const onAppliedUpdate = vi.fn()
    const { unmount } = mountFollower('wf-1', true, () => null, {
      onAppliedUpdate
    })

    dispatchFrame('doc_update', {
      workflowId: 'wf-1',
      seq: 7,
      opIds: ['op-1', 'op-2']
    })
    dispatchFrame('doc_update', {
      workflowId: 'wf-1',
      seq: 8,
      opIds: ['op-catch-up'],
      catchUp: true
    })

    expect(onAppliedUpdate).toHaveBeenNthCalledWith(1, {
      workflowId: 'wf-1',
      opIds: ['op-1', 'op-2'],
      isLive: true
    })
    expect(onAppliedUpdate).toHaveBeenNthCalledWith(2, {
      workflowId: 'wf-1',
      opIds: ['op-catch-up'],
      isLive: false
    })
    unmount()
  })

  describe('s5-metrics-1: per-outcome counters', () => {
    it('counts received and applied for a frame that passes the filter', () => {
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 7 })

      expect(status().outcomes).toEqual({
        received: 1,
        applied: 1,
        appliedLive: 1,
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
      expect(projectionState.applyFrame).not.toHaveBeenCalled()
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
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied()
      )
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 7 })

      expect(projectionState.applyFrame).toHaveBeenCalledTimes(1)
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

      dispatchFrame('doc_subscribed', { ok: true })

      dispatchFrame('doc_gap', { workflowId: 'wf-1', expected: 3, received: 5 })

      expect(status().connected).toBe(false)
      expect(status().canvasMayBeStale).toBe(true)
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

      expect(status()).toMatchObject({
        canvasMayBeStale: true,
        outcomes: { reset: 1 }
      })
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
      expect(projectionState.replaceOnNextFrame).not.toHaveBeenCalled()
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

    it('counts appliedLive for a live update but not for a subscribe catch-up frame', () => {
      const { unmount, status } = mountFollower('wf-1')

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 4, catchUp: true })
      expect(status().outcomes.applied).toBe(1)
      expect(status().outcomes.appliedLive).toBe(0)

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 5,
        catchUp: false
      })
      expect(status().outcomes.applied).toBe(2)
      expect(status().outcomes.appliedLive).toBe(1)
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
        appliedLive: 2,
        skipped: 1,
        errored: 1,
        gap: 1,
        reset: 0,
        dropped: 1
      })
      unmount()
    })
  })

  describe('live-graph sync', () => {
    // The projection is module-mocked, so the graph only needs to be a
    // distinct reference the composable hands through.
    const fakeGraph = fromPartial<LGraph>({ getNodeById: () => null })

    it('applies every frame for the followed workflow through the projection', () => {
      const { unmount, status } = mountFollower('wf-1', true, () => fakeGraph)

      const update = { workflowId: 'wf-1', seq: 9 }
      dispatchFrame('doc_update', update)

      expect(projectionState.applyFrame).toHaveBeenCalledExactlyOnceWith(update)
      expect(projectionState.applyCollected).not.toHaveBeenCalled()
      expect(status().outcomes.applied).toBe(1)
      unmount()
    })

    it('reports bounded projection stages for an agent frame', () => {
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.applied([], { added: [], removed: ['node-private'] })
      )
      const { unmount } = mountFollower('wf-1', true, () => fakeGraph)

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:private-thread:private-turn',
        opIds: ['op-join', 'op-other']
      })

      expect(
        useTelemetry()?.trackAgentGraphProjection
      ).toHaveBeenCalledExactlyOnceWith({
        op_id: 'op-join',
        op_count: 2,
        sequence: 9,
        stage: 'applied',
        added_count: 0,
        removed_count: 1,
        apply_failure_count: 0
      })
      unmount()
    })

    it('reports an actorless remote frame without exposing actor identity', () => {
      const { unmount } = mountFollower('wf-1', true, () => fakeGraph)

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        opIds: ['op-join']
      })

      expect(
        useTelemetry()?.trackAgentGraphProjection
      ).toHaveBeenCalledExactlyOnceWith({
        op_id: 'op-join',
        op_count: 1,
        sequence: 9,
        stage: 'applied',
        added_count: 0,
        removed_count: 0,
        apply_failure_count: 0
      })
      unmount()
    })

    it('counts a frame the projection had no binding for as skipped', () => {
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied()
      )
      const { unmount, status } = mountFollower('wf-1', true, () => fakeGraph)

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 9 })

      expect(status().outcomes.skipped).toBe(1)
      expect(status().outcomes.applied).toBe(0)
      unmount()
    })

    it('applies the collected changes once the graph appears, without waiting for another frame', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const { unmount } = mountFollower('wf-1', true, () => graph.value)

      dispatchFrame('doc_update', { workflowId: 'wf-1', seq: 9 })
      expect(projectionState.applyCollected).not.toHaveBeenCalled()

      graph.value = fakeGraph
      await nextTick()

      expect(projectionState.applyCollected).toHaveBeenCalledExactlyOnceWith(
        'wf-1'
      )
      unmount()
    })

    it('reports a pending live arrival when graph readiness materializes it', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const onMaterialized = vi.fn()
      const { unmount } = mountFollower('wf-1', true, () => graph.value, {
        onMaterialized
      })
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied({ added: ['3'], removed: [] })
      )

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn',
        catchUp: false
      })
      expect(onMaterialized).not.toHaveBeenCalled()
      expect(
        useTelemetry()?.trackAgentGraphProjection
      ).toHaveBeenCalledExactlyOnceWith({
        op_id: null,
        op_count: 0,
        sequence: 9,
        stage: 'received_no_graph',
        added_count: 1,
        removed_count: 0,
        apply_failure_count: 0
      })

      projectionState.applyCollected.mockReturnValue(
        projectionState.applied(
          [toNodeId(3)],
          {
            added: ['3'],
            removed: []
          },
          1
        )
      )
      graph.value = fakeGraph
      await nextTick()

      expect(onMaterialized).toHaveBeenCalledExactlyOnceWith({
        workflowId: 'wf-1',
        actor: undefined,
        nodeIds: [toNodeId(3)]
      })
      expect(
        useTelemetry()?.trackAgentGraphProjection
      ).toHaveBeenLastCalledWith({
        op_id: null,
        op_count: 0,
        sequence: 9,
        stage: 'applied_deferred',
        added_count: 1,
        removed_count: 0,
        apply_failure_count: 1
      })
      unmount()
    })

    it('keeps every deferred agent frame joinable when the collected batch flushes', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const { unmount } = mountFollower('wf-1', true, () => graph.value)
      projectionState.applyFrame
        .mockReturnValueOnce(
          projectionState.notApplied({ added: ['3'], removed: [] })
        )
        .mockReturnValueOnce(
          projectionState.notApplied({ added: ['4'], removed: [] })
        )

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn-a',
        opIds: ['op-a']
      })
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 10,
        actor: 'agent:thread:turn-b',
        opIds: ['op-b']
      })
      projectionState.applyCollected.mockReturnValue(
        projectionState.applied([], { added: ['3', '4'], removed: ['9'] })
      )
      vi.mocked(useTelemetry()!.trackAgentGraphProjection).mockClear()

      graph.value = fakeGraph
      await nextTick()

      expect(
        vi.mocked(useTelemetry()!.trackAgentGraphProjection).mock.calls.flat()
      ).toEqual([
        {
          op_id: 'op-a',
          op_count: 1,
          sequence: 9,
          stage: 'applied_deferred',
          added_count: 2,
          removed_count: 1,
          apply_failure_count: 0
        },
        {
          op_id: 'op-b',
          op_count: 1,
          sequence: 10,
          stage: 'applied_deferred',
          added_count: 2,
          removed_count: 1,
          apply_failure_count: 0
        }
      ])
      unmount()
    })

    it('keeps deferred frames joinable when a later live frame flushes the batch', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const { unmount } = mountFollower('wf-1', true, () => graph.value)
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied({ added: ['3'], removed: [] })
      )

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn-a',
        opIds: ['op-a']
      })
      vi.mocked(useTelemetry()!.trackAgentGraphProjection).mockClear()

      // The graph arrives and the next frame lands in the same tick, so the
      // frame flushes the collector before the readiness watcher can.
      graph.value = fakeGraph
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.applied([], { added: ['3'], removed: [] }, 2)
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 10,
        actor: 'agent:thread:turn-b',
        opIds: ['op-b']
      })

      expect(
        vi.mocked(useTelemetry()!.trackAgentGraphProjection).mock.calls.flat()
      ).toEqual([
        {
          op_id: 'op-b',
          op_count: 1,
          sequence: 10,
          stage: 'applied',
          added_count: 1,
          removed_count: 0,
          apply_failure_count: 2
        },
        {
          op_id: 'op-a',
          op_count: 1,
          sequence: 9,
          stage: 'applied_deferred',
          added_count: 1,
          removed_count: 0,
          apply_failure_count: 2
        }
      ])
      unmount()
    })

    it.for([
      {
        name: 'reports deferred op evidence once a later live frame applies it cleanly',
        failureCount: 0,
        expected: [
          { workflowId: 'wf-1', opIds: ['op-b'], isLive: true },
          { workflowId: 'wf-1', opIds: ['op-a'], isLive: true }
        ]
      },
      {
        name: 'withholds deferred op evidence when the later live frame fails to apply',
        failureCount: 1,
        expected: []
      }
    ])('$name', ({ failureCount, expected }) => {
      const graph = shallowRef<LGraph | null>(null)
      const onAppliedUpdate = vi.fn()
      const { unmount } = mountFollower('wf-1', true, () => graph.value, {
        onAppliedUpdate
      })
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied({ added: ['3'], removed: [] })
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn-a',
        opIds: ['op-a']
      })

      graph.value = fakeGraph
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.applied([], { added: ['3'], removed: [] }, failureCount)
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 10,
        actor: 'agent:thread:turn-b',
        opIds: ['op-b']
      })

      expect(onAppliedUpdate.mock.calls.flat()).toEqual(expected)
      unmount()
    })

    it('does not let a trailing non-agent frame erase the deferred agent outcome', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const { unmount } = mountFollower('wf-1', true, () => graph.value)
      projectionState.applyFrame
        .mockReturnValueOnce(
          projectionState.notApplied({ added: ['3'], removed: [] })
        )
        .mockReturnValueOnce(
          projectionState.notApplied({ added: ['4'], removed: [] })
        )

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn-a',
        opIds: ['op-a']
      })
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 10,
        actor: 'human:someone:tab-7',
        opIds: ['op-human']
      })
      projectionState.applyCollected.mockReturnValue(
        projectionState.applied([], { added: ['3', '4'], removed: [] })
      )
      vi.mocked(useTelemetry()!.trackAgentGraphProjection).mockClear()

      graph.value = fakeGraph
      await nextTick()

      expect(
        vi.mocked(useTelemetry()!.trackAgentGraphProjection).mock.calls.flat()
      ).toEqual([
        {
          op_id: 'op-a',
          op_count: 1,
          sequence: 9,
          stage: 'applied_deferred',
          added_count: 2,
          removed_count: 0,
          apply_failure_count: 0
        }
      ])
      unmount()
    })

    it.for(['doc_reset', 'follower_replaced'])(
      'terminates a pending frame as discarded, not applied, after %s drops it',
      async (discardEvent) => {
        const graph = shallowRef<LGraph | null>(null)
        const { unmount } = mountFollower('wf-1', true, () => graph.value)
        projectionState.applyFrame.mockReturnValueOnce(
          projectionState.notApplied({ added: ['3'], removed: [] })
        )

        dispatchFrame('doc_update', {
          workflowId: 'wf-1',
          seq: 9,
          actor: 'agent:thread:turn',
          opIds: ['op-a']
        })
        vi.mocked(useTelemetry()!.trackAgentGraphProjection).mockClear()

        dispatchFrame(discardEvent, { workflowId: 'wf-1' })
        projectionState.applyCollected.mockReturnValue(
          projectionState.applied([], { added: ['3'], removed: [] })
        )
        graph.value = fakeGraph
        await nextTick()

        expect(projectionState.applyCollected).toHaveBeenCalledWith('wf-1')
        expect(
          useTelemetry()?.trackAgentGraphProjection
        ).toHaveBeenCalledExactlyOnceWith({
          op_id: 'op-a',
          op_count: 1,
          sequence: 9,
          stage: 'discarded',
          added_count: 0,
          removed_count: 0,
          apply_failure_count: 0
        })
        unmount()
      }
    )

    it('terminates a pending frame as discarded when a schema error tears down its projection', () => {
      const { unmount } = mountFollower('wf-1')
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied({ added: ['3'], removed: [] })
      )

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn',
        opIds: ['op-a']
      })
      vi.mocked(useTelemetry()!.trackAgentGraphProjection).mockClear()

      dispatchFrame('schema_error', { workflowId: 'wf-1' })

      expect(
        useTelemetry()?.trackAgentGraphProjection
      ).toHaveBeenCalledExactlyOnceWith({
        op_id: 'op-a',
        op_count: 1,
        sequence: 9,
        stage: 'discarded',
        added_count: 0,
        removed_count: 0,
        apply_failure_count: 0
      })
      unmount()
    })

    it('terminates a pending frame as discarded when unmounting tears down its projection', () => {
      const { unmount } = mountFollower('wf-1')
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied({ added: ['3'], removed: [] })
      )

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn',
        opIds: ['op-a']
      })
      vi.mocked(useTelemetry()!.trackAgentGraphProjection).mockClear()

      unmount()

      expect(
        useTelemetry()?.trackAgentGraphProjection
      ).toHaveBeenCalledExactlyOnceWith({
        op_id: 'op-a',
        op_count: 1,
        sequence: 9,
        stage: 'discarded',
        added_count: 0,
        removed_count: 0,
        apply_failure_count: 0
      })
    })

    it('terminates a pending frame as discarded before rebinding', async () => {
      const { unmount, workflowId } = mountFollower('wf-1')
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied({ added: ['3'], removed: [] })
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn',
        opIds: ['op-a']
      })
      vi.mocked(useTelemetry()!.trackAgentGraphProjection).mockClear()

      workflowId.value = 'wf-2'
      await nextTick()

      expect(
        useTelemetry()?.trackAgentGraphProjection
      ).toHaveBeenCalledExactlyOnceWith({
        op_id: 'op-a',
        op_count: 1,
        sequence: 9,
        stage: 'discarded',
        added_count: 0,
        removed_count: 0,
        apply_failure_count: 0
      })
      unmount()
    })

    it('terminates a pending frame as discarded when an own echo drops the collected changes', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const { unmount, enqueue } = mountFollower(
        'wf-1',
        true,
        () => graph.value
      )
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied({ added: ['3'], removed: [] })
      )

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn',
        opIds: ['op-a']
      })
      enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
      await Promise.resolve()
      const [, , ops] = clientState.sendOps.mock.calls[0]
      vi.mocked(useTelemetry()!.trackAgentGraphProjection).mockClear()

      graph.value = fakeGraph
      projectionState.discardPending.mockReturnValueOnce({
        added: ['3'],
        removed: ['9']
      })
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 10,
        actor: ops[0].actor,
        catchUp: false
      })

      expect(projectionState.discardPending).toHaveBeenCalledWith('wf-1')
      expect(
        useTelemetry()?.trackAgentGraphProjection
      ).toHaveBeenCalledExactlyOnceWith({
        op_id: 'op-a',
        op_count: 1,
        sequence: 9,
        stage: 'discarded',
        added_count: 0,
        removed_count: 0,
        apply_failure_count: 0
      })
      unmount()
    })

    it('does not apply for a graph that appears while the target is inactive', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const { unmount } = mountFollower('wf-1', false, () => graph.value)

      graph.value = fakeGraph
      await nextTick()

      expect(projectionState.applyCollected).not.toHaveBeenCalled()
      unmount()
    })

    it('applies the collected changes when the target is activated after the graph became ready', async () => {
      // The other readiness ordering: the graph arrives while inactive, so the
      // `getGraph` watcher correctly skips it. Activation does not change the
      // graph identity, so nothing re-triggers that watcher -- the apply has to
      // happen where the active binding is established.
      const graph = shallowRef<LGraph | null>(null)
      const { unmount, isTargetActive } = mountFollower(
        'wf-1',
        false,
        () => graph.value
      )

      graph.value = fakeGraph
      await nextTick()
      expect(projectionState.applyCollected).not.toHaveBeenCalled()

      isTargetActive.value = true
      await nextTick()

      expect(projectionState.applyCollected).toHaveBeenCalledWith('wf-1')
      unmount()
    })

    it('arms a lineage replacement on a doc_reset and rebinds the replacement document', () => {
      const { unmount } = mountFollower('wf-1', true, () => fakeGraph)
      const replacementDoc = { getMap: () => ({ toJSON: () => ({}) }) }

      dispatchFrame('doc_reset', {
        workflowId: 'wf-1',
        actor: 'agent:turn',
        seq: 43
      })
      bridge().follower = { updatesApplied: 0, doc: replacementDoc }
      dispatchFrame('follower_replaced', { workflowId: 'wf-1' })

      expect(
        projectionState.replaceOnNextFrame
      ).toHaveBeenCalledExactlyOnceWith('wf-1')
      expect(projectionState.bind).toHaveBeenLastCalledWith(
        'wf-1',
        bridge().follower
      )
      unmount()
    })

    it('reports only live agent materializations, not reconnect catch-up', () => {
      const onMaterialized = vi.fn()
      projectionState.applyFrame.mockReturnValue(
        projectionState.applied([toNodeId(1)])
      )
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
      const liveNodeIds = new Set<NodeId>()
      const graph = fromPartial<LGraph>({
        getNodeById: (id: NodeId) => (liveNodeIds.has(id) ? {} : null)
      })
      const { unmount } = mountFollower('wf-1', true, () => graph, {
        onMaterialized
      })

      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.applied([], { added: ['3'], removed: [] })
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 5,
        actor: 'agent:thread:turn',
        catchUp: false
      })
      expect(onMaterialized).not.toHaveBeenCalled()

      liveNodeIds.add(toNodeId(3))
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.applied([toNodeId(3)])
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 4,
        actor: 'host:catch-up',
        catchUp: true
      })

      expect(onMaterialized).toHaveBeenCalledExactlyOnceWith({
        workflowId: 'wf-1',
        actor: undefined,
        nodeIds: [toNodeId(3)]
      })
      unmount()
    })

    it('PM-1874: does not attribute a prior turn’s late-materializing node to a later unrelated turn', () => {
      // Turn A adds node 99, which does not resolve via graph.getNodeById
      // while turn A is live, so it stays in the pending set. Turn B starts
      // and adds its own 3 nodes. Node 99 only becomes resolvable once turn
      // B's own frame lands (a plausible race: a deferred render, or node 99
      // sharing a tick with turn B's materialization). The toast for turn B
      // must report exactly its own 3 nodes, not node 99 plus 3 — node 99
      // belongs to turn A and should have been flushed when turn A ended.
      const onMaterialized = vi.fn()
      const liveNodeIds = new Set<NodeId>()
      const graph = fromPartial<LGraph>({
        getNodeById: (id: NodeId) => (liveNodeIds.has(id) ? {} : null)
      })
      const { unmount } = mountFollower('wf-1', true, () => graph, {
        onMaterialized
      })

      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.applied([], { added: ['99'], removed: [] })
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 1,
        actor: 'agent:thread:turnA',
        catchUp: false
      })
      expect(onMaterialized).not.toHaveBeenCalled()

      // Node 99 becomes resolvable late — at the same moment turn B's own
      // nodes do, which is exactly the race that lets a stale id ride along.
      liveNodeIds.add(toNodeId(99))
      liveNodeIds.add(toNodeId(1))
      liveNodeIds.add(toNodeId(2))
      liveNodeIds.add(toNodeId(3))
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.applied([], { added: ['1', '2', '3'], removed: [] })
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 2,
        actor: 'agent:thread:turnB',
        catchUp: false
      })

      expect(onMaterialized).toHaveBeenCalledExactlyOnceWith({
        workflowId: 'wf-1',
        actor: 'agent:thread:turnB',
        nodeIds: [toNodeId(1), toNodeId(2), toNodeId(3)]
      })
      unmount()
    })

    it('does not attribute a human recreation after a pending node was deleted', () => {
      const onMaterialized = vi.fn()
      const graph = shallowRef<LGraph | null>(null)
      const readyGraph = fromPartial<LGraph>({
        getNodeById: (id: NodeId) => (id === toNodeId(3) ? {} : null)
      })
      const { unmount } = mountFollower('wf-1', true, () => graph.value, {
        onMaterialized
      })

      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied({ added: ['3'], removed: [] })
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 9,
        actor: 'agent:thread:turn',
        catchUp: false
      })
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.notApplied({ added: [], removed: ['3'] })
      )
      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 10,
        actor: 'human:user:tab',
        catchUp: false
      })

      graph.value = readyGraph
      projectionState.applyFrame.mockReturnValueOnce(
        projectionState.applied([toNodeId(3)], { added: ['3'], removed: [] })
      )
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
    expect(projectionState.applyFrame).not.toHaveBeenCalled()

    isTargetActive.value = true
    await nextTick()
    expect(bridge().subscribe).toHaveBeenCalledWith('wf-a')

    const catchUp = { workflowId: 'wf-a', seq: 8 }
    dispatchFrame('doc_update', catchUp)
    expect(projectionState.applyFrame).toHaveBeenCalledWith(catchUp)
    unmount()
  })

  it('sends minted human operations through the doc client', async () => {
    const workflowId = ref<string | null>('wf-1')
    let enqueue!: ReturnType<
      typeof useAgentCrdtFollower
    >['enqueueHumanOperations']
    const host = defineComponent({
      setup() {
        const { enqueueHumanOperations } = useAgentCrdtFollower(workflowId, {
          transport: agentSocket.transport
        })
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

  it('reverts only the ops the host rejected from a human batch', async () => {
    const readyGraph = fromPartial<LGraph>({})
    const { unmount, enqueue } = mountFollower('wf-1', true, () => readyGraph)
    enqueue([
      { op: 'set_widget', node_id: '2', widget: 'steps', value: 3 },
      { op: 'delete_node', node_id: '1', removed_links: [] }
    ])
    await Promise.resolve()
    const [, , ops] = clientState.sendOps.mock.calls[0]

    dispatchFrame('doc_ops_result', {
      workflowId: 'wf-1',
      ok: false,
      seq: 10,
      applied: [ops[0].op_id],
      skipped: [],
      failed: { index: 1, op_id: ops[1].op_id, code: 'unknown_node' }
    })

    expect(projectionState.revertRejected).toHaveBeenCalledExactlyOnceWith(
      'wf-1',
      [ops[1]]
    )
    expect(projectionState.applyCollected).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackAgentGraphProjection).toHaveBeenLastCalledWith({
      op_id: ops[1].op_id,
      op_count: 1,
      sequence: 10,
      stage: 'reverted',
      added_count: 0,
      removed_count: 0,
      apply_failure_count: 0
    })
    expect(telemetryState.reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'error_applying_agent_graph_edit',
        fingerprint: ['error_applying_agent_graph_edit'],
        context: expect.objectContaining({
          opId: ops[1].op_id,
          code: 'unknown_node'
        })
      })
    )
    unmount()
  })

  it('defers rejected-op reverts until the bound workflow is active again', async () => {
    const readyGraph = fromPartial<LGraph>({})
    const { unmount, enqueue, isTargetActive } = mountFollower(
      'wf-1',
      true,
      () => readyGraph
    )
    enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
    await Promise.resolve()
    const [, , ops] = clientState.sendOps.mock.calls[0]

    isTargetActive.value = false
    await nextTick()
    dispatchFrame('doc_ops_result', {
      workflowId: 'wf-1',
      ok: false,
      applied: [],
      skipped: [],
      failed: { index: 0, op_id: ops[0].op_id, code: 'unknown_node' }
    })

    expect(projectionState.revertRejected).not.toHaveBeenCalled()

    isTargetActive.value = true
    await nextTick()

    expect(projectionState.revertRejected).toHaveBeenCalledExactlyOnceWith(
      'wf-1',
      [ops[0]]
    )
    unmount()
  })

  it('retains a rejected revert until the active graph becomes ready', async () => {
    const graph = shallowRef<LGraph | null>(null)
    const readyGraph = fromPartial<LGraph>({})
    const { unmount, enqueue, isTargetActive } = mountFollower(
      'wf-1',
      false,
      () => graph.value
    )
    enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
    await Promise.resolve()
    const [, , ops] = clientState.sendOps.mock.calls[0]

    dispatchFrame('doc_ops_result', {
      workflowId: 'wf-1',
      ok: false,
      applied: [],
      skipped: [],
      failed: { index: 0, op_id: ops[0].op_id, code: 'unknown_node' }
    })
    expect(projectionState.revertRejected).not.toHaveBeenCalled()

    isTargetActive.value = true
    await nextTick()
    expect(projectionState.revertRejected).not.toHaveBeenCalled()

    graph.value = readyGraph
    await nextTick()

    expect(projectionState.revertRejected).toHaveBeenCalledExactlyOnceWith(
      'wf-1',
      [ops[0]]
    )
    unmount()
  })

  describe('own-actor echo', () => {
    const liveGraph = fromPartial<LGraph>({ getNodeById: () => null })

    async function mountAndSendOneOp(): Promise<{
      unmount: () => void
      status: () => AgentCrdtStatus
      ownActor: string
    }> {
      const { unmount, status, enqueue } = mountFollower(
        'wf-1',
        true,
        () => liveGraph
      )
      enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
      await Promise.resolve()
      const [, , ops] = clientState.sendOps.mock.calls[0]
      return { unmount, status, ownActor: ops[0].actor }
    }

    it('merges the echo of this tab’s own ops without applying it to the graph', async () => {
      const { unmount, status, ownActor } = await mountAndSendOneOp()
      expect(ownActor).toMatch(/^human:anonymous:/)

      dispatchFrame('doc_update', {
        workflowId: 'wf-1',
        seq: 42,
        actor: ownActor,
        catchUp: false
      })

      expect(projectionState.applyFrame).not.toHaveBeenCalled()
      expect(projectionState.discardPending).toHaveBeenCalledExactlyOnceWith(
        'wf-1'
      )
      expect(status().outcomes).toMatchObject({
        received: 1,
        applied: 0,
        skipped: 1
      })
      unmount()
    })

    it('keeps collected remote changes when an own echo arrives before the graph', async () => {
      const graph = shallowRef<LGraph | null>(null)
      const { unmount, enqueue } = mountFollower(
        'wf-1',
        true,
        () => graph.value
      )
      enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
      await Promise.resolve()
      const [, , ops] = clientState.sendOps.mock.calls[0]
      const ownActor = ops[0].actor
      const remoteUpdate = {
        workflowId: 'wf-1',
        seq: 41,
        actor: 'agent:thread:turn',
        catchUp: false
      }
      const ownEcho = {
        workflowId: 'wf-1',
        seq: 42,
        actor: ownActor,
        catchUp: false
      }

      dispatchFrame('doc_update', remoteUpdate)
      dispatchFrame('doc_update', ownEcho)

      expect(projectionState.applyFrame).toHaveBeenNthCalledWith(
        1,
        remoteUpdate
      )
      expect(projectionState.applyFrame).toHaveBeenNthCalledWith(2, ownEcho)
      expect(projectionState.discardPending).not.toHaveBeenCalled()

      graph.value = liveGraph
      await nextTick()

      expect(projectionState.applyCollected).toHaveBeenCalledExactlyOnceWith(
        'wf-1'
      )
      unmount()
    })

    it.for([
      {
        name: 'another tab of the same user',
        frame: () => ({ actor: 'human:anonymous:other-tab', catchUp: false })
      },
      {
        name: 'a catch-up frame last written by this tab',
        frame: (ownActor: string) => ({ actor: ownActor, catchUp: true })
      }
    ])('still applies $name', async ({ frame }) => {
      const { unmount, ownActor } = await mountAndSendOneOp()
      const update = { workflowId: 'wf-1', seq: 42, ...frame(ownActor) }

      dispatchFrame('doc_update', update)

      expect(projectionState.applyFrame).toHaveBeenCalledExactlyOnceWith(update)
      expect(projectionState.discardPending).not.toHaveBeenCalled()
      unmount()
    })
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
        const { enqueueHumanOperations } = useAgentCrdtFollower(workflowId, {
          transport: agentSocket.transport
        })
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
        const { enqueueHumanOperations } = useAgentCrdtFollower(workflowId, {
          transport: agentSocket.transport
        })
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

  it('settles a stranded in-flight batch before notifying onSyncError of a permanent refusal', async () => {
    vi.useFakeTimers()
    const { recordDevEvent } = await import('./devPanelLog')
    const workflowId = ref<string | null>('wf-1')
    const onSyncError = vi.fn()
    let enqueue!: ReturnType<
      typeof useAgentCrdtFollower
    >['enqueueHumanOperations']
    const host = defineComponent({
      setup() {
        const { enqueueHumanOperations } = useAgentCrdtFollower(workflowId, {
          transport: agentSocket.transport,
          events: { onSyncError }
        })
        enqueue = enqueueHumanOperations
        return () => null
      }
    })
    const { unmount } = render(host)

    enqueue([{ op: 'delete_node', node_id: '1', removed_links: [] }])
    await Promise.resolve()
    expect(clientState.sendOps).toHaveBeenCalledTimes(1)

    bridge().subscribedWorkflowId = null
    dispatchFrame('doc_subscribed', {
      ok: false,
      workflowId: 'wf-1',
      code: 'schema_version_mismatch'
    })

    expect(onSyncError).toHaveBeenCalledTimes(1)
    const settleCallIndex = vi
      .mocked(recordDevEvent)
      .mock.calls.findIndex(([event]) => event === 'human_ops_settled')
    expect(settleCallIndex).toBeGreaterThanOrEqual(0)
    const settleOrder =
      vi.mocked(recordDevEvent).mock.invocationCallOrder[settleCallIndex]
    // onDocReset's precedent: cleanup that could strand held/in-flight ops
    // runs before notifying consumer code (the toast store) that could throw.
    expect(settleOrder).toBeLessThan(onSyncError.mock.invocationCallOrder[0])
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
        const { enqueueHumanOperations } = useAgentCrdtFollower(workflowId, {
          transport: agentSocket.transport
        })
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
        const { enqueueHumanOperations } = useAgentCrdtFollower(workflowId, {
          transport: agentSocket.transport
        })
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
          const { enqueueHumanOperations } = useAgentCrdtFollower(workflowId, {
            transport: agentSocket.transport,
            isTargetActive
          })
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

    it('notes a local widget write with the projection on enqueue and settles it when the host answers', async () => {
      const { unmount, enqueue } = mountWriter('wf-1')
      const setWidget = {
        op: 'set_widget' as const,
        node_id: '1',
        widget: 'text',
        value: 'hello'
      }
      enqueue([setWidget])
      expect(projectionState.noteLocalWrites).toHaveBeenCalledWith([setWidget])
      expect(projectionState.settleLocalWrites).not.toHaveBeenCalled()

      await Promise.resolve()
      ackSent(0)

      expect(projectionState.settleLocalWrites).toHaveBeenCalledWith([
        expect.objectContaining(setWidget)
      ])
      unmount()
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
    agentSocket.open()
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

    agentSocket.open()
    expect(bridge().reconnect).toHaveBeenCalledOnce()
    dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)

    expect(bridge().resubscribe).toHaveBeenCalledTimes(3)
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
        surface: 'agent',
        errorType: 'failure_confirming_agent_doc_subscribe',
        level: 'warning',
        tags: { feature_area: 'agent', operation: 'sync', outcome: 'gave_up' }
      }
    )
    bridge().reconcile.mockClear()
    dispatchFrame('doc_subscribed', { ok: false })
    vi.advanceTimersByTime(30_000)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(2)
    agentSocket.open()
    expect(bridge().reconnect).toHaveBeenCalledOnce()
    dispatchFrame('doc_subscribe_sent', { workflowId: 'wf-1' })
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)
    expect(bridge().resubscribe).toHaveBeenCalledTimes(3)
    unmount()
  })

  function transportFailingToStop(
    failure: unknown
  ): AgentCrdtFollowerOptions['transport'] {
    return {
      ...agentSocket.transport,
      onSocketStatus: () => () => {
        throw failure
      }
    }
  }

  it('tears down totally on unmount, reporting every cleanup failure instead of throwing', () => {
    const hookErrors: unknown[] = []
    const listenerFailure = new Error('listener removal failed')
    const clientFailure = new Error('client destroy failed')
    const transport = transportFailingToStop(listenerFailure)
    const workflowId = ref<string | null>('wf-1')
    const host = defineComponent({
      setup() {
        useAgentCrdtFollower(workflowId, { transport })
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
    clientState.destroy.mockImplementation(() => {
      throw clientFailure
    })

    unmount()

    expect(hookErrors).toEqual([])
    expect(reportedTeardownErrors()).toStrictEqual([
      listenerFailure,
      clientFailure
    ])
    expect(projectionState.destroy).toHaveBeenCalled()
    expect(bridge().destroy).toHaveBeenCalled()
    expect(clientState.destroy).toHaveBeenCalled()
  })

  it('reports cleanup failures that throw a nullish value', () => {
    const { unmount } = mountFollower(
      'wf-1',
      true,
      () => null,
      {},
      {
        transport: transportFailingToStop(null)
      }
    )
    clientState.destroy.mockImplementation(() => {
      throw undefined
    })

    unmount()

    expect(reportedTeardownErrors()).toStrictEqual([null, undefined])
    expect(clientState.destroy).toHaveBeenCalled()
  })

  describe('stale-schema reseed on subscribe', () => {
    const canvas = {
      last_node_id: 1,
      nodes: [{ id: 1, type: 'CheckpointLoaderSimple' }],
      links: []
    }
    const staleRefusal = {
      workflowId: 'wf-1',
      ok: false,
      code: 'stale_schema_reseed_required',
      expectedSeq: 7
    }

    function mountWithCanvas(
      canvasFor: (workflowId: string) => Record<string, unknown> | null = () =>
        canvas
    ) {
      return mountFollower('wf-1', true, () => null, {}, { canvasFor })
    }

    function refuseAsStale(frame: Record<string, unknown> = staleRefusal) {
      bridge().canReseed.mockReturnValue(true)
      dispatchFrame('doc_subscribed', frame)
    }

    it('answers the refusal once with the canvas the tab shows, under the subscribe ack timeout', () => {
      vi.useFakeTimers()
      const { unmount } = mountWithCanvas((id) =>
        id === 'wf-1' ? canvas : null
      )

      refuseAsStale()

      expect(bridge().reseed).toHaveBeenCalledExactlyOnceWith('wf-1', canvas)
      vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS - 1)
      expect(bridge().resubscribe).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
      unmount()
    })

    it.for<
      [
        string,
        {
          canReseed: boolean
          canvas: Record<string, unknown> | null
          reseedLeaves: boolean
        }
      ]
    >([
      [
        'there is no refusal token',
        { canReseed: false, canvas, reseedLeaves: true }
      ],
      [
        'there is no canvas',
        { canReseed: true, canvas: null, reseedLeaves: true }
      ],
      [
        'the canvas is empty',
        {
          canReseed: true,
          canvas: { nodes: [], links: [] },
          reseedLeaves: true
        }
      ],
      [
        'the reseed cannot leave the socket',
        { canReseed: true, canvas, reseedLeaves: false }
      ]
    ])('falls back to the refused-subscribe backoff when %s', ([, row]) => {
      vi.useFakeTimers()
      const { unmount } = mountWithCanvas(() => row.canvas)
      bridge().canReseed.mockReturnValue(row.canReseed)
      bridge().reseed.mockReturnValue(row.reseedLeaves)

      dispatchFrame('doc_subscribed', staleRefusal)

      vi.advanceTimersByTime(500)
      expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
      unmount()
    })

    it('does not reseed for a non-stale refusal', () => {
      const { unmount } = mountWithCanvas()

      dispatchFrame('doc_subscribed', {
        workflowId: 'wf-1',
        ok: false,
        code: 'schema_version_mismatch'
      })

      expect(bridge().reseed).not.toHaveBeenCalled()
      unmount()
    })

    it('stops probing a document whose reseed was refused, quietly', () => {
      vi.useFakeTimers()
      telemetryState.reportError.mockClear()
      const { unmount } = mountWithCanvas()

      refuseAsStale()
      dispatchFrame('doc_reseed_result', {
        workflowId: 'wf-1',
        ok: false,
        code: 'stale_schema_reseed_refused'
      })
      vi.advanceTimersByTime(10 * 60_000)

      expect(bridge().resubscribe).not.toHaveBeenCalled()
      expect(bridge().reconcile).not.toHaveBeenCalled()
      expect(telemetryState.reportError).not.toHaveBeenCalled()
      unmount()
    })

    it('backs off and resubscribes after a transient reseed failure', () => {
      vi.useFakeTimers()
      const { unmount } = mountWithCanvas()

      refuseAsStale()
      dispatchFrame('doc_reseed_result', {
        workflowId: 'wf-1',
        ok: false,
        code: 'unavailable'
      })
      vi.advanceTimersByTime(500)

      expect(bridge().resubscribe).toHaveBeenCalledTimes(1)
      unmount()
    })

    it('keeps the draft seed withheld while a reseed is in flight, and releases it once the reseed is refused for good', () => {
      vi.useFakeTimers()
      const { unmount, status } = mountWithCanvas()

      refuseAsStale()
      expect(status().terminal).toBeNull()

      dispatchFrame('doc_reseed_result', {
        workflowId: 'wf-1',
        ok: false,
        code: 'stale_schema_reseed_refused'
      })
      expect(status().terminal).toBe('refused')
      unmount()
    })

    it('keeps a stale canvas withheld while a reseed is in flight', () => {
      const { unmount, status } = mountWithCanvas()
      dispatchFrame('doc_subscribed', {
        ok: true,
        workflow_id: 'wf-1',
        seq: 1
      })
      agentSocket.drop()
      agentSocket.open()

      refuseAsStale()

      expect(status().canvasMayBeStale).toBe(true)
      unmount()
    })

    it('a reconnect on the agent socket clears a refused reseed and lets the new session reseed once', () => {
      vi.useFakeTimers()
      const { unmount, status } = mountWithCanvas()
      refuseAsStale()
      dispatchFrame('doc_reseed_result', {
        workflowId: 'wf-1',
        ok: false,
        code: 'stale_schema_reseed_refused'
      })
      expect(status().terminal).toBe('refused')

      agentSocket.open()

      expect(bridge().reconnect).toHaveBeenCalledOnce()
      expect(status().terminal).toBeNull()
      refuseAsStale()
      expect(bridge().reseed).toHaveBeenCalledTimes(2)
      expect(status().terminal).toBeNull()
      unmount()
    })

    it('a retarget allows one reseed for the new binding', () => {
      vi.useFakeTimers()
      const { unmount, workflowId } = mountWithCanvas()

      refuseAsStale()
      workflowId.value = 'wf-2'
      return nextTick().then(() => {
        refuseAsStale({ ...staleRefusal, workflowId: 'wf-2' })
        expect(bridge().reseed).toHaveBeenCalledTimes(2)
        expect(bridge().reseed).toHaveBeenLastCalledWith('wf-2', canvas)
        unmount()
      })
    })
  })
})
