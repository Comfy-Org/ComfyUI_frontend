import { expect } from '@playwright/test'

import {
  LATE_THINKING_EVENT,
  LATE_THINKING_TEXT,
  PERSISTED_AFTER_TOOL_TEXT,
  TURN_THINKING_TEXT,
  agentTurnLockTest as test
} from '@e2e/fixtures/agentTurnLockFixture'

// FRONT-3659. Reload while the agent is still working and the rounds it had
// already narrated do not come back when the turn finishes -- only what
// streamed after the reload shows, and the earlier reasoning reappears only
// once you leave the chat and open it again.
//
// The reload restores the running turn from the transcript, and a running row
// carries no reasoning: the backend writes `content.thinking` when the turn
// finishes (Comfy-Org/cloud#14903). So the panel follows the rest of the turn
// over the socket and settles on its terminal frame with nothing fetched,
// which is the one completion path that never reads the stored row back. The
// reconnect recovery does read it, which is why a dropped socket keeps the
// whole trace and a reload does not.
//
// Deliberately a reload, not a socket drop: agentTurnSurvivesSocketDrop covers
// that trigger and already goes through the reading path.
test.describe.configure({ timeout: 180_000 })
test.use({ connectWebSocketToServer: false })

/**
 * Transcript reads once the reload's recovery poll has run out of attempts:
 * one hydration GET plus one per `TURN_RECOVERY_DELAYS_MS` entry in
 * useAgentSession. Waiting for them is what makes the socket, not a poll,
 * the thing that settles the turn below -- a poll that happened to be in
 * flight when the turn ended would settle it through the reading path and
 * hide the defect.
 */
const READS_AFTER_RECOVERY_EXHAUSTED = 7

test(
  'restores the thinking from before a mid-turn reload when the turn finishes',
  {
    tag: ['@cloud', '@ui'],
    annotation: {
      type: 'source',
      description: 'https://linear.app/comfyorg/issue/FRONT-3659'
    }
  },
  async ({ page, turnLock, getAgentSocket }) => {
    const prompt = 'add an audio output node'

    await test.step('narrate a round, then reload mid-turn', async () => {
      await turnLock.openOnBlankWorkflow()
      await turnLock.startTurn(prompt)
      await expect(turnLock.panel.getByText(TURN_THINKING_TEXT)).toBeVisible()

      await page.reload()
      await expect(turnLock.panel).toBeVisible({ timeout: 30_000 })
      await expect(turnLock.userBubbles).toHaveText([prompt])
      await expect(turnLock.stopButton).toBeVisible()
      // The restored turn starts out with nothing from before the reload. That
      // is the premise of the report, not the defect: the defect is that
      // finishing the turn leaves it that way.
      await expect(turnLock.panel.getByText(TURN_THINKING_TEXT)).toHaveCount(0)
    })

    const socket =
      await test.step('narrate another round after the reload', async () => {
        await expect
          .poll(() => turnLock.transcriptReads(), { timeout: 90_000 })
          .toBeGreaterThanOrEqual(READS_AFTER_RECOVERY_EXHAUSTED)

        const live = await getAgentSocket()
        turnLock.push(live, LATE_THINKING_EVENT)
        await expect(turnLock.panel.getByText(LATE_THINKING_TEXT)).toBeVisible()
        return live
      })

    await test.step('finishing the turn shows both rounds beside the tool call', async () => {
      turnLock.finishTurn(socket)

      await expect(turnLock.sendButton).toBeVisible({ timeout: 30_000 })
      await expect(turnLock.stopButton).toHaveCount(0)
      await expect(turnLock.workSummary).toBeVisible()

      await turnLock.workSummary.click()
      await expect(turnLock.panel.getByRole('listitem')).toHaveText([
        TURN_THINKING_TEXT,
        /Add node/,
        LATE_THINKING_TEXT
      ])
      // The whole stored row landed, not just its reasoning: the reply the
      // turn ended on came from the same read.
      await expect(
        turnLock.panel.getByText(PERSISTED_AFTER_TOOL_TEXT)
      ).toBeVisible()
    })
  }
)
