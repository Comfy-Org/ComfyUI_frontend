/**
 * FE-2158 (tab/lifetime child) — regression coverage for the workflow-tab
 * lifecycle around `useAgentCrdtFollower`: open a tab, switch away, close it,
 * remount the panel, and verify the composable never accumulates more than
 * one LIVE subscription and never projects a frame stamped for a workflow
 * other than the one currently bound.
 *
 * This mirrors the mocking shape in `crossWorkflowPending.test.ts` (same
 * fake bridge/client/adapter doubles) but drives the sequence a real tab
 * strip produces: mount (open tab A) -> switch to tab B (A goes inactive,
 * B active) -> close tab A (unrelated to B's binding) -> unmount + remount
 * the panel (simulates a panel remount while B stays the active tab).
 */
import type { Op } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import type { GraphMutations } from '@/core/graph/graphMutations'
import { render } from '@testing-library/vue'

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
    instances: [] as InstanceType<typeof FakeBridge>[],
    current: null as InstanceType<typeof FakeBridge> | null,
    transport
  }
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
  applyFrame: vi.fn(() => true),
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

vi.mock<unknown>(import('./layoutFollowerBridge'), () => ({
  LayoutFollowerBridge: class {
    constructor() {
      const bridge = new bridgeState.FakeBridge()
      bridgeState.current = bridge
      bridgeState.instances.push(bridge)
      return bridge
    }
  }
}))

vi.mock<unknown>(import('./docFrameClient'), () => ({
  DocFrameClient: class {
    destroy = clientState.destroy
    sendOps = clientState.sendOps
  }
}))

vi.mock<unknown>(import('./ecsFollowerAdapter'), () => ({
  EcsFollowerAdapter: class {
    bind = adapterState.bind
    unbind = adapterState.unbind
    applyFrame = adapterState.applyFrame
    clearForReset = adapterState.clearForReset
    discardPending = adapterState.discardPending
    destroy = adapterState.destroy
  }
}))

vi.mock(import('./devPanelLog'), () => ({
  recordDevEvent: devLogState.recordDevEvent
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({ api: apiState.api }))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { graph: null, canvas: null }
}))

import { useAgentCrdtFollower } from './useAgentCrdtFollower'
import type {
  AgentCrdtOutcomeCounters,
  AgentCrdtStatus
} from './useAgentCrdtFollower'

// Every method the interface declares, so a contract change fails to compile
// here instead of silently leaving an empty object satisfying the cast.
const graphMutations: GraphMutations = {
  batch: vi.fn(() => true),
  addNode: vi.fn(() => true),
  setWidget: vi.fn(() => true),
  connect: vi.fn(() => true),
  deleteNode: vi.fn(() => true),
  clearSemanticGraph: vi.fn(() => true)
}

/**
 * Mounts a panel instance the way `AgentPanelRoot.vue` does: a reactive
 * `workflowId` for the tab this panel is bound to, and an `isTargetActive`
 * flag that flips false when the tab strip switches away from this tab.
 * Returns handles for driving tab-switch / tab-close / panel-remount.
 */
function mountPanel(
  initialWorkflowId: string,
  initialActive: boolean
): {
  unmount: () => void
  workflowId: Ref<string | null>
  isActive: Ref<boolean>
  outcomes: () => AgentCrdtOutcomeCounters
} {
  const workflowId = ref<string | null>(initialWorkflowId)
  const isActive = ref(initialActive)
  let exposedStatus!: () => AgentCrdtStatus
  const host = defineComponent({
    setup() {
      const { status } = useAgentCrdtFollower(
        workflowId,
        graphMutations,
        () => null,
        isActive
      )
      exposedStatus = () => status.value as AgentCrdtStatus
      return () => null
    }
  })
  const { unmount } = render(host)
  return {
    unmount,
    workflowId,
    isActive,
    outcomes: () => exposedStatus().outcomes
  }
}

/** Net count of subscriptions currently believed live across every bridge
 * instance constructed so far. A bridge counts as live only if it has ever
 * subscribed, has not since unsubscribed (the active->inactive edge), and has
 * not been torn down (`destroy()`, the panel-unmount teardown path — which
 * releases the transport without a separate `unsubscribe()` call). */
function liveSubscriptionCount(): number {
  return bridgeState.instances.filter(
    (instance) =>
      instance.subscribe.mock.calls.length > 0 &&
      instance.unsubscribe.mock.calls.length === 0 &&
      instance.destroy.mock.calls.length === 0
  ).length
}

function bridgeFor(
  index: number
): InstanceType<(typeof bridgeState)['FakeBridge']> {
  const instance = bridgeState.instances.at(index)
  if (!instance) throw new Error(`no bridge constructed at index ${index}`)
  return instance
}

function dispatchDocUpdate(
  bridge: InstanceType<(typeof bridgeState)['FakeBridge']>,
  workflowId: string,
  seq: number
): void {
  bridge.dispatchEvent(
    new CustomEvent('doc_update', {
      detail: { workflowId, seq, update: new Uint8Array() }
    })
  )
}

