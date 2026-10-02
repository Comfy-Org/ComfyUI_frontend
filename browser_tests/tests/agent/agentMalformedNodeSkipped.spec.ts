import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  AGENT_NODE_IDS,
  addLoadImageNode,
  addMalformedSlotNode
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'

/**
 * The user-visible half of PM-1913: a node the agent reports adding, and that
 * the shared document really holds, never appears on the canvas because its
 * input slot fails the follower's read-time schema. The report this spec's
 * sibling unit cases pin (`liveGraphApplier.malformedNode.test.ts`) is what
 * makes that gap attributable; this is the gap itself, from the user's side.
 *
 * It is deliberately NOT a pin on normalizing or rejecting the slot. Which of
 * those is right depends on evidence production could not previously produce,
 * so fail-closed-and-report is the behaviour under test.
 */
test.describe(
  'Agent remote apply skips a malformed document node',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('a node whose input slot has no type stays off the canvas while the rest of the batch lands', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('add 2 load image nodes')
      await agent.hostSocket.waitForSubscribe()

      const before = await agent.settledCanvasNodeIds()
      const [wellFormed, malformed] = AGENT_NODE_IDS

      agent.reportToolCall('add_node', 'call-add-two')
      agent.applyAndBroadcast([
        addLoadImageNode(wellFormed, 0),
        addMalformedSlotNode(malformed, 1)
      ])
      agent.finishTurn('Added two Load Image nodes.')

      await agent.expectTurnReportedFinished()

      await expect(agent.node(wellFormed)).toBeVisible()
      await expect(agent.node(malformed)).toHaveCount(0)
      await expect
        .poll(() => agent.settledCanvasNodeIds())
        .toEqual([...before, String(wellFormed)].sort())

      // The document holds the node the canvas does not. That divergence is
      // the failure, and it is silent to the user.
      expect(agent.hostNodeIds()).toContain(String(malformed))
    })
  }
)
