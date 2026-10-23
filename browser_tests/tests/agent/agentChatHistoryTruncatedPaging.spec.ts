import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { firstAgentThreadPage } from '@e2e/fixtures/data/agent/agentThreadList'
import { TestIds } from '@e2e/fixtures/selectors'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * A local agent with more than one page of chats served page 1 again for every
 * cursor, so the list never reached its last page. The panel treated that as a
 * failed request: it threw the 100 chats it had away and raised the blocking
 * error overlay, leaving the whole chat history unusable (OBL-287).
 */
test.describe(
  'Agent chat history with truncated paging',
  { tag: ['@cloud', '@ui'] },
  () => {
    // Every page, cursor or not, answers with page 1 and the same next cursor.
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(jsonRoute(firstAgentThreadPage))
      )
    })

    test('shows the chats it did fetch instead of a blocking error', async ({
      page,
      agentFlagEnabled
    }) => {
      await bootAgentApp(page, agentFlagEnabled)
      const panel = await new AgentPanel(page).open(30_000)
      await panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()

      await expect(
        page.getByRole('alert').filter({
          hasText: enMessages.agent.historyIncomplete
        })
      ).toBeVisible()
      // Exactly one row per chat: the repeated page served the same threads
      // more than once, and strict mode would fail here on a duplicate.
      await expect(
        panel.getByRole('button', {
          name: firstAgentThreadPage.threads[0].title,
          exact: true
        })
      ).toBeVisible()
      await expect(page.getByTestId(TestIds.dialogs.errorOverlay)).toBeHidden()
    })
  }
)
