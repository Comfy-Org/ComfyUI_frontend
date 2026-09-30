import { expect } from '@playwright/test'

import {
  POST_RECONNECT_EVENT,
  POST_RECONNECT_TEXT,
  TURN_DONE_EVENT,
  TURN_IN_PROGRESS_MESSAGE,
  agentTurnLockTest as test
} from '@e2e/fixtures/agentTurnLockFixture'

// PM-1776 / PM-1682: this is a panel-only remount. The page stays loaded and
// the socket stays connected; PM-1043 and PM-1199 cover those other triggers.
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test.describe(
  'Agent turn across an agent-panel minimize and restore',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    const PROMPT = 'add an audio output node'

    // Minimizing and restoring around a turn the client never started, so it
    // keeps `minimizePanel`, `restorePanel`, `workingRow`, `workSummary` and
    // `sendButton` honest independently of any restore: `startTurn` only
    // resolves once a live `Working...` row is on screen, and the summary
    // below only resolves once a turn has actually ended.
    test('runs a turn to completion after a minimize and restore', async ({
      turnLock,
      getWebSocket
    }) => {
      await test.step('minimize and restore an idle panel', async () => {
        await turnLock.openOnBlankWorkflow()
        await turnLock.minimizePanel()
        await turnLock.restorePanel()
      })

      await test.step('run a turn to completion in the restored panel', async () => {
        await turnLock.startTurn(PROMPT)
        await expect(turnLock.workSummary).toHaveCount(0)

        turnLock.push(await getWebSocket(), TURN_DONE_EVENT)

        await expect(turnLock.workSummary).toBeVisible()
        await expect(turnLock.sendButton).toBeVisible()
      })
    })

    test.describe('minimized while a turn is still running', () => {
      test.beforeEach(async ({ turnLock }) => {
        await turnLock.openOnBlankWorkflow()
        await turnLock.startTurn(PROMPT)
      })

      test('keeps the turn marked as running after the panel is reopened', async ({
        turnLock
      }) => {
        await test.step('minimize while the turn is live', async () => {
          await expect(turnLock.workingRow).toBeVisible()
          await expect(turnLock.stopButton).toBeVisible()
          await expect(turnLock.workSummary).toHaveCount(0)

          await turnLock.minimizePanel()
          await turnLock.restorePanel()
        })

        await test.step('reopened panel still shows the turn running', async () => {
          await expect(turnLock.userBubbles).toHaveText([PROMPT])

          await expect(turnLock.liveProgressRow).toBeVisible()
          await expect(turnLock.stopButton).toBeVisible()
          await expect(turnLock.workSummary).toHaveCount(0)
        })
      })

      test('keeps rendering the turn after the panel is reopened', async ({
        turnLock,
        getWebSocket
      }) => {
        await test.step('minimize and reopen over the live turn', async () => {
          await turnLock.minimizePanel()
          await turnLock.restorePanel()

          await expect(turnLock.userBubbles).toHaveText([PROMPT])
        })

        await test.step('a later frame for that turn still renders', async () => {
          turnLock.push(await getWebSocket(), POST_RECONNECT_EVENT)

          await expect(
            turnLock.panel.getByText(POST_RECONNECT_TEXT)
          ).toBeVisible()
        })
      })

      test('settles when completion arrives after hydration handoff expires', async ({
        page,
        turnLock,
        getWebSocket
      }) => {
        await page.clock.install()
        turnLock.holdNextTranscript()

        await test.step('restore while live-turn hydration remains pending', async () => {
          await turnLock.minimizePanel()
          await turnLock.beginRestorePanel()
          await turnLock.waitForHeldTranscript()
          await page.clock.fastForward(30_001)
        })

        await test.step('accept terminal delivery before stale hydration resolves', async () => {
          turnLock.push(await getWebSocket(), TURN_DONE_EVENT)
          turnLock.releaseHeldTranscript()

          await expect(turnLock.workSummary).toBeVisible()
          await expect(turnLock.sendButton).toBeVisible()
          await expect(turnLock.stopButton).toHaveCount(0)
        })
      })

      test('does not reject the next message after the panel is reopened', async ({
        turnLock
      }) => {
        await test.step('reopened panel withholds Send', async () => {
          await turnLock.minimizePanel()
          await turnLock.restorePanel()

          await expect(turnLock.composer).toBeVisible()
          await expect(turnLock.userBubbles).toHaveText([PROMPT])

          // Composer renders Stop and Send as one button whose label flips, so
          // Send being absent IS Stop being offered: the restored turn
          // withholds the send the server would answer with 409.
          await expect(turnLock.sendButton).toHaveCount(0)
          await expect(turnLock.stopButton).toBeVisible()
        })

        await test.step('Enter does not post a second message', async () => {
          // Enter is the one affordance left that could still post. A running
          // turn swallows it, so the draft staying in the composer is the
          // settle that makes the three negative assertions below real checks
          // rather than ones that pass on a send still in flight.
          await turnLock.composer.fill('are you still there?')
          await turnLock.composer.press('Enter')
          await expect(turnLock.composer).toHaveText('are you still there?')

          await expect(turnLock.userBubbles).toHaveText([PROMPT])
          await expect(
            turnLock.panel
              .getByRole('alert')
              .filter({ hasText: TURN_IN_PROGRESS_MESSAGE })
          ).toHaveCount(0)
          expect(turnLock.postAttempts()).toBe(1)
          expect(turnLock.rejectedPosts()).toBe(0)
        })
      })
    })
  }
)
