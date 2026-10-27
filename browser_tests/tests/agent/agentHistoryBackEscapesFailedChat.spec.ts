import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentHistoryBackFailure } from '@e2e/fixtures/data/agent/agentHistoryBackFailure'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

test.describe(
  'Agent chat history exit path',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.beforeEach(async ({ page, agentFlagEnabled }) => {
      test.setTimeout(60_000)

      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(jsonRoute(agentHistoryBackFailure.threadList))
      )
      await page.route('**/api/agent/threads/*/messages', async (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        await route.fulfill({ status: 500, body: 'transcript unavailable' })
      })
      await page.route('**/api/agent/run-mode', (route) =>
        route.fulfill(jsonRoute({ mode: 'ask_approval', credit_limit: null }))
      )
      await page.route('**/api/experiment/models', (route) =>
        route.fulfill(jsonRoute([]))
      )
      await page.addInitScript(
        ({ key, threadId }) => localStorage.setItem(key, threadId),
        {
          key: StorageKeys.agentThread(agentHistoryBackFailure.workspaceId),
          threadId: agentHistoryBackFailure.threadId
        }
      )
      await bootAgentApp(page, agentFlagEnabled)
    })

    test('returns to the chat from history after the chat fails to open', async ({
      page
    }) => {
      const panel = new AgentPanel(page)
      await panel.open(30_000)

      const historyHeading = panel.root.getByRole('heading', {
        name: enMessages.agent.history
      })
      const savedChatRow = panel.root.getByRole('button', {
        name: agentHistoryBackFailure.threadTitle,
        exact: true
      })
      const backButton = panel.root.getByRole('button', {
        name: enMessages.agent.backToPreviousChat
      })

      await test.step('the saved chat refuses to open from history', async () => {
        await panel.historyButton.click()
        await expect(historyHeading).toBeVisible()
        await savedChatRow.click()
        await expect(
          panel.root.getByRole('alert').filter({
            hasText: enMessages.agent.historyOpenFailed
          })
        ).toBeVisible()
        await expect(historyHeading).toBeVisible()
      })

      await test.step('Back leaves history instead of retrying forever', async () => {
        await backButton.click()

        await expect(historyHeading).toBeHidden()
        await expect(panel.historyButton).toBeVisible()
        await expect(panel.composer).toBeVisible()
      })
    })
  }
)
