import { expect } from '@playwright/test'

import { STALE_AFTER_MS } from '@/workbench/extensions/agent/crdt/agentCrdtDocLifecycle'

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import { addLoadImageNode } from '@e2e/fixtures/data/agent/agentRemoteApply'
import { AgentRemoteApplyHarness } from '@e2e/fixtures/helpers/AgentRemoteApplyHarness'

test.describe(
  'Agent follower stale-document recovery',
  { tag: ['@cloud', '@canvas', '@vue-nodes'] },
  () => {
    let agent: AgentRemoteApplyHarness

    test.setTimeout(60_000)

    test.beforeEach(async ({ page }) => {
      await page.clock.install()
      agent = new AgentRemoteApplyHarness(page)
      await agent.setUp()
    })

    test('retains the live canvas while catching up after document frames stop', async ({
      page
    }) => {
      const retainedNodeId = 7_010_101
      const missedNodeId = 7_010_102

      await test.step('complete the initial workflow sync', async () => {
        await agent.openAndTarget()
        await agent.sendPrompt('Watch this workflow for changes.')
        await agent.hostSocket.waitForSubscribe()

        agent.applyAndBroadcast([addLoadImageNode(retainedNodeId, 0)])
        await expect(agent.node(retainedNodeId)).toBeVisible()
      })

      await test.step('keep the user selection while live document updates stop', async () => {
        await agent.vueNodes.selectNode(String(retainedNodeId))
        await expect(agent.vueNodes.selectedNodes).toHaveCount(1)
        await agent.node(retainedNodeId).evaluate((element) => {
          element.setAttribute('data-stall-identity', 'retained')
        })

        agent.applyOnHost([addLoadImageNode(missedNodeId, 1)])
        await expect(agent.node(missedNodeId)).toHaveCount(0)
      })

      await test.step('automatically catch up without replacing the canvas', async () => {
        await page.clock.fastForward(STALE_AFTER_MS + 1)

        await expect(agent.node(missedNodeId)).toBeVisible()
        await expect(agent.node(retainedNodeId)).toBeVisible()
        await expect(agent.node(retainedNodeId)).toHaveAttribute(
          'data-stall-identity',
          'retained'
        )
        await expect(agent.vueNodes.selectedNodes).toHaveCount(1)
        await expect(agent.node(retainedNodeId)).toHaveClass(
          /outline-foreground/
        )
      })
    })
  }
)
