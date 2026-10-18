import { expect } from '@playwright/test'

import type { AgentRunModePreference } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import {
  agentTurnLockTest as test,
  runApprovalEventFor,
  turnTextEvent
} from '@e2e/fixtures/agentTurnLockFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const BUILD_PROMPT = 'make me a Flux Krea text to image workflow'
const AGENT_RUN_OFFER =
  'The workflow is built and validated. Want me to run it?'
const USER_RUN_CONSENT = 'yes, run it'
const CONSENT_TURN_ID = '7c1e2a40-2122-4d6f-9b11-0c7a5e2f4318'

test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test.describe(
  'PM-2122 repro: the agent asks for run approval twice',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test('a run the person already agreed to in chat is not gated by a second approval card', async ({
      page,
      turnLock
    }) => {
      const askApproval: AgentRunModePreference = {
        mode: 'ask_approval',
        credit_limit: null
      }
      await page.route('**/api/agent/run-mode', (route) =>
        route.fulfill(jsonRoute(askApproval))
      )
      await turnLock.openOnBlankWorkflow()

      await test.step('the agent builds the workflow and offers to run it in chat', async () => {
        await turnLock.startTurn(BUILD_PROMPT)
        const live = await turnLock.liveSocket()
        turnLock.push(live, turnTextEvent(AGENT_RUN_OFFER))
        turnLock.finishTurn(live)
        await expect(turnLock.panel.getByText(AGENT_RUN_OFFER)).toBeVisible()
        await expect(turnLock.stopButton).toBeHidden()
      })

      await test.step('the person says yes in chat', async () => {
        turnLock.acceptNextTurnAs(CONSENT_TURN_ID)
        await turnLock.composer.fill(USER_RUN_CONSENT)
        await turnLock.sendButton.click()
        await expect(turnLock.userBubbles).toHaveText([
          BUILD_PROMPT,
          USER_RUN_CONSENT
        ])
      })

      await test.step('the agent replays the observed second ask', async () => {
        turnLock.push(
          await turnLock.liveSocket(),
          runApprovalEventFor(CONSENT_TURN_ID)
        )
        await expect(turnLock.runApprovalButton).toBeVisible()
        await expect(turnLock.panel.getByText(AGENT_RUN_OFFER)).toBeVisible()
      })

      test.fail(
        true,
        'PM-2122 repro: this replays the server frames the person saw (a prose run offer, then a run_approval card after they said yes). The fix belongs in the cloud agent run gate or prompt; it cannot turn this green, and the frontend must not hide a parked run_approval ask to do so. Update the replay when the agent stops sending the second ask.'
      )

      await test.step('the person is asked to approve the run only once', async () => {
        const runConsentPrompts =
          (await turnLock.panel.getByText(AGENT_RUN_OFFER).count()) +
          (await turnLock.runApprovalButton.count())
        expect(
          runConsentPrompts,
          'PM-2122: a prose run offer and a run approval card are both on screen'
        ).toBe(1)
      })
    })
  }
)
