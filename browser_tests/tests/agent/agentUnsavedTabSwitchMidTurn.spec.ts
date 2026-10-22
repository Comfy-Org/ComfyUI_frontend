import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'

// Reported from #agent-sorry: "agent said it created a workflow but tab is
// empty". Repro: start a chat on a new, unsaved tab, switch to another tab
// while the turn is still editing, then come back -- the tab is blank even
// though the agent reports the workflow as built.
//
// agentTabSwitchCatchUp.spec.ts covers switching only after the turn has
// finished, on a saved seed tab. This switches mid-turn: the follower
// unsubscribes the inactive tab, the host keeps applying the remaining edits,
// and the returning subscribe's catch-up is the only way they reach the canvas.
const CASE = 'agent-rec-three-sequential-adds'

test.describe(
  'Agent turn on an unsaved tab, switched away mid-turn',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE })

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
