import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  AGENT_NODE_IDS,
  addFiveLoadImageNodes,
  addLoadImageNode,
  deleteNode
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'

test.describe(
  'Agent remote apply reaches the canvas',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('GOLDEN PATH: "add 5 load image nodes" puts five nodes on the canvas', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('add 5 load image nodes')
      await agent.hostSocket.waitForSubscribe()

      const before = await agent.settledCanvasNodeIds()
      for (const nodeId of AGENT_NODE_IDS) {
        expect(before).not.toContain(String(nodeId))
      }

      agent.reportToolCall('add_node', 'call-add-five')
      agent.applyAndBroadcast(addFiveLoadImageNodes())
      agent.finishTurn('Added five Load Image nodes.')

      await agent.expectTurnReportedFinished()

      for (const nodeId of AGENT_NODE_IDS) {
        await expect(agent.node(nodeId)).toBeVisible()
      }
      await expect
        .poll(() => agent.settledCanvasNodeIds())
        .toEqual([...before, ...AGENT_NODE_IDS.map(String)].sort())
    })

    test('GOLDEN PATH: a node the agent reports deleting is gone from the canvas', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('add 5 load image nodes')
      await agent.hostSocket.waitForSubscribe()

      const before = await agent.settledCanvasNodeIds()
      agent.reportToolCall('add_node', 'call-add-five')
      agent.applyAndBroadcast(addFiveLoadImageNodes())
      for (const nodeId of AGENT_NODE_IDS) {
        await expect(agent.node(nodeId)).toBeVisible()
      }

      const [removed, ...kept] = AGENT_NODE_IDS
      agent.reportToolCall('delete_node', 'call-delete-one')
      agent.applyAndBroadcast([deleteNode(removed)])
      agent.finishTurn('Removed the first Load Image node.')

      await agent.expectTurnReportedFinished()

      await expect(agent.node(removed)).toHaveCount(0)
      for (const nodeId of kept) {
        await expect(agent.node(nodeId)).toBeVisible()
      }
      await expect
        .poll(() => agent.settledCanvasNodeIds())
        .toEqual([...before, ...kept.map(String)].sort())
    })

    test('a reconnect replays the delta instead of duplicating the graph', async ({
      page
    }) => {
      const agent = new AgentRemoteApplyHarness(page)
      await agent.setUp()
      await agent.openAndTarget()
      await agent.sendPrompt('add 5 load image nodes')
      await agent.hostSocket.waitForSubscribe()

      agent.reportToolCall('add_node', 'call-add-five')
      agent.applyAndBroadcast(addFiveLoadImageNodes())
      agent.finishTurn('Added five Load Image nodes.')
      for (const nodeId of AGENT_NODE_IDS) {
        await expect(agent.node(nodeId)).toBeVisible()
      }
      const settled = await agent.settledCanvasNodeIds()

      const missedNodeId = 7_010_006
      await agent.reconnect([addLoadImageNode(missedNodeId, 5)])

      await expect(agent.node(missedNodeId)).toBeVisible()
      await expect
        .poll(() => agent.settledCanvasNodeIds())
        .toEqual([...settled, String(missedNodeId)].sort())
      for (const nodeId of AGENT_NODE_IDS) {
        await expect(agent.node(nodeId)).toHaveCount(1)
      }
    })
  }
)
