/**
 * Regression pin (ADR-CRDT-PENDING-0030): a human-authored `add_node` the
 * CRDT host rejects must leave the canvas. `layoutMintPort.ts` mints the wire
 * op AFTER the node is already live via the normal LiteGraph flow, and on
 * rejection `useAgentCrdtFollower.ts` feeds the tracker's `reverted` event to
 * `applyPendingOpRevert`, which removes the node. This test drives the real
 * transport (a mocked `/ws`), the real mint ports, and the real canvas: it
 * binds the CRDT doc through an actual agent turn, adds a node as a local
 * human edit (the `nodeOps.addNode` fixture drives `graph.add`, whose
 * actor-less layout operation the store stamps with this session's human
 * actor, the same mint path as UI insertion), rejects that node's `doc_ops`
 * frame the way the reported host failure did (`invalid_node_payload`), and
 * proves the node the host never accepted is removed. See
 * `src/workbench/extensions/agent/crdt/rejectedHumanAddNodeRevert.test.ts`
 * for the equivalent proof against the composable wiring directly.
 */
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
  'a human-added node the CRDT host rejects',
  { tag: ['@cloud', '@canvas', '@node'] },
  () => {
    // Real node definitions: the agent boot mocks stub object_info to {} by
    // default, and LiteGraph.createNode returns null for an unregistered type.
    test.use({ objectInfo: 'server', connectWebSocketToServer: false })

    test('is removed from the canvas', async ({
      agentPanel,
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { subscribed, rejectedOpId } = installCrdtHostDouble(ws)

      // Bind the CRDT doc to the active tab through a real agent turn - the
      // production path (AgentPanelRoot.vue's onWorkflowAdopted) that gates
      // layoutMintPort's isDocBound(). The turn targets a workflow only after
      // one is picked, so select the active tab first.
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      const panel = agentPanel.root
      const firstPrompt = enMessages.agent.suggestedPrompts[0]
      await panel.getByRole('button', { name: firstPrompt }).click()
      await panel.getByRole('button', { name: 'Send' }).click()
      await subscribed
      // The panel stays open: closing it unmounts AgentPanelRoot, which
      // disposes the follower and unbinds the doc, so nothing would mint.

      // A local human edit: the fixture's graph.add lands an actor-less
      // createNode that the layout store stamps with this session's human
      // actor, so layoutMintPort mints the same add_node op as UI insertion.
      // (The cloud project has no working double-click search flow to drive.)
      const added = await comfyPage.nodeOps.addNode('LoadImage')
      expect(added.id).toBeDefined()
      await comfyPage.nextFrame()

      // The host double replies to the add_node frame synchronously, so the
      // revert can land within milliseconds of the add: the transient
      // one-node canvas is not reliably observable. The round-trip is pinned
      // instead - the op id proves the minted add_node reached the host, and
      // the poll surfaces this step by name if the frame never arrives.
      let rejected: string | undefined
      void rejectedOpId.then((opId) => {
        rejected = opId
      })
      await expect.poll(() => rejected, { timeout: 30_000 }).toBeDefined()

      // The node the host never accepted is removed.
      await expect
        .poll(
          async () =>
            (await comfyPage.nodeOps.getNodeRefsByType('LoadImage')).length
        )
        .toBe(0)
    })
  }
)
