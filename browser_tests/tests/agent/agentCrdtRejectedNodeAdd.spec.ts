import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const DOC_PROTOCOL_VERSION = 1

interface WireFrame {
  type: string
  data: Record<string, unknown>
}

function installCrdtHostDouble(ws: WebSocketRoute): {
  subscribed: Promise<void>
  rejectedOpId: Promise<string>
} {
  let resolveSubscribed!: () => void
  let resolveRejected!: (opId: string) => void
  const subscribed = new Promise<void>((resolve) => {
    resolveSubscribed = resolve
  })
  const rejectedOpId = new Promise<string>((resolve) => {
    resolveRejected = resolve
  })

  ws.onMessage((raw) => {
    const message = JSON.parse(String(raw)) as WireFrame
    const workflowId = message.data.workflow_id

    if (message.type === 'doc_subscribe') {
      ws.send(
        JSON.stringify({
          type: 'doc_subscribed',
          data: {
            v: DOC_PROTOCOL_VERSION,
            workflow_id: workflowId,
            ok: true,
            seq: 0
          }
        })
      )
      resolveSubscribed()
      return
    }

    if (message.type === 'doc_ops') {
      const ops = message.data.ops as { op_id: string; op: string }[]
      const index = ops.findIndex((op) => op.op === 'add_node')
      if (index === -1) return
      const opId = ops[index].op_id
      ws.send(
        JSON.stringify({
          type: 'doc_ops_result',
          data: {
            v: DOC_PROTOCOL_VERSION,
            workflow_id: workflowId,
            ok: false,
            applied: [],
            skipped: [],
            failed: {
              index,
              op_id: opId,
              code: 'invalid_node_payload',
              message: "node carries the reserved key '__incarnation'"
            }
          }
        })
      )
      resolveRejected(opId)
    }
  })

  return { subscribed, rejectedOpId }
}

test.describe(
  'a human-added node the CRDT host rejects',
  { tag: ['@cloud', '@canvas', '@node'] },
  () => {
    // LiteGraph.createNode returns null unless the type is registered.
    test.use({ objectInfo: 'server', connectWebSocketToServer: false })

    test('is removed from the canvas', async ({
      agentPanel,
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { subscribed, rejectedOpId } = installCrdtHostDouble(ws)

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      const panel = agentPanel.root
      const firstPrompt = enMessages.agent.suggestedPrompts[0]
      await panel.getByRole('button', { name: firstPrompt }).click()
      await panel.getByRole('button', { name: 'Send' }).click()
      await subscribed
      // Closing the panel unmounts the follower and unbinds the document.
      const added = await comfyPage.nodeOps.addNode('LoadImage')
      expect(added.id).toBeDefined()
      await comfyPage.nextFrame()

      let rejected: string | undefined
      void rejectedOpId.then((opId) => {
        rejected = opId
      })
      // The synchronous rejection can remove the node before it is observable.
      await expect.poll(() => rejected, { timeout: 30_000 }).toBeDefined()

      await expect
        .poll(
          async () =>
            (await comfyPage.nodeOps.getNodeRefsByType('LoadImage')).length
        )
        .toBe(0)
    })
  }
)
