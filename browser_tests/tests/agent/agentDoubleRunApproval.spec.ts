import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import {
  RUN_APPROVAL_EVENT,
  agentTurnLockTest as test,
  turnTextEvent
} from '@e2e/fixtures/agentTurnLockFixture'

const BUILD_PROMPT = 'make me a Flux Krea text to image workflow'
const AGENT_RUN_OFFER =
  'The workflow is built and validated. Want me to run it?'
const USER_RUN_CONSENT = 'yes, run it'

test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test.describe(
  'PM-2122 repro: the agent asks for run approval twice',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test('a run the person already agreed to in chat is not gated by a second approval card', async ({
      turnLock
    }) => {
      test.fail(
        true,
        'PM-2122: on an Ask run mode turn the agent offers the run in prose, and after the person says yes its run call is still parked on a run_approval card. This spec replays that server frame sequence; it passes once the agent stops sending the second ask (cloud agent run gate / prompt), and the replayed sequence is updated to match.'
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
        await turnLock.composer.fill(USER_RUN_CONSENT)
        await turnLock.sendButton.click()
        await expect(turnLock.userBubbles.last()).toHaveText(USER_RUN_CONSENT)
      })

      await test.step('the agent runs without asking again', async () => {
        turnLock.push(await turnLock.liveSocket(), RUN_APPROVAL_EVENT)
        const secondAsk = turnLock.panel
          .getByText(enMessages.agent.runApproval.question)
          .or(turnLock.runApprovalButton)
        const quietWindowStartedAt = Date.now()
        await expect(async () => {
          await expect(secondAsk).toHaveCount(0, { timeout: 0 })
          expect(Date.now() - quietWindowStartedAt).toBeGreaterThanOrEqual(
            2_000
          )
        }).toPass({ timeout: 4_000, intervals: [100, 250, 500] })
      })
    })
  }
)
