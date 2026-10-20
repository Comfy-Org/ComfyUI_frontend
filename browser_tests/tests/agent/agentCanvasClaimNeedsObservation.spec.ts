import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  AGENT_NODE_IDS,
  addLoadImageNode
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'

const COPY = enMessages.agent

test.describe(
  'the agent may not claim a canvas it has not been observed to change',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('export and save guidance is contradicted on an empty tab', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('Build me a text-to-image workflow.')
      await agent.hostSocket.waitForSubscribe()

      agent.reportToolCall('print_workflow', 'call-print')
      agent.finishTurn(
        'Your nodes are ready. Open the menu to export or save the workflow.'
      )

      await agent.expectTurnReportedFinished()
      await expect(
        agent.panel.getByTestId('agent-run-notice-emptyCanvas')
      ).toContainText(COPY.canvasIsEmptyAfterTurn)
      await expect(agent.workSummary).not.toContainText(
        COPY.workedNotConfirmedOnCanvas
      )
      expect(await agent.settledCanvasNodeIds()).toEqual([])
    })

    test('a write the canvas did take reads as done, with no notice', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('Add a Load Image node.')
      await agent.hostSocket.waitForSubscribe()

      const [nodeId] = AGENT_NODE_IDS
      agent.applyAndBroadcast([addLoadImageNode(nodeId, 0)])
      await expect(agent.node(nodeId)).toBeVisible()
      agent.reportToolCall('add_node', 'call-add-node')
      agent.finishTurn('Added a Load Image node.')

      await agent.expectTurnReportedFinished()
      await expect(agent.workSummary).toContainText(COPY.worked)
      await expect(agent.workSummary).not.toContainText(
        COPY.workedNotConfirmedOnCanvas
      )
      await expect(
        agent.panel.getByTestId('agent-run-notice-emptyCanvas')
      ).toHaveCount(0)
    })
  }
)
