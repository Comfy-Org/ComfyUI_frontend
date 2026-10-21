import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  firstAgentThreadPage,
  secondAgentThreadPage
} from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

test.describe(
  'Agent chat history pagination',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('lists chats from every page of the thread list', async ({
      page,
      agentFlagEnabled
    }) => {
      await page.route('**/api/agent/threads?*', (route) => {
        const after = new URL(route.request().url()).searchParams.get('after')
        return route.fulfill(
          jsonRoute(
            after === firstAgentThreadPage.pagination.next_cursor
              ? secondAgentThreadPage
              : firstAgentThreadPage
          )
        )
      })

      await bootAgentApp(page, agentFlagEnabled)
      const panel = await new AgentPanel(page).open(30_000)
      await panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()

      await expect(
        panel.getByRole('button', {
          name: firstAgentThreadPage.threads[0].title,
          exact: true
        })
      ).toBeVisible()
      await expect(
        panel.getByRole('button', {
          name: secondAgentThreadPage.threads[0].title,
          exact: true
        })
      ).toBeVisible()
    })
  }
)
