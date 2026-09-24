import { fromPartial } from '@total-typescript/shoehorn'
import type { Page, WebSocketRoute } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'

const WORKFLOW_ID = 'wf-1'
const AGENT_EVENTS_URL = 'ws://127.0.0.1:8188/api/agent/events?token=abc'
const COMFY_WS_URL = 'ws://127.0.0.1:8188/ws?clientId=1'

// A fake `Page` whose `routeWebSocket` hands back a fake `WebSocketRoute`
// synchronously, so `AgentFollowerHostSocket` runs against the real class
// under test with only the Playwright transport swapped out.
function fakeRoutedPage(): {
  page: Page
  emitClientFrame: (frame: unknown) => void
  sentFrames: () => Array<{ type: string; data: Record<string, unknown> }>
  routedUrls: () => Array<string | RegExp>
} {
  const routedUrls: Array<string | RegExp> = []
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
      routedUrls.push(url)
      // Only the agent socket is under test; the quiet `/ws` stub gets a
      // socket of its own so its status frame is not mixed in.
      if (url instanceof RegExp && url.test(AGENT_EVENTS_URL)) handler(socket)
      else handler(fromPartial<WebSocketRoute>({ send: () => {} }))
    }
  })
  return {
    page,
    emitClientFrame: (frame: unknown) => onMessage?.(JSON.stringify(frame)),
    sentFrames: () => [...sentFrames],
    routedUrls: () => [...routedUrls]
  }
}

describe('AgentFollowerHostSocket transport', () => {
  it('serves agent frames on the agent socket and sends nothing there on open', async () => {
    const host = new HostDoc(
      WORKFLOW_ID,
      { nodes: [], links: [] },
      { types: {} }
    )
    const { page, sentFrames, routedUrls } = fakeRoutedPage()
    await new AgentFollowerHostSocket(page, WORKFLOW_ID, host).install()

    const patterns = routedUrls().filter(
      (url): url is RegExp => url instanceof RegExp
    )
    const agent = patterns.filter((url) => url.test(AGENT_EVENTS_URL))
    expect(agent).toHaveLength(1)
    expect(agent[0].test('ws://127.0.0.1:8188/api/agent/events')).toBe(true)
    expect(agent[0].test(COMFY_WS_URL)).toBe(false)
    // ComfyUI's /ws is stubbed by a separate route, never the agent one.
    expect(patterns.some((url) => url.test(COMFY_WS_URL))).toBe(true)
    expect(sentFrames()).toEqual([])
  })

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

describe('AgentFollowerHostSocket human doc_ops handling', () => {
  it('answers a malformed doc_ops batch with ok:false and never reaches the applier', async () => {
    const host = new HostDoc(
      WORKFLOW_ID,
      { nodes: [], links: [] },
      { types: {} }
    )
    const { page, emitClientFrame, sentFrames } = fakeRoutedPage()
    const hostSocket = new AgentFollowerHostSocket(
      page,
      WORKFLOW_ID,
      host,
      'apply'
    )
    await hostSocket.install()

    emitClientFrame({
      type: 'doc_ops',
      data: {
        workflow_id: WORKFLOW_ID,
        // Missing `op_id`: fails the envelope check `parseWireOps` runs.
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
    const host = new HostDoc(
      WORKFLOW_ID,
      { nodes: [], links: [] },
      { types: {} }
    )
    const { page, emitClientFrame, sentFrames } = fakeRoutedPage()
    const hostSocket = new AgentFollowerHostSocket(
      page,
      WORKFLOW_ID,
      host,
      'apply'
    )
    await hostSocket.install()

    emitClientFrame({
      type: 'doc_ops',
      data: {
        workflow_id: WORKFLOW_ID,
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
    { label: 'an omitted ops field', ops: undefined },
    { label: 'an empty ops batch', ops: [] },
    {
      label: 'a duplicate op_id within the batch',
      ops: [validOp('a'.repeat(32), 1), validOp('a'.repeat(32), 2)]
    }
  ])(
    'rejects a doc_ops frame with $label as invalid_frame before applyWire runs',
    async ({ ops }) => {
      const host = new HostDoc(
        WORKFLOW_ID,
        { nodes: [], links: [] },
        { types: {} }
      )
      const { page, emitClientFrame, sentFrames } = fakeRoutedPage()
      const hostSocket = new AgentFollowerHostSocket(
        page,
        WORKFLOW_ID,
        host,
        'apply'
      )
      await hostSocket.install()

      emitClientFrame({
        type: 'doc_ops',
        data: { workflow_id: WORKFLOW_ID, ops }
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
