/**
 * ADR-CRDT-RECONCILE-0035 (a): proves, through the REAL `LayoutFollowerBridge`
 * and `DocFrameClient` (only the wire transport and the ECS adapter are
 * doubled — see `followerSubscription.test.ts` for the same boundary), what
 * `useAgentCrdtFollower.test.ts`'s fully-mocked-bridge suite cannot: whether a
 * `doc_reset` for the tracked workflow that lands while a tab is inactive ever
 * reaches this composable's `pendingCorrelation.resetIfTracked` (it does not:
 * `LayoutFollowerBridge.onDocReset` filters any reset whose `workflowId`
 * disagrees with its own `sentWorkflowId`, which `unsubscribe()` already
 * cleared), and how `pendingCorrelation.ts`'s reactivation continuity rule
 * and subscribe-generation barrier behave against the real bridge's own
 * subscribe/unsubscribe/ack sequencing once a resubscribe's ack arrives. The
 * backend dependency and protocol gap this leaves open are recorded in
 * ADR-CRDT-RECONCILE-0035, not here.
 */
import { mint } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import * as Y from 'yjs'

import { render } from '@testing-library/vue'

import type { reportError as reportErrorFn } from '@/platform/telemetry/reportError'

import { encodeBase64 } from './docFrameClient'
import type { GraphMutations } from './graphMutations'
import type { GraphOperation } from './graphOperations'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

interface AdapterState {
  bind: ReturnType<typeof vi.fn>
  unbind: ReturnType<typeof vi.fn>
  applyFrame: ReturnType<typeof vi.fn>
  retryPending: ReturnType<typeof vi.fn>
  reconcileFromDoc: ReturnType<typeof vi.fn>
  clearForReset: ReturnType<typeof vi.fn>
  discardPending: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  /**
   * Captured so a test can read `LocalIntent.pendingAdds`/`pendingConnects`
   * at reconcile time — the coordination boundary's own guard against
   * retaining old-lineage ids while continuity is still unknown.
   */
  intent: {
    pendingAdds(workflowId: string): ReadonlySet<string>
    pendingConnects(workflowId: string): ReadonlySet<string>
  } | null
}

const adapterState = vi.hoisted(
  (): AdapterState => ({
    bind: vi.fn(),
    unbind: vi.fn(),
    applyFrame: vi.fn(() => true),
    retryPending: vi.fn(() => null),
    reconcileFromDoc: vi.fn(() => true),
    clearForReset: vi.fn(),
    discardPending: vi.fn(),
    destroy: vi.fn(),
    intent: null
  })
)

vi.mock<unknown>(import('./ecsFollowerAdapter'), () => ({
  EcsFollowerAdapter: class {
    constructor(
      _mutations: unknown,
      _pendingAddType: unknown,
      intent?: (typeof adapterState)['intent']
    ) {
      adapterState.intent = intent ?? null
    }
    bind = adapterState.bind
    unbind = adapterState.unbind
    applyFrame = adapterState.applyFrame
    retryPending = adapterState.retryPending
    reconcileFromDoc = adapterState.reconcileFromDoc
    clearForReset = adapterState.clearForReset
    discardPending = adapterState.discardPending
    destroy = adapterState.destroy
  }
}))

vi.mock(import('./agentNodeMaterializer'), () => ({
  reconcileAgentAdapters: vi.fn(() => [])
}))
vi.mock(import('./agentSubgraphDefinitions'), () => ({
  readSubgraphDefinitionIds: vi.fn(() => []),
  readSubgraphDefinitions: vi.fn(() => [])
}))
vi.mock(import('./devPanelLog'), () => ({
  recordDevEvent: vi.fn(),
  sanitizeDevEventDetail: vi.fn((detail: unknown) => detail)
}))

const telemetryState = vi.hoisted(() => ({
  reportError: vi.fn<typeof reportErrorFn>()
}))
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: telemetryState.reportError
}))

const apiState = vi.hoisted(() => {
  const target = new EventTarget()
  return {
    api: {
      addEventListener: (type: string, listener: EventListener) =>
        target.addEventListener(type, listener),
      removeEventListener: (type: string, listener: EventListener) =>
        target.removeEventListener(type, listener)
    }
  }
})
vi.mock<unknown>(import('@/scripts/api'), () => ({ api: apiState.api }))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { graph: null, canvas: null }
}))

