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
    test.beforeEach(async ({ page, agentFlagEnabled }) => {
      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(jsonRoute(threadList))
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
        { key: StorageKeys.agentThread(WORKSPACE_ID), threadId: THREAD_ID }
      )
      await bootAgentApp(page, agentFlagEnabled)
    })

    test('returns to the chat from history after the chat fails to open', async ({
      page
    }) => {
      test.setTimeout(60_000)

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
