import { fromPartial } from '@total-typescript/shoehorn'
import type { Page, WebSocketRoute } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import type { HumanOpsHost } from '@e2e/fixtures/agentFollowerHostSocket'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'

const WORKFLOW_ID = 'wf-1'
const AGENT_EVENTS_URL = 'ws://127.0.0.1:8188/api/agent/events?token=abc'

// A fake `Page` whose `routeWebSocket` hands back a fake `WebSocketRoute`
// synchronously, so `AgentFollowerHostSocket` runs against the real class
// under test with only the Playwright transport swapped out.
function fakeRoutedPage(): {
  page: Page
  emitClientFrame: (frame: unknown) => void
  sentFrames: () => Array<{ type: string; data: Record<string, unknown> }>
} {
  let onMessage: ((raw: string | Buffer) => void) | null = null
  const sentFrames: Array<{ type: string; data: Record<string, unknown> }> = []
  const socket = fromPartial<WebSocketRoute>({
    onMessage: (handler: (raw: string | Buffer) => void) => {
      onMessage = handler
    },
    send: (raw: string) => {
      sentFrames.push(JSON.parse(raw))
    }
  })
  const page = fromPartial<Page>({
    routeWebSocket: async (
      url: string | RegExp,
      handler: (route: WebSocketRoute) => unknown
    ) => {
      if (url instanceof RegExp && url.test(AGENT_EVENTS_URL)) handler(socket)
      else handler(fromPartial<WebSocketRoute>({ send: () => {} }))
    }
  })
  return {
    page,
    emitClientFrame: (frame: unknown) => onMessage?.(JSON.stringify(frame)),
    sentFrames: () => [...sentFrames]
  }
}

async function installHost(mode: HumanOpsHost = 'apply') {
  const host = new HostDoc(WORKFLOW_ID, { nodes: [], links: [] }, { types: {} })
  const { page, emitClientFrame, sentFrames } = fakeRoutedPage()
  const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host, mode)
  await hostSocket.install()
  return { host, hostSocket, emitClientFrame, sentFrames }
}

describe('AgentFollowerHostSocket transport', () => {
  it('answers a doc_subscribe with doc_subscribed and a catch-up doc_update', async () => {
    const host = new HostDoc(
      WORKFLOW_ID,
      { nodes: [], links: [] },
      { types: {} }
    )
    const { page, emitClientFrame, sentFrames } = fakeRoutedPage()
    const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)
    await hostSocket.install()

    emitClientFrame({
      type: 'doc_subscribe',
      data: { workflow_id: WORKFLOW_ID, state_vector_b64: 'AA==' }
    })

    expect(sentFrames().map((frame) => frame.type)).toEqual([
      'doc_subscribed',
      'doc_update'
    ])
    expect(hostSocket.subscribeCount()).toBe(1)
  })
})

describe('AgentFollowerHostSocket subscribe counts', () => {
  it('counts a refused subscribe only as refused, then the accepted retry as a subscribe', async () => {
    const host = new HostDoc(
      WORKFLOW_ID,
      { nodes: [], links: [] },
      { types: {} }
    )
    const { page, emitClientFrame, sentFrames } = fakeRoutedPage()
    const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)
    await hostSocket.install()
    hostSocket.refuseSubscribes('overloaded', 1)
    const subscribe = {
      type: 'doc_subscribe',
      data: { workflow_id: WORKFLOW_ID, state_vector_b64: 'AA==' }
    }

    emitClientFrame(subscribe)

    expect(sentFrames().map((frame) => frame.type)).toEqual(['doc_subscribed'])
    expect(hostSocket.refusedSubscribeCount()).toBe(1)
    expect(hostSocket.subscribeCount()).toBe(0)

    emitClientFrame(subscribe)

    expect(hostSocket.refusedSubscribeCount()).toBe(1)
    expect(hostSocket.subscribeCount()).toBe(1)
  })
})

