import { expect } from '@playwright/test'
import type {
  AgentMessage,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// Regression for the agent thread list caching a title separately from the
// active chat, so a thread's list entry could keep showing a stale preview
// after the open chat derived a better title from its real first message
// (AgentPanelRoot.vue's `patchTitle`/`activeSessionTitle` watch).
const WORKSPACE_ID = 'personal'
const THREAD_ID = 'thread-title-sync-e2e'
const TURN_ID = 'c6c9b9b0-2f31-4a63-9b00-000000000001'
const SEEDED_AT = new Date(0).toISOString()

// What the thread list already knew about this chat before its transcript
// ever loaded - a raw preview, no computed title yet.
const STALE_PREVIEW = 'landscape wip'
// What the active chat derives once its real first message is known - a
// different, better string than the seeded preview above.
const REAL_FIRST_MESSAGE =
  'Build me a dreamy pastel landscape with a cabin in fog'

const staleThreadList: AgentThreadListResponse = {
  pagination: { has_more: false, limit: 100, offset: 0, total: 1 },
  threads: [
    {
      id: THREAD_ID,
      title: '',
      preview: STALE_PREVIEW,
      status: 'active',
      message_count: 1,
      created_at: SEEDED_AT,
      updated_at: SEEDED_AT,
      last_message_at: SEEDED_AT,
      workflow_id: ''
    }
  ]
}

const hydratedMessages: AgentMessage[] = [
  {
    id: 'user-1',
    thread_id: THREAD_ID,
    turn_id: TURN_ID,
    seq: 1,
    role: 'user',
    status: 'complete',
    content: { text: REAL_FIRST_MESSAGE }
  },
  {
    id: TURN_ID,
    thread_id: THREAD_ID,
    turn_id: TURN_ID,
    seq: 2,
    role: 'assistant',
    status: 'complete',
    content: { text: 'Sure, I can help with that.' }
  }
]

const PANEL_MOUNT_TIMEOUT = 30_000

test.describe(
  'Agent chat history title sync',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('catches the history list up to the active chat once its derived title lands', async ({
      page,
      agentFlagEnabled
    }) => {
      test.setTimeout(60_000)

      let threadsRequestCount = 0
      let resolveThreadsRefetch: (() => void) | undefined
      await page.route('**/api/agent/threads', async (route) => {
        threadsRequestCount += 1
        await route.fulfill(jsonRoute(staleThreadList))
        resolveThreadsRefetch?.()
      })

      // The transcript fetch is held until the test has already observed the
      // stale list entry with no derived title yet, so the "before" state is
      // driven deterministically instead of raced against hydration.
      let releaseTranscriptHydration: (() => void) | undefined
      const transcriptGate = new Promise<void>((resolve) => {
        releaseTranscriptHydration = resolve
      })
      await page.route('**/api/agent/threads/*/messages', async (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        await transcriptGate
        await route.fulfill(jsonRoute(hydratedMessages))
      })
      await page.route('**/api/agent/run-mode', (route) =>
        route.fulfill(jsonRoute({ mode: 'ask_approval', credit_limit: null }))
      )
      await page.route('**/api/experiment/models', (route) =>
        route.fulfill(jsonRoute([]))
      )

      // Resume straight into the existing thread, the same way a reopened
      // app restores its last chat (useAgentSession.start()).
      await page.addInitScript(
        ({ key, threadId }) => localStorage.setItem(key, threadId),
        { key: StorageKeys.agentThread(WORKSPACE_ID), threadId: THREAD_ID }
      )

      await bootAgentApp(page, agentFlagEnabled)
      const panel = await new AgentPanel(page).open(PANEL_MOUNT_TIMEOUT)

      const showHistoryButton = panel.getByRole('button', {
        name: enMessages.agent.showChatHistory
      })
      const staleRow = panel.getByRole('button', {
        name: STALE_PREVIEW,
        exact: true
      })
      const realTitleRow = panel.getByRole('button', {
        name: REAL_FIRST_MESSAGE,
        exact: true
      })

      await test.step('the list shows only the seeded preview before the transcript loads', async () => {
        await showHistoryButton.click()
        await expect(staleRow).toBeVisible()

        await panel
          .getByRole('button', { name: enMessages.agent.backToPreviousChat })
          .click()
        // Nothing has hydrated yet, so the header has no derived title either.
        await expect(
          panel.getByRole('button', {
            name: enMessages.agent.newChatTitle,
            exact: true
          })
        ).toBeVisible()
      })

      await test.step("the active chat's header picks up the real title", async () => {
        releaseTranscriptHydration?.()
        await expect(
          panel.getByRole('button', { name: REAL_FIRST_MESSAGE, exact: true })
        ).toBeVisible()
      })

      await test.step('the history list stays consistent after a stale refetch resolves', async () => {
        const refetchCompleted = new Promise<void>((resolve) => {
          resolveThreadsRefetch = resolve
        })
        await showHistoryButton.click()
        await refetchCompleted
        await expect(realTitleRow).toBeVisible()
        await expect(staleRow).toHaveCount(0)
        expect(threadsRequestCount).toBeGreaterThanOrEqual(2)
      })
    })
  }
)
