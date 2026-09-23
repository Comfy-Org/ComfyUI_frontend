import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import type { Page, WebSocketRoute } from '@playwright/test'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

const WORKFLOW_ID = 'wf-1'

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
      _url: string | RegExp,
      handler: (route: WebSocketRoute) => unknown
    ) => {
      handler(socket)
    }
  })
  return {
    page,
    emitClientFrame: (frame: unknown) => onMessage?.(JSON.stringify(frame)),
    sentFrames: () => [...sentFrames]
  }
}

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
      'sid-1',
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
      'sid-1',
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
    expect(sentFrames().slice(1)).toEqual([
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
        'sid-1',
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
