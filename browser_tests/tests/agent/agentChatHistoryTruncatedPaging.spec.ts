import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { thirtyAgentThreadPages } from '@e2e/fixtures/data/agent/agentThreadList'
import { TestIds } from '@e2e/fixtures/selectors'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

test.describe(
  'Agent chat history with truncated paging',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(jsonRoute(thirtyAgentThreadPages.first))
      )
    })

    test('shows the chats it did fetch instead of a blocking error', async ({
      page,
      agentFlagEnabled,
      toast
    }) => {
      await bootAgentApp(page, agentFlagEnabled)
      const panel = await new AgentPanel(page).open(30_000)
      await panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()

      await expect(
        toast
          .withText(enMessages.agent.historyIncomplete)
          .and(toast.toastWarnings)
      ).toBeVisible()
      await expect(
        panel.getByRole('button', {
          name: thirtyAgentThreadPages.first.threads[0].title,
          exact: true
        })
      ).toBeVisible()
      await expect(page.getByTestId(TestIds.dialogs.errorOverlay)).toBeHidden()
    })
  }
)
