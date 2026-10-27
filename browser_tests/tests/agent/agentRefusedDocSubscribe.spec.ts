import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  AGENT_NODE_IDS,
  addLoadImageNode
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'

const exhaustedRetryTest = test.extend<{
  exhaustedRetryAgent: AgentRemoteApplyHarness
}>({
  exhaustedRetryAgent: async ({ page }, use) => {
    const agent = new AgentRemoteApplyHarness(page)
    agent.refuseDocSubscribes('overloaded', 7)
    await agent.setUp()
    await use(agent)
  }
})

test.describe(
  'Agent doc subscribe refused by the host',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('rides out a transient refusal and still lands the edit the agent reported', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      agent.refuseDocSubscribes('overloaded', 2)
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

    test('reports a canvas edit as unconfirmed when the document never arrived', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      agent.refuseDocSubscribes('unsupported')
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
      await expect(agent.workSummary).toContainText(
        enMessages.agent.workedNotConfirmedOnCanvas
      )

      await expect(agent.node(nodeId)).toHaveCount(0)
      expect(await agent.settledCanvasNodeIds()).toEqual(before)

      await agent.openWorkSummary()
      const addNodeRow = agent.toolRow('Add node')
      await expect(addNodeRow).toBeVisible()

      await expect(agent.streamingGlyph(addNodeRow)).toHaveCount(0)
      await expect(agent.settledSuccessGlyph(addNodeRow)).toHaveCount(0)
      await expect(agent.unconfirmedGlyph(addNodeRow)).toBeVisible()
    })
  }
)

exhaustedRetryTest.describe(
  'Agent doc subscribe refused by the host',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    exhaustedRetryTest.describe.configure({ timeout: 90_000 })

    exhaustedRetryTest(
      'surfaces exhausted retries and lets the user reconnect',
      async ({ exhaustedRetryAgent: agent }) => {
        await agent.openAndTarget()
        await agent.sendPrompt('add a load image node')
        await agent.hostSocket.waitForSubscribe()

        const [nodeId] = AGENT_NODE_IDS
        agent.applyOnHost([addLoadImageNode(nodeId, 0)])
        agent.reportToolCall('add_node', 'call-add-one')
        agent.finishTurn('Added a Load Image node.')

        await expect
          .poll(() => agent.hostSocket.refusedSubscribeCount(), {
            timeout: 50_000
          })
          .toBe(7)

        const alert = agent.panel.getByRole('alert')
        await expect(alert).toContainText(
          enMessages.agent.workflowSyncFailedTitle
        )
        await expect(agent.node(nodeId)).toHaveCount(0)

        await agent.panel
          .getByRole('button', { name: enMessages.g.retry, exact: true })
          .click()

        await expect.poll(() => agent.hostSocket.subscribeCount()).toBe(1)
        await expect(agent.node(nodeId)).toBeVisible()
        await expect(alert).toHaveCount(0)
        await expect(
          agent.panel.getByText('Added a Load Image node.').first()
        ).toBeVisible()
      }
    )
  }
)
