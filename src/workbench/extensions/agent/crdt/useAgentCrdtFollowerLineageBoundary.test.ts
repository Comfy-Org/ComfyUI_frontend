/**
 * ADR-CRDT-RECONCILE-0035 (a): proves, through the REAL `LayoutFollowerBridge`
 * and `DocFrameClient` (only the wire transport and the ECS adapter are
 * doubled — see `followerSubscription.test.ts` for the same boundary), what
 * `useAgentCrdtFollower.test.ts`'s fully-mocked-bridge suite cannot: whether a
 * `doc_reset` for the tracked workflow that lands while a tab is inactive
 * ever reaches this composable's `pendingCorrelation.resetIfTracked`.
 *
 * It does not, today. `deactivateTarget` (`useAgentCrdtFollower.ts`) calls
 * `bridge.unsubscribe()`, which clears `LayoutFollowerBridge`'s
 * `sentWorkflowId` (`layoutFollowerBridge.ts`'s `reconcile()`); its
 * `onDocReset` then drops any reset whose `workflowId !== this.sentWorkflowId`
 * before it is ever re-dispatched as a `doc_reset` CustomEvent. A reset for
 * the still-bound workflow that the server sends while this tab is
 * unsubscribed therefore never reaches `useAgentCrdtFollower.ts` at all.
 *
 * Detecting that break on return would need a signal the current wire
 * protocol does not carry: `DocSubscribed`/`DocReset` have only
 * `workflow_id`/`seq`/`ok`/`code`/`message` (`common/websocket/docframes/
 * docframes.gen.go` in `Comfy-Org/cloud`), and `seq` is a single counter that
 * a re-mint only ever ADVANCES, never resets (`common/websocket/messages/
 * crdt.go`'s `DocUpdateFrame`/`DocResetFrame` docs; `services/agent/internal/
 * shadowdiff/remint.go`'s `RemintResult.ToSeq` > `FromSeq`). So neither the
 * resubscribe ack nor the first post-reactivation frame carries anything this
 * follower could compare against what it tracked before deactivating —
 * closing this gap for real needs a backend wire change (e.g. a per-lineage
 * generation id on `doc_subscribed`), which is out of scope for this
 * frontend-only PR and is left as a followup.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { render } from '@testing-library/vue'

import type { reportError as reportErrorFn } from '@/platform/telemetry/reportError'

import type { GraphMutations } from './graphMutations'
import type { GraphOperation } from './graphOperations'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const adapterState = vi.hoisted(() => ({
  bind: vi.fn(),
  unbind: vi.fn(),
  applyFrame: vi.fn(() => true),
  retryPending: vi.fn(() => null),
  reconcileFromDoc: vi.fn(() => true),
  clearForReset: vi.fn(),
  discardPending: vi.fn(),
  destroy: vi.fn()
}))

vi.mock<unknown>(import('./ecsFollowerAdapter'), () => ({
  EcsFollowerAdapter: class {
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
        .map((frame) => JSON.parse(frame) as { type: string; data: unknown })
        .filter((frame) => frame.type === type)
    }
  }
  return {
    FakeTransport,
    current: null as InstanceType<typeof FakeTransport> | null
  }
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

const graphMutations = {} as GraphMutations

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
  unmount: () => void
} {
  const workflowId = ref<string | null>(initial)
  let enqueue!: (operations: GraphOperation[]) => void
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
  return { enqueue, unmount }
}

describe('useAgentCrdtFollower — lineage break through the real bridge/transport boundary', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
    transportState.current = null
    for (const fn of Object.values(adapterState)) fn.mockClear()
    adapterState.applyFrame.mockReturnValue(true)
  })

  it('F4: a same-workflow doc_reset that lands while the tab is inactive never reaches the composable (unreachable via the real bridge)', async () => {
    const { recordDevEvent } = await import('./devPanelLog')
    const isTargetActive = ref(true)
    const { enqueue, unmount } = mountFollower('wf-1', isTargetActive)

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
    unmount()
  })
})
