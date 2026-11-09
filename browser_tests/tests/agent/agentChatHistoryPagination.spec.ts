import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { thirtyAgentThreadPages } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const expectedChatNames = [
  ...thirtyAgentThreadPages.first.threads,
  ...thirtyAgentThreadPages.second.threads
].map((thread) => thread.title)

test.describe(
  'Agent chat history pagination',
  {
    tag: ['@cloud', '@ui'],
    annotation: {
      type: 'source',
      description:
        'https://comfy-organization.slack.com/archives/C0BGH348Z0C/p1792617168740849'
    }
  },
  () => {
    test('makes the 21st of 30 chats reachable', async ({
      page,
      agentFlagEnabled
    }) => {
      await page.route(/\/api\/agent\/threads(?:\?.*)?$/, (route) => {
        const after = new URL(route.request().url()).searchParams.get('after')
        return route.fulfill(
          jsonRoute(
            after === thirtyAgentThreadPages.first.pagination.next_cursor
              ? thirtyAgentThreadPages.second
              : thirtyAgentThreadPages.first
          )
        )
      })

      await bootAgentApp(page, agentFlagEnabled)
      const panel = await new AgentPanel(page).open(30_000)
      await panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()

      await expect(
        panel.getByRole('button', { name: /^Chat \d+$/ })
      ).toHaveCount(30)
      await expect
        .poll(() =>
          panel.getByRole('button', { name: /^Chat \d+$/ }).allTextContents()
        )
        .toEqual(expect.arrayContaining(expectedChatNames))
      const twentyFirstChat = panel.getByRole('button', {
        name: 'Chat 21',
        exact: true
      })
      await twentyFirstChat.scrollIntoViewIfNeeded()
      await expect(twentyFirstChat).toBeVisible()
    })
  }
)
