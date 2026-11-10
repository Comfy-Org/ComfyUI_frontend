import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  agentThreadPage,
  agentThreadSummary
} from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const threads = [
  agentThreadSummary('t-plan', 'Weekly plan', {
    preview: 'Help me plan the week around the product launch'
  }),
  agentThreadSummary('t-portrait', 'Portrait upscale', {
    preview:
      'Upscale this portrait to 4K, sharpen the hair and fix the studio lighting'
  }),
  agentThreadSummary('t-animate', 'Animate image', {
    preview: 'Animate this image with a slow push in'
  })
]

test.describe('Agent chat history search', { tag: ['@cloud', '@ui'] }, () => {
  test.beforeEach(async ({ page, agentFlagEnabled }) => {
    await page.route(/\/api\/agent\/threads(?:\?.*)?$/, (route) =>
      route.fulfill(jsonRoute(agentThreadPage(threads)))
    )
    await bootAgentApp(page, agentFlagEnabled)
  })

  async function openHistory(page: Page) {
    const panel = await new AgentPanel(page).open(30_000)
    await panel
      .getByRole('button', { name: enMessages.agent.showChatHistory })
      .click()
    return panel
  }

  test('finds a chat by its first message and shows where it matched', async ({
    page
  }) => {
    const panel = await openHistory(page)

    await panel
      .getByRole('combobox', { name: enMessages.agent.historySearchLabel })
      .fill('lighting')

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
    const panel = await openHistory(page)
    const field = panel.getByRole('combobox', {
      name: enMessages.agent.historySearchLabel
    })

    await field.fill('zzzq')
    await expect(panel.getByText('No chats match "zzzq"')).toBeVisible()

    await panel
      .getByRole('button', { name: enMessages.agent.historySearchClear })
      .click()
    await expect(
      panel.getByRole('button', { name: 'Weekly plan', exact: true })
    ).toBeVisible()
    await expect(
      panel.getByRole('button', { name: 'Animate image', exact: true })
    ).toBeVisible()
  })

  test('Esc clears the query first, then leaves History', async ({ page }) => {
    const panel = await openHistory(page)
    const field = panel.getByRole('combobox', {
      name: enMessages.agent.historySearchLabel
    })
    await field.fill('plan')

    await field.press('Escape')
    await expect(field).toHaveValue('')
    await expect(
      panel.getByRole('heading', { name: enMessages.agent.history })
    ).toBeVisible()

    await field.press('Escape')
    await expect(
      panel.getByRole('heading', { name: enMessages.agent.history })
    ).toBeHidden()
  })
})