/**
 * The real `DocFrameTransport` seam, doubled the same way
 * `followerSubscription.test.ts`'s `SocketTransport` doubles it: an
 * always-open socket that records outbound frames and lets a test deliver an
 * inbound one by dispatching the wire event `DocFrameClient` listens for.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseWireFrame(frame: string): { type: string; data: unknown } | null {
  const parsed = JSON.parse(frame)
  if (!isRecord(parsed) || typeof parsed.type !== 'string') return null
  return { type: parsed.type, data: parsed.data }
}

const transportState = vi.hoisted(() => {
  class FakeTransport extends EventTarget {
    readonly sent: string[] = []
    send(frame: string): boolean {
      this.sent.push(frame)
      return true
    }
    deliver(type: string, data: unknown): void {
      this.dispatchEvent(new CustomEvent(type, { detail: data }))
    }
    framesOfType(type: string): { type: string; data: unknown }[] {
      return this.sent
        .map((frame) => parseWireFrame(frame))
        .filter(
          (frame): frame is { type: string; data: unknown } =>
            frame !== null && frame.type === type
        )
    }
  }
  const state: {
    FakeTransport: typeof FakeTransport
    current: InstanceType<typeof FakeTransport> | null
  } = { FakeTransport, current: null }
  return state
})

vi.mock<unknown>(import('./agentCrdtTransport'), () => ({
  apiTransport: {},
  createLoggedTransport: () => {
    const transport = new transportState.FakeTransport()
    transportState.current = transport
    return transport
  }
}))

import { useAgentCrdtFollower } from './useAgentCrdtFollower'

const graphMutations: GraphMutations = {
  batch: vi.fn(() => true),
  addNode: vi.fn(() => true),
  setWidget: vi.fn(() => true),
  connect: vi.fn(() => true),
  deleteNode: vi.fn(() => true),
  clearSemanticGraph: vi.fn(() => true),
  getNodeType: vi.fn(() => undefined)
}

function transport(): InstanceType<(typeof transportState)['FakeTransport']> {
  const current = transportState.current
  if (!current) throw new Error('no transport constructed')
  return current
}

/** True if any `pending_ops` dev-event call in `calls` carries a `reset`. */
function isPendingOpsReset(calls: readonly (readonly unknown[])[]): boolean {
  return calls.some(([event, detail]) => {
    if (event !== 'pending_ops') return false
    return (
      typeof detail === 'object' &&
      detail !== null &&
      'type' in detail &&
      detail.type === 'reset'
    )
  })
}

function mountFollower(
  initial: string | null,
  isTargetActive: Ref<boolean>
): {
  enqueue: (operations: GraphOperation[]) => void
} {
  const workflowId = ref<string | null>(initial)
  let enqueue: ((operations: GraphOperation[]) => void) | undefined
  const host = defineComponent({
    setup() {
      enqueue = useAgentCrdtFollower(
        workflowId,
        graphMutations,
        () => null,
        isTargetActive
      ).enqueueHumanOperations
      return () => null
    }
  })
  const { unmount } = render(host)
  onTestFinished(unmount)
  if (!enqueue)
    throw new Error('useAgentCrdtFollower setup() did not run during render')
  return { enqueue }
}

/** A real, schema-valid catch-up `doc_update` wire frame at `seq`. */
function hostUpdateFrame(workflowId: string, seq: number) {
  const doc = mint({ nodes: [], links: [] }, { types: {} })
  return {
    v: 1,
    workflow_id: workflowId,
    seq,
    update_b64: encodeBase64(Y.encodeStateAsUpdate(doc))
  }
}

