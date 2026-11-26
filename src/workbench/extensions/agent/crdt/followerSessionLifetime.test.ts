import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { render } from '@testing-library/vue'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import type { FrameOutcome } from './agentCrdtProjection'
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
    reconnect = vi.fn()
    reconcile = vi.fn()
    destroy = vi.fn()
    subscribedWorkflowId: string | null = null
    lastSequence = 0
    isCatchingUp = false
    follower = {
      updatesApplied: 0,
      doc: {
        share: new Map(),
        getMap: () => ({ toJSON: () => ({}), get: () => undefined })
      }
    }
  }

  return {
    FakeBridge,
    built: [] as InstanceType<typeof FakeBridge>[],
    transport
  }
})

const clientState = vi.hoisted(() => ({
  destroy: vi.fn(),
  transportUp: true,
  sent: [] as Array<{ workflowId: string; ops: readonly { op_id: string }[] }>,
  sendOps: vi.fn(
    (workflowId: string, _tab: string, ops: readonly { op_id: string }[]) => {
      if (!clientState.transportUp) return false
      clientState.sent.push({ workflowId, ops })
      return true
    }
  )
}))

const projectionState = vi.hoisted(() => ({
  destroy: vi.fn(),
  notApplied: (): FrameOutcome => ({
    applied: false,
    nodes: { added: [], removed: [] }
  })
}))

