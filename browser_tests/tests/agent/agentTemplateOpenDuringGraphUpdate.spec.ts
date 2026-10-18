import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { ComfyTemplates } from '@e2e/fixtures/components/Templates'
import type { OpenedTemplate } from '@e2e/fixtures/components/Templates'

test.describe(
  'PM-2126: opening a template while the agent is updating the graph',
  { tag: ['@cloud', '@canvas', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 90_000 })
    test.use({ conversationCase: 'agent-rec-three-sequential-adds' })

    test('opens the template without the load-failure toast', async ({
      agentConversation,
      page,
      toast
    }) => {
      const templates = new ComfyTemplates(page)
      let graphOpsSeen = 0
      let opened: OpenedTemplate | undefined
      const expectNoLoadFailureToast = async () => {
        await expect(toast.toastErrors).toHaveCount(0)
        await expect(
          toast.withText(enMessages.templateWorkflows.error.loading)
        ).toHaveCount(0)
      }

      await agentConversation.sendPrompt(0)
      await agentConversation.replayResponse(0, {
        beforeGraphOps: async () => {
          graphOpsSeen++
          if (graphOpsSeen !== 2) return

          await test.step('template opens fully while the activity bar shows the agent updating', async () => {
            await expect(
              page.getByTestId('agent-graph-activity-bar')
            ).toBeVisible()
            opened = await templates.openFirstTemplate()
            await templates.expectTemplateOpened(opened)
            await expectNoLoadFailureToast()
          })
        }
      })
      if (!opened) throw new Error('the template never opened mid-update')
      const template = opened

      await test.step('the rest of the turn leaves the template tab intact', async () => {
        await agentConversation.waitForTurnComplete()
        await templates.expectTemplateOpened(template)
        await expectNoLoadFailureToast()
      })

      await test.step("the agent's ops all reached its own workflow", async () => {
        await agentConversation.topbar.getTab(0).click()
        await expect(
          agentConversation.topbar
            .getTab(0)
            .and(agentConversation.topbar.getActiveTab())
        ).toBeVisible()
        await agentConversation.expectCanvasReplayed(0)
        await expectNoLoadFailureToast()
      })
    })
  }
)
