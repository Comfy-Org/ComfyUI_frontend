import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  AGENT_NODE_IDS,
  addLoadImageNode
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'

/**
 * "The agent reports the workflow is built and the canvas stays empty" --
 * `qa/user-story-test-matrix.md` rank 2 in the in-app-agent program repo, the
 * single largest theme in the mined Slack corpus, reached here through the
 * mechanism `regr-17` names: the doc host REFUSES the follower's
 * `doc_subscribe` (`doc_subscribed {ok:false}`, the shape
 * `services/agent/server/events_doc_frames.go` sends when its doc service is
 * nil, when it is overloaded, or at the per-session document cap), while the
 * chat half of the same socket keeps working, so the turn still reports
 * success.
 *
 * A refusal is not the same failure as the one
 * `agentGraphOpLostOnDisconnect.spec.ts` pins. There the subscribe is
 * SWALLOWED, and `agentCrdtDocLifecycle`'s ack timeout is what notices the
 * silence and retries. A refusal is answered, so no ack timeout ever fires;
 * the separate refusal ladder handles it, and that ladder had no browser-level
 * coverage before this file -- `AgentFollowerHostSocket.refuseSubscribes` was
 * written for it and had no callers.
 *
 * It is also not the failure `agentCanvasLagsToolCallCompletion.spec.ts` pins.
 * There the host is healthy and merely slow, the follower IS subscribed, and
 * the canvas-sync gate that spec added holds the tool row's spinner until the
 * update lands. That gate is conditioned on `crdtStatus.connected`, which a
 * refusal never sets -- so the one affordance the product has for "your canvas
 * has not caught up" is off in exactly the case where it never will. The
 * second test below pins that.
 *
 * Both tests assert the canvas and the panel only, never the doc projection,
 * so they survive the graph-API remote-apply pivot (FE #18700).
 */
test.describe(
  'Agent doc subscribe refused by the host',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('rides out a transient refusal and still lands the edit the agent reported', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      // Two refusals, then the host recovers: the retry ladder's own first two
      // rungs (`SUBSCRIBE_RETRY_BASE_MS` at 500 ms, doubling) cover this
      // without reaching its six-attempt budget.
      agent.refuseDocSubscribes(2)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('add a load image node')
      await agent.hostSocket.waitForSubscribe()

      const [nodeId] = AGENT_NODE_IDS
      // The op is recorded authoritatively while the follower is still being
      // turned away -- the agent's tool genuinely succeeded server-side.
      agent.applyOnHost([addLoadImageNode(nodeId, 0)])
      expect(agent.hostNodeIds()).toContain(String(nodeId))
      agent.reportToolCall('add_node', 'call-add-one')
      agent.finishTurn('Added a Load Image node.')

      // The refusal is what the follower has to survive: the node reaches the
      // canvas through the catch-up of a LATER subscribe, with no doc_update
      // broadcast of its own ever being sent for it.
      await expect(agent.node(nodeId)).toBeVisible({ timeout: 30_000 })
      expect(
        agent.hostSocket.refusedSubscribeCount(),
        'the host never actually refused, so this asserts nothing'
      ).toBe(2)
    })

    test('reports a canvas edit as succeeded when the document never arrived', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      agent.refuseDocSubscribes()
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('add a load image node')
      await agent.hostSocket.waitForSubscribe()

      const before = await agent.settledCanvasNodeIds()
      const [nodeId] = AGENT_NODE_IDS
      agent.applyOnHost([addLoadImageNode(nodeId, 0)])
      agent.reportToolCall('add_node', 'call-add-one')
      agent.finishTurn('Added a Load Image node.')

      await agent.expectTurnReportedFinished()
      await expect(
        agent.panel.getByText('Added a Load Image node.').first()
      ).toBeVisible()

      // The canvas the user is looking at never changes: every subscribe is
      // turned away, so no catch-up frame ever carries the op the agent
      // applied, and the node it reported adding is nowhere on screen.
      await expect(agent.node(nodeId)).toHaveCount(0)
      expect(await agent.settledCanvasNodeIds()).toEqual(before)

      await agent.openWorkSummary()
      const addNodeRow = agent.toolRow('Add node')
      await expect(addNodeRow).toBeVisible()

      // The product has exactly one affordance for "this edit has not reached
      // your canvas yet": `AgentPanelRoot.vue`'s `shouldAwaitCanvasSync` gate,
      // which holds a canvas-mutating tool call's row on its spinner until an
      // applied-op count rises. That gate is conditioned on
      // `crdtStatus.connected`, which only a `doc_subscribed { ok: true }`
      // frame ever sets -- so it is switched OFF in exactly the case where the
      // canvas will never catch up. The row therefore never spins at all here:
      // it settles straight into its terminal state.
      await expect(agent.streamingGlyph(addNodeRow)).toHaveCount(0)

      // Expected failure: that terminal state must not read as a plain
      // success while the canvas has nothing to show for the call.
      // `agentToolGlyph.ts` already renders `circle-x` for a failed call, so a
      // fix has a rendering to reach for; this asserts the absence of the
      // success glyph rather than the presence of any particular replacement,
      // so it does not prescribe which one.
      test.fail()
      await expect(agent.settledSuccessGlyph(addNodeRow)).toHaveCount(0)
    })
  }
)
