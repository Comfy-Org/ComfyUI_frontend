import { expect } from '@playwright/test'

import {
  APPROVAL_WORKFLOW_NAME,
  RUN_APPROVAL_EVENT,
  TURN_IN_PROGRESS_MESSAGE,
  agentTurnLockTest as test
} from '@e2e/fixtures/agentTurnLockFixture'

// PM-1738, filed under PM-1199. Reported from the agent panel while building an
// img2img and then img2video workflow: "after generate workflow, agent stopped,
// I couldn't run but need to restart agent tab. Session was remained so that I
// could run again with existing session."
//
// The service side was never hung. Its logs show the turn accepted, then
// twenty-three minutes of silence, then two posts answered 409, then a GET of
// the transcript (the tab restart) and an `asks/.../answer` four seconds later
// — the user approving a tool call the moment a reload finally drew it. A turn
// parked on a run approval stays `streaming` for as long as the user takes to
// answer, so the socket drop that swallowed the `agent_ask` frame left the
// server waiting on a card the panel never drew: no way forward, and every
// follow-up message rejected by the single-active-turn guard.
//
// Distinct from agentTurnSurvivesSocketDrop.spec.ts, which drops the socket
// around a turn the server finishes on its own. Here the server cannot finish
// without an answer, so keeping the turn live is not enough — the ask itself
// has to come back.
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test.describe(
  'Agent approval ask across a transient websocket reconnect',
  { tag: ['@cloud', '@ui'] },
  () => {
    const PROMPT = 'build an img2img workflow and then turn it into img2video'

    test.beforeEach(async ({ turnLock }) => {
      await turnLock.openOnBlankWorkflow()
      await turnLock.startTurn(PROMPT)
    })

    test('surfaces an approval whose frame the drop swallowed, and resumes on it', async ({
      turnLock
    }) => {
      const nextPrompt = 'now raise the video length to 48 frames'

      const reconnected =
        await test.step('the turn parks on an approval whose frame never arrives', async () => {
          turnLock.parkOnApproval()
          await expect(turnLock.approvalCard).toHaveCount(0)
          return turnLock.dropSocket()
        })

      await test.step('the approval surfaces without a reload', async () => {
        await expect(turnLock.approvalCard).toBeVisible({ timeout: 30_000 })
        await expect(
          turnLock.panel.getByText(APPROVAL_WORKFLOW_NAME)
        ).toBeVisible()
        await expect(turnLock.stopButton).toBeVisible()
      })

      await test.step('answering it reaches the server', async () => {
        await turnLock.approveButton.click()

        await expect.poll(() => turnLock.answeredAsks().length).toBe(1)
        expect(turnLock.answeredAsks()[0]).toContain('toolu_')

        turnLock.resolveApproval(reconnected)
        await expect(turnLock.approvalCard).toHaveCount(0)
      })

      await test.step('the thread is usable again', async () => {
        turnLock.finishTurn(reconnected)
        await expect(turnLock.sendButton).toBeVisible()

        await turnLock.composer.fill(nextPrompt)
        await turnLock.sendButton.click()

        await expect(turnLock.userBubbles).toHaveCount(2)
        await expect(turnLock.userBubbles.last()).toHaveText(nextPrompt)
        await expect(
          turnLock.panel
            .getByRole('alert')
            .filter({ hasText: TURN_IN_PROGRESS_MESSAGE })
        ).toHaveCount(0)
        expect(turnLock.rejectedPosts()).toBe(0)
      })
    })

    // The recovery path re-delivers from the persisted row on every poll, so
    // without a guard an ask the socket did deliver would be drawn twice.
    test('does not redraw an approval the socket already delivered', async ({
      turnLock,
      getWebSocket
    }) => {
      turnLock.parkOnApproval()
      turnLock.push(await getWebSocket(), RUN_APPROVAL_EVENT)
      await expect(turnLock.approvalCard).toBeVisible()

      await turnLock.dropSocket()

      await expect(turnLock.approvalCard).toBeVisible()
      await expect(turnLock.approveButton).toHaveCount(1)
      // Outlasts the first two recovery polls (0s, then 1s), so a duplicate
      // card drawn by a later poll cannot slip past a one-shot assertion.
      await expect(turnLock.approvalCard).toHaveCount(1, { timeout: 5_000 })
    })
  }
)
