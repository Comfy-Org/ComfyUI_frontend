/**
 * Regression pin for PM-1143 / PM-1142: a human-authored `add_node` the CRDT
 * host rejects never leaves the canvas. `layoutMintPort.ts` mints the wire op
 * AFTER the node is already live via the normal LiteGraph flow, and
 * `useAgentCrdtFollower.ts` only forwards a rejection to the dev panel
 * (`recordDevEvent`) - nothing removes the node or tells the user. This test
 * drives the real transport (a mocked `/ws`), the real mint ports, and the
 * real canvas: it binds the CRDT doc through an actual agent turn, adds a
 * node the way a person would (double-click search), rejects that node's
 * `doc_ops` frame the way the reported host failure did
 * (`invalid_node_payload`), and proves the "ghost" node is still selectable
 * on canvas. See `src/workbench/extensions/agent/crdt/rejectedHumanAddNodeRevert.test.ts`
 * for the equivalent proof against the composable wiring directly.
 */
import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const DOC_PROTOCOL_VERSION = 1

interface WireFrame {
  type: string
  data: Record<string, unknown>
}

/** Replies to `doc_subscribe` and rejects the first `add_node` it sees. */
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
      // Mirrors the reported host rejection verbatim: the reserved
      // `__incarnation` bookkeeping key leaked into the outgoing payload.
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
  'a human-added node the CRDT host rejects (PM-1143)',
  { tag: ['@cloud', '@canvas', '@node'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('stays on the canvas instead of being removed', async ({
      comfyPage,
      getWebSocket
    }, testInfo) => {
      test.setTimeout(30_000)
      await comfyPage.settings.setSetting(
        'Comfy.NodeSearchBoxImpl',
        'v1 (legacy)'
      )

      const page = comfyPage.page
      const ws = await getWebSocket()
      const { subscribed, rejectedOpId } = installCrdtHostDouble(ws)

      // Bind the CRDT doc to the active tab through a real agent turn - the
      // production path (AgentPanelRoot.vue's onWorkflowAdopted) that gates
      // layoutMintPort's isDocBound().
      const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
      await openButton.click()
      const panel = page.locator('#agent-panel-root')
      await expect(panel).toBeVisible()
      const firstPrompt = enMessages.agent.suggestedPrompts[0]
      await panel.getByRole('button', { name: firstPrompt }).click()
      await panel.getByRole('button', { name: 'Send' }).click()
      await subscribed
      await openButton.click()
      await expect(panel).toBeHidden()

      // A person adds a node the ordinary way: double-click search, pick it.
      await comfyPage.canvasOps.doubleClick()
      await comfyPage.searchBox.fillAndSelectFirstNode('Load Image', {
        exact: true
      })
      await comfyPage.nextFrame()
      await expect
        .poll(
          async () =>
            (await comfyPage.nodeOps.getNodeRefsByType('LoadImage')).length
        )
        .toBe(1)

      // The host rejects the sync; the mock above already replied.
      await rejectedOpId

      // Current (buggy) behavior, captured as visual proof: the "ghost" node
      // the host never accepted is still on the canvas, selectable like any
      // other node.
      const ghostNodes = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      expect(ghostNodes).toHaveLength(1)
      await ghostNodes[0].click('title')
      await comfyPage.nextFrame()
      await testInfo.attach('rejected-add-node-ghost-remains.png', {
        body: await comfyPage.page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      })

      test.fail(
        true,
        'PM-1143: layoutMintPort/opSender/pendingOpTracker compute the ' +
          'rejection but nothing removes the node - useAgentCrdtFollower ' +
          "only logs it to the dev panel (recordDevEvent('pending_ops', ...))."
      )

      // Desired behavior: the node the host never accepted is gone.
      await expect
        .poll(
          async () =>
            (await comfyPage.nodeOps.getNodeRefsByType('LoadImage')).length
        )
        .toBe(0)
    })
  }
)
