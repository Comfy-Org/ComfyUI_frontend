import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { ClickedTemplate } from '@e2e/tests/agent/agentTemplates'
import { AgentTemplates } from '@e2e/tests/agent/agentTemplates'

test.describe(
  'PM-2126: opening a template while the agent is updating the graph',
  { tag: ['@cloud', '@canvas', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: 'agent-rec-three-sequential-adds' })

    test('opens the template without the load-failure toast', async ({
      agentConversation,
      page,
      toast
    }) => {
      const templates = new AgentTemplates(page)
      let graphOpsSeen = 0
      let clicked: ClickedTemplate | undefined
      let releaseTemplate = () => {}
      const templateHeld = new Promise<void>((resolve) => {
        releaseTemplate = resolve
      })

      await agentConversation.sendPrompt(0)
      await agentConversation.replayResponse(0, {
        beforeGraphOps: async () => {
          graphOpsSeen++
          if (graphOpsSeen === 2) {
            await test.step('template is clicked while the agent is updating the graph', async () => {
              await expect(
                page.getByTestId('agent-graph-activity-bar')
              ).toBeVisible()
              clicked = await templates.clickFirstTemplate(templateHeld)
            })
          }
          if (graphOpsSeen === 3) {
            await test.step('the second graph op landed while the template was loading', async () => {
              expect(await templates.loadingTemplateId()).toBe(clicked?.id)
            })

            releaseTemplate()
          }
        },
        waitForGraphOpsDelivery: () => graphOpsSeen === 2
      })
      if (!clicked) throw new Error('the template was never clicked')
      const template = await clicked.opened

      await test.step('template opens fully once its file is released', async () => {
        await templates.expectTemplateOpened(template)
        await expect(toast.toastErrors).toHaveCount(0)
      })

      await test.step('the rest of the turn leaves the template tab intact', async () => {
        await agentConversation.waitForTurnComplete()
        await templates.expectTemplateOpened(template)
        await expect(toast.toastErrors).toHaveCount(0)
      })

      await test.step("the agent's ops all reached its own workflow", async () => {
        await agentConversation.topbar.getTab(0).click()
        await expect(
          agentConversation.topbar
            .getTab(0)
            .and(agentConversation.topbar.getActiveTab())
        ).toBeVisible()
        await agentConversation.expectCanvasReplayed(0)
        await expect(toast.toastErrors).toHaveCount(0)
      })
    })
  }
)
