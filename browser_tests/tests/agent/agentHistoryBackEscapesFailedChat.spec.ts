import { expect } from '@playwright/test'
import type { AgentThreadListResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// PM-2044: a beta tester could not open any saved chat, and then could not
// leave Chat history at all - Back retried the chat that had just failed, that
// retry failed again, and the history screen stayed on screen. New Chat was the
// only way out, which costs the user the chat they were in. The exit path is a
// separate defect from whatever makes the open fail, so this spec makes the
// open fail in the simplest durable way (the transcript request never
// succeeds) and asserts only that the user can still get back to their chat.

const WORKSPACE_ID = 'personal'
const THREAD_ID = 'thread-history-back-escape-e2e'
const THREAD_TITLE = 'Dreamy pastel landscape'
const SEEDED_AT = new Date(0).toISOString()

const threadList: AgentThreadListResponse = {
  pagination: { has_more: false, limit: 100, offset: 0, total: 1 },
  threads: [
    {
      id: THREAD_ID,
      title: THREAD_TITLE,
      preview: THREAD_TITLE,
      status: 'active',
      message_count: 2,
      created_at: SEEDED_AT,
      updated_at: SEEDED_AT,
      last_message_at: SEEDED_AT,
      workflow_id: ''
    }
  ]
}

const PANEL_MOUNT_TIMEOUT = 30_000

test.describe(
  'Agent chat history exit path',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('returns to the chat from history after the chat fails to open', async ({
      page,
      agentFlagEnabled
    }) => {
      test.setTimeout(60_000)

      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(jsonRoute(threadList))
      )
      // The transcript never loads, so neither the stored chat at startup nor
      // the row the user picks can open. A 500 rather than a 404 keeps the
      // chat in the list: a 404 would retire it and remove the Back target.
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
        { key: StorageKeys.agentThread(WORKSPACE_ID), threadId: THREAD_ID }
      )

      await bootAgentApp(page, agentFlagEnabled)
      const panel = new AgentPanel(page)
      await panel.open(PANEL_MOUNT_TIMEOUT)

      const historyHeading = panel.root.getByRole('heading', {
        name: enMessages.agent.history
      })
      const savedChatRow = panel.root.getByRole('button', {
        name: THREAD_TITLE,
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
