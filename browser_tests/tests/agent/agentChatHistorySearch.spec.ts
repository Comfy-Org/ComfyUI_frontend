import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  agentThreadPage,
  searchableAgentThreads
} from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

test.describe('Agent chat history search', { tag: ['@cloud', '@ui'] }, () => {
  test.beforeEach(async ({ page, agentFlagEnabled }) => {
    await page.route(/\/api\/agent\/threads(?:\?.*)?$/, (route) =>
      route.fulfill(jsonRoute(agentThreadPage(searchableAgentThreads)))
    )
    await bootAgentApp(page, agentFlagEnabled)
  })

  test('finds a chat by its first message and shows where it matched', async ({
    page
  }) => {
    const agent = new AgentPanel(page)
    const panel = await agent.openHistory(30_000)

    await agent.historySearchField.fill('lighting')

    await expect(
      panel.getByRole('button', { name: 'Portrait upscale', exact: true })
    ).toBeVisible()
    await expect(
      panel.getByRole('button', { name: 'Weekly plan', exact: true })
    ).toBeHidden()
    await expect(
      panel.getByText(enMessages.agent.historyMatchMessage)
    ).toBeVisible()
  })

  test('says when nothing matches, then restores the list when cleared', async ({
    page
  }) => {
    const agent = new AgentPanel(page)
    const panel = await agent.openHistory(30_000)

    await agent.historySearchField.fill('zzzq')
    await expect(panel.getByText('No chats match "zzzq"')).toBeVisible()

    await agent.historySearchClearButton.click()
    await expect(
      panel.getByRole('button', { name: 'Weekly plan', exact: true })
    ).toBeVisible()
    await expect(
      panel.getByRole('button', { name: 'Animate image', exact: true })
    ).toBeVisible()
  })

  test('Esc clears the query first, then leaves History', async ({ page }) => {
    const agent = new AgentPanel(page)
    await agent.openHistory(30_000)
    const field = agent.historySearchField
    await field.fill('plan')

    await field.press('Escape')
    await expect(field).toHaveValue('')
    await expect(agent.historyHeading).toBeVisible()

    await field.press('Escape')
    await expect(agent.historyHeading).toBeHidden()
  })
})
