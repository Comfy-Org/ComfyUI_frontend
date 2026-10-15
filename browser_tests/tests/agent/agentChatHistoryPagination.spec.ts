import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  SECOND_THREAD_PAGE_CURSOR,
  firstAgentThreadPage,
  secondAgentThreadPage
} from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const PANEL_MOUNT_TIMEOUT = 30_000

test.describe(
  'Agent chat history pagination',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('lists chats from every page of the thread list', async ({
      page,
      agentFlagEnabled
    }) => {
      const threadListQueries: string[] = []
      await page.route('**/api/agent/threads?*', (route) => {
        const { search, searchParams } = new URL(route.request().url())
        threadListQueries.push(search)
        return route.fulfill(
          jsonRoute(
            searchParams.get('after') === SECOND_THREAD_PAGE_CURSOR
              ? secondAgentThreadPage
              : firstAgentThreadPage
          )
        )
      })

      await bootAgentApp(page, agentFlagEnabled)
      const panel = await new AgentPanel(page).open(PANEL_MOUNT_TIMEOUT)
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
      expect(threadListQueries[0]).toBe('?limit=100')
      expect(threadListQueries).toContain(
        `?limit=100&after=${SECOND_THREAD_PAGE_CURSOR}`
      )
    })
  }
)
