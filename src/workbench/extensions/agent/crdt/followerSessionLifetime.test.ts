import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { render } from '@testing-library/vue'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

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
  destroy: vi.fn()
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
    applyFrame = vi.fn(() => ({
      applied: false as const,
      nodes: { added: [], removed: [] }
    }))
    applyCollected = vi.fn(() => [])
    retryFailed = vi.fn(() => null)
    hasPendingFailure = vi.fn(() => false)
    revertRejected = vi.fn(() => [])
    replaceOnNextFrame = vi.fn()
    discardPending = vi.fn(() => ({ added: [], removed: [] }))
    noteLocalWrites = vi.fn()
    settleLocalWrites = vi.fn()
    destroy = projectionState.destroy
  }
}))

vi.mock(import('@/scripts/api'))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { graph: null, canvas: null }
}))

import { createFakeAgentSocket } from './__fixtures__/agentSocket'
import {
  destroyAgentFollowerSessions,
  heldAgentFollowerDocumentIds,
  retainAgentFollowerSessionsForPage,
  useAgentCrdtFollower
} from './useAgentCrdtFollower'

const DOC_A = 'a4b8c2d6-1e30-4f59-8b7a-2c9d0e5f1a63'
const DOC_B = 'b7e1f093-45ac-4d12-9e68-3f1a7c0d2b85'

function deleteNode(nodeId: string): GraphOperation {
  return { op: 'delete_node', node_id: nodeId, removed_links: [] }
}

/** One page: a single doc-frame transport, retained for the page lifetime. */
function openPage(initial: string | null) {
  const agentSocket = createFakeAgentSocket()
  const workflowId = ref<string | null>(initial)
  let enqueue: ((operations: GraphOperation[]) => void) | null = null

  const mountPanel = (bound: Ref<string | null> = workflowId) => {
    const host = defineComponent({
      setup() {
        const follower = useAgentCrdtFollower(bound, {
          transport: agentSocket.transport
        })
        enqueue = follower.enqueueHumanOperations
        return () => null
      }
    })
    return render(host)
  }

  const panel = mountPanel()
  retainAgentFollowerSessionsForPage(agentSocket.transport)
  return {
    workflowId,
    panel,
    mountPanel,
    transport: agentSocket.transport,
    enqueue: (operations: GraphOperation[]) => enqueue?.(operations)
  }
}

beforeEach(() => {
  useAgentPanelStore().enabled = true
  bridgeState.built = []
  bridgeState.transport.up = true
  clientState.transportUp = true
  clientState.sent = []
  clientState.destroy.mockClear()
  clientState.sendOps.mockClear()
  projectionState.destroy.mockClear()
  vi.useFakeTimers()
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
    // A freshly mounted panel has not restored its binding yet: its silence
    // must not read as an unbind of the document the last one bound.
    const reopened = page.mountPanel(ref<string | null>(null))
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

    // Resends after result silence are expected; what matters is that the
    // operation reached the transport at all instead of being drained as
    // `detached` by the panel teardown (CRDT-REPLAY-0039).
    expect(clientState.sent.length).toBeGreaterThan(0)
    expect(clientState.sent[0]).toMatchObject({ workflowId: DOC_A })
    expect(clientState.sent[0].ops[0]).toMatchObject({
      op: 'delete_node',
      node_id: 'queued-before-close'
    })
  })

  it('carries an unsent operation across a workflow switch rather than disposing', async () => {
    const page = openPage(DOC_A)
    await nextTick()

    page.workflowId.value = DOC_B
    await nextTick()

    expect(bridgeState.built).toHaveLength(1)
    expect(heldAgentFollowerDocumentIds()).toEqual([DOC_B])
    expect(bridgeState.built[0].destroy).not.toHaveBeenCalled()
  })

  it('disposes the session when the product gate is revoked', async () => {
    const page = openPage(DOC_A)
    await nextTick()

    useAgentPanelStore().enabled = false
    await nextTick()

    expect(bridgeState.built[0].destroy).toHaveBeenCalled()
    expect(heldAgentFollowerDocumentIds()).toEqual([])
    page.panel.unmount()
  })

  it('disposes the session when the page releases it', async () => {
    openPage(DOC_A)
    await nextTick()

    destroyAgentFollowerSessions()

    expect(bridgeState.built[0].destroy).toHaveBeenCalled()
    expect(heldAgentFollowerDocumentIds()).toEqual([])
  })
})
