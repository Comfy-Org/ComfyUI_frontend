import { expect } from '@playwright/test'

import type {
  AgentMessage,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { zAgentAdmissionError } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import {
  agentThreadPage,
  agentThreadSummary
} from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

/**
 * FRONT-3670. #21241 holds the standing out-of-credits card until the thread
 * has a user message, because a brand-new workspace's gratis grant is minted
 * at admission: before the first send `agent_has_funds` is legitimately
 * `false` for a user who does in fact have free credits waiting, and the card
 * claimed they were out. FRONT-3251 will let the agent speak first, which
 * produces the state pinned here — a thread with an assistant turn and no user
 * turn — and that gate was flagged as needing a decision once it existed.
 *
 * The decision pinned by this spec is the second of the two FRONT-3670 offers:
 * the card stays hidden until the user engages, and the first refusal is what
 * explains credits. Counting the agent's own turn as activation would put "out
 * of credits" beside the agent's opening line for every new user whose grant
 * has not been minted yet, which is the regression #21241 removed, at the most
 * prominent moment of onboarding.
 *
 * The other shape FRONT-3251 may take — a greeting rendered in the empty state
 * with no transcript row at all — is already covered by
 * `agentCreditsExhaustionEmptyThread.spec.ts`.
 */
const WORKSPACE_ID = 'personal'
const THREAD_ID = 'b0f1b6d6-94ad-4d0f-9f0c-7f0b2f9a1d31'
const TURN_ID = '8f0a9c2e-5d41-4a7b-9b2f-13c6e0a44b02'
const THREAD_TITLE = 'Agent-started chat'
const AGENT_OPENING_LINE =
  "I noticed VAE Decode's vae input is not connected. Want me to wire it up?"
const FIRST_REPLY = 'Yes, wire it up'

const agentStartedThread: AgentMessage[] = [
  {
    id: `${THREAD_ID}-assistant`,
    thread_id: THREAD_ID,
    turn_id: TURN_ID,
    seq: 1,
    role: 'assistant',
    status: 'complete',
    content: { text: AGENT_OPENING_LINE }
  }
]

const threadList: AgentThreadListResponse = agentThreadPage([
  agentThreadSummary(THREAD_ID, THREAD_TITLE)
])

const NO_FUNDS_REFUSAL = zAgentAdmissionError.parse({
  error: {
    message: 'You are out of credits. Add credits to keep running the agent.',
    reason: 'no_funds',
    type: 'PAYMENT_REQUIRED'
  }
})

test.describe(
  'Agent standing credits-exhaustion on a thread the agent started',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('keeps the card hidden until the first reply, then explains credits on the refusal', async ({
      agentBilling,
      agentPanel,
      page
    }) => {
      const paywall = agentPanel.creditsExhaustedPaywall

      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(jsonRoute(threadList))
      )
      await page.route('**/api/agent/threads/*/messages', (route) => {
        const request = route.request()
        if (request.method() === 'GET')
          return route.fulfill(jsonRoute(agentStartedThread))
        return route.fulfill({
          status: 402,
          contentType: 'application/json',
          body: JSON.stringify(NO_FUNDS_REFUSAL)
        })
      })
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
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await test.step('the agent speaks first and no card claims the user is out of credits', async () => {
        await expect(
          agentPanel.root.getByText(AGENT_OPENING_LINE)
        ).toBeVisible()
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveCount(0)
        await expect(agentPanel.composer).toBeVisible()
        await expect(paywall).toHaveCount(0)
        await expect(agentPanel.root.getByRole('alert')).toHaveCount(0)
      })

      await test.step('the first reply is refused with a credits card that offers a way out', async () => {
        await agentPanel.sendMessage(FIRST_REPLY)
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveText([FIRST_REPLY])
        await expect(paywall).toBeVisible()
        await expect(paywall).toContainText(NO_FUNDS_REFUSAL.error.message)
        await expect(
          paywall.getByRole('button', {
            name: enMessages.agent.paywall.addCredits
          })
        ).toBeVisible()
        // One stop, one alert: the inline refusal card must not be joined by
        // the standing card now that the thread has a user message.
        await expect(agentPanel.root.getByRole('alert')).toHaveCount(1)
      })
    })
  }
)
