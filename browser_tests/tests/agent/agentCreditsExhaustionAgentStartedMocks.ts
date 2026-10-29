import type { AgentMessage } from '@comfyorg/ingest-types'

import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { zAgentAdmissionError } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import {
  agentThreadPage,
  agentThreadSummary
} from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const WORKSPACE_ID = 'personal'
const THREAD_ID = 'b0f1b6d6-94ad-4d0f-9f0c-7f0b2f9a1d31'
const AGENT_TURN_ID = '8f0a9c2e-5d41-4a7b-9b2f-13c6e0a44b02'
const USER_TURN_ID = '2b7c4d10-6e85-4c13-8a41-9f5d7e6c0b14'
const THREAD_TITLE = 'Agent-started chat'

export const AGENT_OPENING_LINE =
  "I noticed VAE Decode's vae input is not connected. Want me to wire it up?"
export const EARLIER_USER_MESSAGE = 'Build me a pastel landscape'
export const FIRST_REPLY = 'Yes, wire it up'

const NO_FUNDS_REFUSAL = zAgentAdmissionError.parse({
  error: {
    message: 'You are out of credits. Add credits to keep running the agent.',
    reason: 'no_funds',
    type: 'PAYMENT_REQUIRED'
  }
})

export const NO_FUNDS_MESSAGE = NO_FUNDS_REFUSAL.error.message

type ThreadSeed = 'agentStarted' | 'userReplied'

const agentRow: AgentMessage = {
  id: `${THREAD_ID}-assistant`,
  thread_id: THREAD_ID,
  turn_id: AGENT_TURN_ID,
  seq: 2,
  role: 'assistant',
  status: 'complete',
  content: { text: AGENT_OPENING_LINE }
}

const userRow: AgentMessage = {
  id: `${THREAD_ID}-user`,
  thread_id: THREAD_ID,
  turn_id: USER_TURN_ID,
  seq: 1,
  role: 'user',
  status: 'complete',
  content: { text: EARLIER_USER_MESSAGE }
}

const histories: Record<ThreadSeed, AgentMessage[]> = {
  agentStarted: [agentRow],
  userReplied: [userRow, { ...agentRow, turn_id: USER_TURN_ID }]
}

export const test = agentTest.extend<{
  threadSeed: ThreadSeed
  exhaustedRestoredThread: void
}>({
  threadSeed: ['agentStarted', { option: true }],
  exhaustedRestoredThread: [
    async ({ comfyPage, agentBilling, threadSeed }, use) => {
      const { page } = comfyPage
      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(
          jsonRoute(
            agentThreadPage([agentThreadSummary(THREAD_ID, THREAD_TITLE)])
          )
        )
      )
      await page.route('**/api/agent/threads/*/messages', (route) =>
        route.request().method() === 'GET'
          ? route.fulfill(jsonRoute(histories[threadSeed]))
          : route.fulfill({
              status: 402,
              contentType: 'application/json',
              body: JSON.stringify(NO_FUNDS_REFUSAL)
            })
      )
      await page.addInitScript(
        ({ key, threadId }) => localStorage.setItem(key, threadId),
        {
          key: StorageKeys.agentThread(WORKSPACE_ID),
          threadId: THREAD_ID
        }
      )

      agentBilling.setFundingState('exhausted')
      const exhaustedStatus = page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === '/api/billing/status'
      )
      await page.reload()
      await waitForCloudApp(page)
      await exhaustedStatus

      await use()
    },
    { auto: true }
  ]
})