vi.mock<unknown>(import('./layoutFollowerBridge'), () => ({
  LayoutFollowerBridge: class {
    constructor() {
      const bridge = new bridgeState.FakeBridge()
      bridgeState.built.push(bridge)
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

vi.mock<unknown>(import('./agentCrdtProjection'), () => ({
  AgentCrdtProjection: class {
    bind = vi.fn()
    unbind = vi.fn()
    applyFrame = vi.fn((): FrameOutcome => projectionState.notApplied())
    applyCollected = vi.fn((): FrameOutcome => projectionState.notApplied())
    retryFailed = vi.fn(() => null)
    hasPendingFailure = vi.fn(() => false)
    revertRejected = vi.fn((): FrameOutcome => projectionState.notApplied())
    replaceOnNextFrame = vi.fn()
    discardPending = vi.fn(() => ({ added: [], removed: [] }))
    noteLocalWrites = vi.fn()
    settleLocalWrites = vi.fn()
    destroy = projectionState.destroy
  }
}))

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { graph: null, canvas: null }
}))
vi.mock(
  import('@/workbench/extensions/agent/services/agent/agentEventSource'),
  {
    spy: true
  }
)
vi.mock(import('@/workbench/extensions/agent/services/agent/agentAuth'))

import { createFakeAgentSocket } from './__fixtures__/agentSocket'
import {
  destroyAgentFollowerSessions,
  heldAgentFollowerDocumentIds,
  retainAgentFollowerSessionsForPage,
  useAgentCrdtFollower
} from './useAgentCrdtFollower'
import type { AgentDocFrameTransport } from './agentDocFrameTransport'
import {
  destroyAgentPageSession,
  useAgentPageSession
} from '@/workbench/extensions/agent/agentPageSession'
import { createAgentEventSource } from '@/workbench/extensions/agent/services/agent/agentEventSource'

const DOC_A = 'a4b8c2d6-1e30-4f59-8b7a-2c9d0e5f1a63'
const DOC_B = 'b7e1f093-45ac-4d12-9e68-3f1a7c0d2b85'

function deleteNode(nodeId: string): GraphOperation {
  return { op: 'delete_node', node_id: nodeId, removed_links: [] }
}

function openPage(
  initial: string | null,
  transportOverride?: AgentDocFrameTransport
) {
  const transport = transportOverride ?? createFakeAgentSocket().transport
  const workflowId = ref<string | null>(initial)
  let enqueue: ((operations: GraphOperation[]) => void) | null = null

  const mountPanel = (bound: Ref<string | null> = workflowId) => {
    const host = defineComponent({
      setup() {
        const follower = useAgentCrdtFollower(bound, { transport })
        enqueue = follower.enqueueHumanOperations
        return () => null
      }
    })
    return render(host)
  }

  const panel = mountPanel()
  retainAgentFollowerSessionsForPage(transport)
  return {
    workflowId,
    panel,
    mountPanel,
    transport,
    enqueue: (operations: GraphOperation[]) => enqueue?.(operations)
  }
}

beforeEach(() => {
  useAgentPanelStore().enabled = true
  bridgeState.built = []
  bridgeState.transport.up = true
  clientState.transportUp = true
  clientState.sent = []
})

afterEach(() => {
  destroyAgentFollowerSessions()
})

describe('FRONT-3582 stage 1b: the document owns the follower session', () => {
  it('keeps the replica and the projection when the Agent panel unmounts', async () => {
    const page = openPage(DOC_A)
    await nextTick()
    expect(bridgeState.built).toHaveLength(1)
    expect(heldAgentFollowerDocumentIds()).toEqual([DOC_A])

    page.panel.unmount()
    await nextTick()

    expect(bridgeState.built[0].destroy).not.toHaveBeenCalled()
    expect(projectionState.destroy).not.toHaveBeenCalled()
    expect(clientState.destroy).not.toHaveBeenCalled()
    expect(bridgeState.built[0].subscribedWorkflowId).toBe(DOC_A)
    expect(heldAgentFollowerDocumentIds()).toEqual([DOC_A])
  })

  it('reopening the panel resumes the surviving session instead of minting one', async () => {
    const page = openPage(DOC_A)
    await nextTick()

    page.panel.unmount()
    await nextTick()
    const bindingNotYetRestored = ref<string | null>(null)
    const reopened = page.mountPanel(bindingNotYetRestored)
    await nextTick()

    expect(bridgeState.built).toHaveLength(1)
    expect(bridgeState.built[0].subscribedWorkflowId).toBe(DOC_A)
    reopened.unmount()
  })

  it('delivers an operation queued through a panel close once the transport recovers', async () => {
    const page = openPage(DOC_A)
    await nextTick()
    clientState.transportUp = false

    page.enqueue([deleteNode('queued-before-close')])
    await Promise.resolve()
    expect(clientState.sent).toHaveLength(0)

    page.panel.unmount()
    await nextTick()

    clientState.transportUp = true
    await vi.advanceTimersByTimeAsync(60_000)

    expect(
      clientState.sent.length,
      'the operation reached the transport instead of being drained as detached by the panel teardown'
    ).toBeGreaterThan(0)
    expect(clientState.sent[0]).toMatchObject({ workflowId: DOC_A })
    expect(clientState.sent[0].ops[0]).toMatchObject({
      op: 'delete_node',
      node_id: 'queued-before-close'
    })
  })

  it('keeps the session alive across a workflow switch', async () => {
    const page = openPage(DOC_A)
    await nextTick()

    page.workflowId.value = DOC_B
    await nextTick()

    expect(bridgeState.built).toHaveLength(1)
    expect(heldAgentFollowerDocumentIds()).toEqual([DOC_B])
    expect(bridgeState.built[0].destroy).not.toHaveBeenCalled()
  })

  it('mints one session when the page claims before the first panel binds', async () => {
    const transport = createFakeAgentSocket().transport
    retainAgentFollowerSessionsForPage(transport)
    const page = openPage(DOC_A, transport)
    await nextTick()

    expect(
      bridgeState.built,
      'the page claim re-entered the registry while it was still minting the session, so a second detached replica subscribed for the same document'
    ).toHaveLength(1)
    expect(heldAgentFollowerDocumentIds()).toEqual([DOC_A])

    page.panel.unmount()
    await nextTick()
    expect(bridgeState.built[0].destroy).not.toHaveBeenCalled()
  })

  it('disposes the session before yielding when the product gate is revoked', async () => {
    const page = openPage(DOC_A)
    await nextTick()

    useAgentPanelStore().enabled = false

    expect(
      bridgeState.built[0].destroy,
      'the revoked session was still alive before the tick, so something could read it after the gate closed'
    ).toHaveBeenCalled()
    expect(heldAgentFollowerDocumentIds()).toEqual([])

    await nextTick()
    expect(heldAgentFollowerDocumentIds()).toEqual([])
    page.panel.unmount()
  })

  it('gives a same-tick gate pulse a fresh session rather than the revoked one', async () => {
    const page = openPage(DOC_A)
    await nextTick()
    const revoked = bridgeState.built[0]

    useAgentPanelStore().enabled = false
    useAgentPanelStore().enabled = true
    await nextTick()

    expect(revoked.destroy).toHaveBeenCalled()
    expect(bridgeState.built).toHaveLength(2)
    expect(bridgeState.built[1].destroy).not.toHaveBeenCalled()
    expect(bridgeState.built[1].subscribedWorkflowId).toBe(DOC_A)
    expect(heldAgentFollowerDocumentIds()).toEqual([DOC_A])
    page.panel.unmount()
  })

  it('disposes the session when the page releases it', async () => {
    const agentSocket = createFakeAgentSocket()
    vi.mocked(createAgentEventSource).mockReturnValue(agentSocket.socket)
    const { docTransport } = useAgentPageSession(() => [null, null, null])

    openPage(DOC_A, docTransport)
    await nextTick()

    destroyAgentPageSession()

    expect(bridgeState.built[0].destroy).toHaveBeenCalled()
    expect(heldAgentFollowerDocumentIds()).toEqual([])
  })
})
