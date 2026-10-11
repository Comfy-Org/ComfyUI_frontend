import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  AGENT_NODE_IDS,
  addLoadImageNode
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'

test.describe(
  'Agent doc subscribe refused by the host',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('rides out a transient refusal and still lands the edit the agent reported', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      agent.refuseDocSubscribes(2)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('add a load image node')
      await agent.hostSocket.waitForSubscribe()

      const [nodeId] = AGENT_NODE_IDS
      agent.applyOnHost([addLoadImageNode(nodeId, 0)])
      expect(agent.hostNodeIds()).toContain(String(nodeId))
      agent.reportToolCall('add_node', 'call-add-one')
      agent.finishTurn('Added a Load Image node.')

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

      await expect(agent.node(nodeId)).toHaveCount(0)
      expect(await agent.settledCanvasNodeIds()).toEqual(before)

      await agent.openWorkSummary()
      const addNodeRow = agent.toolRow('Add node')
      await expect(addNodeRow).toBeVisible()

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
