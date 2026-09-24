import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

// Same recording agentTabSwitchCatchUp.spec.ts uses for its canvas-only
// coverage: one turn sets the KSampler's steps (20 -> 30) and cfg (7 -> 5) on
// an existing node.
const EDITED_CASE = 'agent-rec-set-widget-existing'
const KSAMPLER_NODE_ID = '3'

test.describe(
  'Agent workflow tab switch run submission',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: EDITED_CASE })

    test('graphToPrompt submits the agent-edited values after switching away and back', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const topbar = new Topbar(page)
      const tabs = topbar.tabs
      const lastTurn = agentConversation.conversation.turns.length - 1

      // What Run actually submits, independent of what the canvas paints:
      // graphToPrompt() serializes the live LiteGraph nodes the follower
      // patches, not the Vue-rendered widget rows expectCanvasReplayed reads.
      const ksamplerInputs = async (): Promise<
        ComfyApiWorkflow[string]['inputs']
      > => {
        const output = await page.evaluate(
          async () => (await window.app!.graphToPrompt()).output
        )
        return output[KSAMPLER_NODE_ID].inputs
      }

      await agentConversation.sendPrompt()

      await agentConversation.replayResponse(0, async () => {
        await test.step('user switches workflows before the agent edits arrive', async () => {
          await expect(tabs).toHaveCount(1)
          await expect(
            topbar.getTab(0).and(topbar.getActiveTab())
          ).toBeVisible()
          const inputs = await ksamplerInputs()
          expect(inputs.steps).toBe(20)
          expect(inputs.cfg).toBe(7)
          await topbar.newWorkflowButton.click()
          await expect(tabs).toHaveCount(2)
          await expect(
            topbar.getTab(1).and(topbar.getActiveTab())
          ).toBeVisible()
          await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
        })
      })

      await test.step('agent finishes editing the background workflow', async () => {
        await agentConversation.waitForTurnComplete()
        await expect(topbar.getTab(1).and(topbar.getActiveTab())).toBeVisible()
        await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      })

      await test.step('user returns to the edited workflow', async () => {
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0).and(topbar.getActiveTab())).toBeVisible()

        // The canvas is correct straight through the round trip (covered by
        // agentTabSwitchCatchUp.spec.ts); PM-1318 is that Run's own graph
        // export does not agree with it.
        await agentConversation.expectCanvasReplayed(lastTurn)

        const inputs = await ksamplerInputs()
        expect(inputs.steps).toBe(30)
        expect(inputs.cfg).toBe(5)
      })
    })
  }
)
