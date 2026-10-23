import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'

test.describe(
  'Agent turn on an unsaved tab, switched away mid-turn',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-three-sequential-adds',
      workflowTarget: 'unsaved-draft'
    })

    test('shows every edit after switching away mid-turn and back', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const topbar = new Topbar(page)
      const tabs = topbar.tabs

      await test.step('user sends from the unsaved tab', async () => {
        await expect(tabs).toHaveCount(1)
        await agentConversation.sendPrompt(0)
      })

      await test.step('user opens another tab after the first edit', async () => {
        let graphOpsSeen = 0
        await agentConversation.replayResponse(0, {
          waitForGraphOpsDelivery: () => graphOpsSeen === 1,
          beforeGraphOps: async () => {
            graphOpsSeen += 1
            if (graphOpsSeen !== 2) return
            await topbar.newWorkflowButton.click()
            await expect(tabs).toHaveCount(2)
            await expect(
              topbar.getTab(1).and(topbar.getActiveTab())
            ).toBeVisible()
          }
        })
        expect(graphOpsSeen).toBeGreaterThan(1)
        await agentConversation.waitForTurnComplete()
      })

      await test.step('user returns to the unsaved tab', async () => {
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0).and(topbar.getActiveTab())).toBeVisible()
        await agentConversation.expectCanvasReplayed(0)
      })
    })

    test('shows every edit after switching away before the first edit and back', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const topbar = new Topbar(page)
      const tabs = topbar.tabs

      await agentConversation.sendPrompt(0)
      await agentConversation.replayResponse(0, {
        beforeFirstGraphOps: async () => {
          await topbar.newWorkflowButton.click()
          await expect(tabs).toHaveCount(2)
          await expect(
            topbar.getTab(1).and(topbar.getActiveTab())
          ).toBeVisible()
        }
      })
      await agentConversation.waitForTurnComplete()

      await topbar.getTab(0).click()
      await expect(topbar.getTab(0).and(topbar.getActiveTab())).toBeVisible()
      await agentConversation.expectCanvasReplayed(0)
    })
  }
)
