import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import { addLoadImageNode } from '@e2e/fixtures/data/agent/agentRemoteApply'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'

// FE-2247: closing the Agent panel unmounts AgentPanelRoot, the CRDT follower
// it owns, and the agent socket; reopening mounts a fresh follower on a fresh
// socket. The unit lifecycle test (`useAgentCrdtFollower.test.ts`, FE-2158)
// pins the bridge and subscription bookkeeping. This pins what the user sees
// across that remount: host updates reach the canvas again, land on the canvas
// that was already there, and the follower never writes the shared document.
test.describe(
  'Agent follower across an Agent panel close and reopen',
  { tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'] },
  () => {
    let agent: AgentRemoteApplyHarness

    test.setTimeout(60_000)

    test.beforeEach(async ({ page }) => {
      agent = new AgentRemoteApplyHarness(page)
      await agent.setUp()
    })

    test('resumes host updates on the existing canvas without writing back', async () => {
      const retainedNodeId = 7_010_201
      const missedNodeId = 7_010_202
      const liveNodeId = 7_010_203

      await test.step('sync the workflow through the first follower', async () => {
        await agent.openAndTarget()
        await agent.sendPrompt('Watch this workflow for changes.')
        await agent.hostSocket.waitForSubscribe()

        agent.applyAndBroadcast([addLoadImageNode(retainedNodeId, 0)])
        await expect(agent.node(retainedNodeId)).toBeVisible()
        await agent.vueNodes.selectNode(String(retainedNodeId))
        await expect(agent.vueNodes.selectedNodes).toHaveCount(1)
      })

      await test.step('close the panel while the host moves on', async () => {
        await agent.agentPanel.close()
        agent.applyOnHost([addLoadImageNode(missedNodeId, 1)])
      })

      await test.step('reopen the panel and receive host updates again', async () => {
        const subscribesBefore = agent.hostSocket.subscribeCount()
        await agent.agentPanel.open()
        await expect
          .poll(() => agent.hostSocket.subscribeCount(), {
            message: 'the remounted follower never subscribed'
          })
          .toBe(subscribesBefore + 1)
        await expect(agent.node(missedNodeId)).toBeVisible()

        agent.applyAndBroadcast([addLoadImageNode(liveNodeId, 2)])
        await expect(agent.node(liveNodeId)).toBeVisible()
      })

      await test.step('keep the existing canvas and never write the document', async () => {
        // A node the remount removed and re-added would come back unselected.
        await expect(agent.vueNodes.selectedNodes).toHaveCount(1)
        await expect(agent.node(retainedNodeId)).toHaveClass(
          /outline-foreground/
        )
        expect(await agent.settledCanvasNodeIds()).toEqual(
          [retainedNodeId, missedNodeId, liveNodeId].map(String).sort()
        )
        // `doc_ops` would be the follower minting edits back and `doc_reseed`
        // would be it pushing its whole canvas over the host's document.
        expect(
          agent.hostSocket
            .clientDocFrames()
            .filter(({ type }) => type === 'doc_ops' || type === 'doc_reseed')
        ).toEqual([])
        expect(agent.hostSocket.subscribeCount()).toBe(2)
      })
    })
  }
)