describe('useAgentCrdtFollower — lineage break through the real bridge/transport boundary', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
    transportState.current = null
    adapterState.intent = null
  })

  it('F4: a same-workflow doc_reset that lands while the tab is inactive never reaches the composable (unreachable via the real bridge)', async () => {
    const { recordDevEvent } = await import('./devPanelLog')
    const isTargetActive = ref(true)
    const { enqueue } = mountFollower('wf-1', isTargetActive)

    transport().deliver('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 1
    })
    enqueue([
      {
        op: 'add_node',
        node_id: 5,
        class_type: 'Test',
        pos: [0, 0],
        node: { id: 5, type: 'Test', inputs: [], outputs: [] }
      }
    ])
    await Promise.resolve()
    expect(transport().framesOfType('doc_ops')).toHaveLength(1)

    // Tab switch away: the real bridge's `unsubscribe()` clears its
    // `sentWorkflowId` synchronously (`layoutFollowerBridge.ts`'s
    // `reconcile()`), confirmed here by the outbound `doc_unsubscribe`.
    isTargetActive.value = false
    await nextTick()
    expect(transport().framesOfType('doc_unsubscribe')).toHaveLength(1)

    vi.mocked(recordDevEvent).mockClear()
    // The server broadcasts a lineage break for the still-tracked workflow
    // while this client has no live subscription for it.
    transport().deliver('doc_reset', { v: 1, workflow_id: 'wf-1', seq: 3 })

    // `LayoutFollowerBridge.onDocReset` filters it before it becomes a
    // `doc_reset` CustomEvent, so `pendingCorrelation.resetIfTracked` is
    // never called and no `reset` dev-event is recorded — in contrast to
    // dispatching `doc_reset` directly on a mocked bridge, which cannot
    // observe this filter at all.
    expect(isPendingOpsReset(vi.mocked(recordDevEvent).mock.calls)).toBe(false)

    isTargetActive.value = true
    await nextTick()
  })

  it('C3(i)/(iii): a resubscribe ack matching the projected watermark establishes continuity, and a duplicate ack is not a second barrier', async () => {
    const isTargetActive = ref(true)
    mountFollower('wf-1', isTargetActive)

    transport().deliver('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 1
    })
    transport().deliver('doc_update', hostUpdateFrame('wf-1', 1))
    expect(adapterState.applyFrame).toHaveBeenCalledTimes(1)

    // Tab away, then back: this is a reactivation, so the resume's ack is
    // checked for continuity with what was last projected (seq 1).
    isTargetActive.value = false
    await nextTick()
    isTargetActive.value = true
    await nextTick()
    expect(transport().framesOfType('doc_subscribe')).toHaveLength(2)

    adapterState.reconcileFromDoc.mockClear()
    transport().deliver('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 1
    })
    expect(adapterState.reconcileFromDoc).toHaveBeenCalledWith('wf-1', 1)

    // A duplicate/delayed-retry ack for the SAME resubscribe (same
    // generation) must not act as a second barrier.
    adapterState.reconcileFromDoc.mockClear()
    transport().deliver('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 1
    })
    expect(adapterState.reconcileFromDoc).not.toHaveBeenCalled()
  })

  it('C3(ii): an ack whose seq diverges after reactivation conservatively invalidates instead of trusting the ledger', async () => {
    const isTargetActive = ref(true)
    mountFollower('wf-1', isTargetActive)

    transport().deliver('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 1
    })
    transport().deliver('doc_update', hostUpdateFrame('wf-1', 1))

    isTargetActive.value = false
    await nextTick()
    isTargetActive.value = true
    await nextTick()
    expect(transport().framesOfType('doc_subscribe')).toHaveLength(2)

    adapterState.reconcileFromDoc.mockClear()
    // A remint under the SAME workflow id while this tab was away (the gap
    // this frontend has no generation token to detect directly): the ack's
    // seq no longer matches what this correlation last projected.
    transport().deliver('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 9
    })

    // Continuity failed: the forced reconcile an already-current ack would
    // otherwise run must NOT run against a doc this ack cannot vouch for.
    expect(adapterState.reconcileFromDoc).not.toHaveBeenCalled()
  })

  it("C3: pendingAdds/pendingConnects retain nothing while a reactivation's continuity is still unknown (a frame can outrun its own resume's ack)", async () => {
    const isTargetActive = ref(true)
    const { enqueue } = mountFollower('wf-1', isTargetActive)

    transport().deliver('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 1
    })
    transport().deliver('doc_update', hostUpdateFrame('wf-1', 1))

    enqueue([
      {
        op: 'add_node',
        node_id: 5,
        class_type: 'Test',
        pos: [0, 0],
        node: { id: 5, type: 'Test', inputs: [], outputs: [] }
      },
      {
        op: 'connect',
        link_id: 7,
        from_node: 1,
        from_slot: 0,
        to_node: 5,
        to_slot: 0,
        link_type: 'IMAGE'
      }
    ])
    await Promise.resolve()
    expect(transport().framesOfType('doc_ops')).toHaveLength(1)

    const intent = adapterState.intent
    if (!intent) throw new Error('the adapter was never constructed')
    expect([...intent.pendingAdds('wf-1')]).toEqual(['5'])
    expect([...intent.pendingConnects('wf-1')]).toEqual(['7'])

    isTargetActive.value = false
    await nextTick()
    isTargetActive.value = true
    await nextTick()
    expect(transport().framesOfType('doc_subscribe')).toHaveLength(2)

    // The resume's own subscribe left the transport, but its ack has not
    // arrived yet: continuity with what this correlation last projected is
    // unknown, so a live/catch-up frame that outran the ack — exactly the
    // race `layoutFollowerBridge.ts` already documents for its OWN ack —
    // must not see the ledger's real, possibly wrong-lineage ids.
    expect([...intent.pendingAdds('wf-1')]).toEqual([])
    expect([...intent.pendingConnects('wf-1')]).toEqual([])

    // Continuity established once the ack lands (same seq as projected):
    // the real ids are retained again for every reconcile from here on.
    transport().deliver('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 1
    })
    expect([...intent.pendingAdds('wf-1')]).toEqual(['5'])
    expect([...intent.pendingConnects('wf-1')]).toEqual(['7'])
  })
})