describe('AgentFollowerHostSocket human doc_ops handling', () => {
  it('answers a malformed doc_ops batch with ok:false and never reaches the applier', async () => {
    const { hostSocket, emitClientFrame, sentFrames } = await installHost()

    emitClientFrame({
      type: 'doc_ops',
      data: {
        workflow_id: WORKFLOW_ID,
        tab: 'tab-1',
        ops: [{ op: 'add_node' }]
      }
    })

    expect(hostSocket.humanOpOutcomes()).toEqual([])
    expect(sentFrames().at(-1)).toEqual({
      type: 'doc_ops_result',
      data: expect.objectContaining({
        ok: false,
        code: 'invalid_frame'
      })
    })
  })

  it('still applies a well-formed doc_ops batch through the real applier', async () => {
    const { hostSocket, emitClientFrame, sentFrames } = await installHost()

    emitClientFrame({
      type: 'doc_ops',
      data: {
        workflow_id: WORKFLOW_ID,
        tab: 'tab-1',
        ops: [
          {
            op: 'add_node',
            op_id: 'a'.repeat(32),
            actor: 'human:test-user:tab-1',
            base_version: 1,
            stamp: [1, 'human:test-user:tab-1'],
            node_id: 1,
            class_type: 'TestNode',
            pos: [10, 20],
            node: { id: 1, type: 'TestNode', pos: [10, 20] }
          }
        ]
      }
    })

    expect(hostSocket.humanOpOutcomes()).toEqual([
      { op_id: 'a'.repeat(32), outcome: 'applied' }
    ])
    expect(sentFrames()).toEqual([
      {
        type: 'doc_ops_result',
        data: expect.objectContaining({ ok: true })
      },
      { type: 'doc_update', data: expect.objectContaining({}) }
    ])
  })

  const validOp = (opId: string, nodeId: number): Record<string, unknown> => ({
    op: 'add_node',
    op_id: opId,
    actor: 'human:test-user:tab-1',
    base_version: 1,
    stamp: [1, 'human:test-user:tab-1'],
    node_id: nodeId,
    class_type: 'TestNode',
    pos: [10, 20],
    node: { id: nodeId, type: 'TestNode', pos: [10, 20] }
  })

  it.for([
    {
      label: 'a missing tab',
      tab: undefined,
      actor: 'human:test-user:tab-1',
      stampActor: 'human:test-user:tab-1',
      code: 'invalid_frame'
    },
    {
      label: 'an actor minted for another tab',
      tab: 'tab-2',
      actor: 'human:test-user:tab-1',
      stampActor: 'human:test-user:tab-1',
      code: 'forbidden'
    },
    {
      label: 'a stamp minted for another user',
      tab: 'tab-1',
      actor: 'human:test-user:tab-1',
      stampActor: 'human:other-user:tab-1',
      code: 'forbidden'
    },
    {
      label: 'a stamp minted for another tab',
      tab: 'tab-1',
      actor: 'human:test-user:tab-1',
      stampActor: 'human:test-user:tab-2',
      code: 'forbidden'
    }
  ])(
    'refuses a doc_ops batch with $label before applyWire runs',
    async ({ tab, actor, stampActor, code }) => {
      const { host, hostSocket, emitClientFrame, sentFrames } =
        await installHost()

      emitClientFrame({
        type: 'doc_ops',
        data: {
          workflow_id: WORKFLOW_ID,
          tab,
          ops: [
            { ...validOp('a'.repeat(32), 1), actor, stamp: [1, stampActor] }
          ]
        }
      })

      expect(hostSocket.humanOpOutcomes()).toEqual([])
      expect(Object.keys(host.graph().nodes)).toEqual([])
      expect(sentFrames().at(-1)).toEqual({
        type: 'doc_ops_result',
        data: expect.objectContaining({ ok: false, code })
      })
    }
  )

  it('refuses a batch whose ops name two writers', async () => {
    const { hostSocket, emitClientFrame, sentFrames } = await installHost()
    const otherWriter = 'human:other-user:tab-1'

    emitClientFrame({
      type: 'doc_ops',
      data: {
        workflow_id: WORKFLOW_ID,
        tab: 'tab-1',
        ops: [
          validOp('a'.repeat(32), 1),
          {
            ...validOp('b'.repeat(32), 2),
            actor: otherWriter,
            stamp: [1, otherWriter]
          }
        ]
      }
    })

    expect(hostSocket.humanOpOutcomes()).toEqual([])
    expect(sentFrames().at(-1)).toEqual({
      type: 'doc_ops_result',
      data: expect.objectContaining({ ok: false, code: 'forbidden' })
    })
  })

  it('refuses a held batch for another tab when it is released', async () => {
    const { hostSocket, emitClientFrame, sentFrames } =
      await installHost('hold')
    emitClientFrame({
      type: 'doc_ops',
      data: {
        workflow_id: WORKFLOW_ID,
        tab: 'tab-2',
        ops: [validOp('a'.repeat(32), 1)]
      }
    })

    hostSocket.releaseHeldClientOps()

    expect(hostSocket.humanOpOutcomes()).toEqual([])
    expect(sentFrames().at(-1)).toEqual({
      type: 'doc_ops_result',
      data: expect.objectContaining({ ok: false, code: 'forbidden' })
    })
  })

  it('spends an unanswered slot only on a batch it would accept', async () => {
    const { hostSocket, emitClientFrame, sentFrames } = await installHost()
    hostSocket.leaveHumanBatchesUnanswered(1)
    const ops = [validOp('a'.repeat(32), 1)]

    emitClientFrame({
      type: 'doc_ops',
      data: { workflow_id: WORKFLOW_ID, tab: 'tab-2', ops }
    })
    emitClientFrame({
      type: 'doc_ops',
      data: { workflow_id: WORKFLOW_ID, tab: 'tab-1', ops }
    })

    expect(sentFrames()).toEqual([
      {
        type: 'doc_ops_result',
        data: expect.objectContaining({ ok: false, code: 'forbidden' })
      }
    ])
    expect(hostSocket.humanOpOutcomes()).toEqual([])
  })

  it('leaves a dropped batch unanswered and judges its resend', async () => {
    const { hostSocket, emitClientFrame, sentFrames } = await installHost()
    hostSocket.leaveHumanBatchesUnanswered(1)
    const frame = {
      type: 'doc_ops',
      data: {
        workflow_id: WORKFLOW_ID,
        tab: 'tab-1',
        ops: [validOp('a'.repeat(32), 1)]
      }
    }

    emitClientFrame(frame)

    expect(sentFrames()).toEqual([])
    expect(hostSocket.clientDocFrames()).toHaveLength(1)

    emitClientFrame(frame)

    expect(hostSocket.humanOpOutcomes()).toEqual([
      { op_id: 'a'.repeat(32), outcome: 'applied' }
    ])
  })

  it.for([
    { label: 'an omitted ops field', ops: undefined },
    { label: 'an empty ops batch', ops: [] },
    {
      label: 'a duplicate op_id within the batch',
      ops: [validOp('a'.repeat(32), 1), validOp('a'.repeat(32), 2)]
    }
  ])(
    'rejects a doc_ops frame with $label as invalid_frame before applyWire runs',
    async ({ ops }) => {
      const { hostSocket, emitClientFrame, sentFrames } = await installHost()

      emitClientFrame({
        type: 'doc_ops',
        data: { workflow_id: WORKFLOW_ID, tab: 'tab-1', ops }
      })

      expect(hostSocket.humanOpOutcomes()).toEqual([])
      expect(sentFrames().at(-1)).toEqual({
        type: 'doc_ops_result',
        data: expect.objectContaining({
          ok: false,
          code: 'invalid_frame'
        })
      })
    }
  )
})