describe('FE-2158 tab lifetime: open / switch / close / remount', () => {
  beforeEach(() => {
    bridgeState.current = null
    bridgeState.instances = []
    bridgeState.transport.up = true
    clientState.transportUp = true
    clientState.sent = []
    clientState.sendOps.mockClear()
    adapterState.bind.mockClear()
    adapterState.unbind.mockClear()
    adapterState.applyFrame.mockClear()
    adapterState.destroy.mockClear()
    devLogState.recordDevEvent.mockClear()
  })

  it('leaves exactly one live subscription and applies no cross-workflow frame after open, switch, close, and remount', async () => {
    // 1. Open tab A: panel A mounts active and bound to workflow A.
    const panelA = mountPanel('wf-a', true)
    await nextTick()
    expect(bridgeState.instances).toHaveLength(1)
    expect(bridgeFor(0).subscribe).toHaveBeenCalledWith('wf-a')
    expect(liveSubscriptionCount()).toBe(1)

    // 2. Open tab B and switch to it: the tab strip flips A inactive and
    // mounts/activates B. A's composable unsubscribes on the active->false
    // edge; B's composable (a second panel instance, same as a second tab
    // binding a follower) subscribes to workflow B.
    panelA.isActive.value = false
    await nextTick()
    expect(bridgeFor(0).unsubscribe).toHaveBeenCalledTimes(1)
    expect(liveSubscriptionCount()).toBe(0)

    const panelB = mountPanel('wf-b', true)
    await nextTick()
    expect(bridgeState.instances).toHaveLength(2)
    expect(bridgeFor(1).subscribe).toHaveBeenCalledWith('wf-b')
    expect(liveSubscriptionCount()).toBe(1)

    // 3. Close tab A: its panel unmounts. Teardown must fully release the
    // stale bridge (no double-unsubscribe, no leaked listener) and must not
    // touch B's live subscription count.
    panelA.unmount()
    await nextTick()
    expect(adapterState.destroy).toHaveBeenCalledTimes(1)
    expect(liveSubscriptionCount()).toBe(1)

    // A's bridge is stale post-close: a frame arriving late for workflow A
    // (e.g. an in-flight server frame that raced the close) must not be
    // projected by B's adapter. Dispatch it on A's now-destroyed bridge to
    // characterize that a post-teardown frame is inert, then dispatch a
    // same-shaped frame on B's live bridge tagged with A's workflow id to
    // characterize the cross-workflow guard on the live path.
    // Captured before the dispatch: every assertion below is about panel B, so
    // without this a LEAKED panel A listener would receive the stale frame,
    // skip it, and leave B's counters untouched — the test would pass through
    // exactly the leak it exists to catch. A's status closure survives unmount.
    const panelAAfterClose = { ...panelA.outcomes() }

    dispatchDocUpdate(bridgeFor(0), 'wf-a', 99)
    dispatchDocUpdate(bridgeFor(1), 'wf-a', 1)
    await nextTick()
    expect(adapterState.applyFrame).not.toHaveBeenCalled()
    expect(panelB.outcomes().applied).toBe(0)
    expect(panelB.outcomes().skipped).toBeGreaterThan(0)
    // A saw nothing at all — neither applied nor skipped. A skip would still
    // mean its listener was alive.
    expect(panelA.outcomes()).toEqual(panelAAfterClose)

    // A same-workflow frame on B's own bridge DOES apply, proving the guard
    // above discriminated on workflow id and not on some broader silence.
    dispatchDocUpdate(bridgeFor(1), 'wf-b', 2)
    await nextTick()
    expect(adapterState.applyFrame).toHaveBeenCalledTimes(1)
    expect(panelB.outcomes().applied).toBe(1)

    // 4. Remount the panel for workflow B (simulates a panel unmount +
    // immediate remount while tab B stays the active tab, e.g. an extension
    // reload). The old bridge must be fully torn down and exactly one new
    // live subscription must exist afterward — never zero (lost binding),
    // never two (leaked prior subscription).
    panelB.unmount()
    await nextTick()
    expect(liveSubscriptionCount()).toBe(0)

    const panelBRemounted = mountPanel('wf-b', true)
    await nextTick()
    expect(bridgeState.instances).toHaveLength(3)
    expect(bridgeFor(2).subscribe).toHaveBeenCalledWith('wf-b')
    expect(liveSubscriptionCount()).toBe(1)

    // A stale frame for the closed tab A workflow still must not land on the
    // remounted panel.
    dispatchDocUpdate(bridgeFor(2), 'wf-a', 100)
    await nextTick()
    expect(panelBRemounted.outcomes().applied).toBe(0)
    expect(panelBRemounted.outcomes().skipped).toBeGreaterThan(0)

    panelBRemounted.unmount()
    await nextTick()
    expect(liveSubscriptionCount()).toBe(0)
  })
})
