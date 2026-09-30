import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import {
  RUN_APPROVAL_EVENT,
  RUN_APPROVAL_RESOLVED_EVENT,
  agentTurnLockTest as test
} from '@e2e/fixtures/agentTurnLockFixture'
import { TestIds } from '@e2e/fixtures/selectors'

// The worst shape a stall can take, from a real user report: they asked for an
// img2img workflow, then for img2video, and the panel went dead. They restarted
// the agent tab to get out of it.
//
// A session-id trace said the backend never hung. The turn was alive the whole
// time, parked waiting for the user to approve a tool call — and the approval
// prompt never made it into the panel. The product was working and waiting on
// the user; the user had no way to answer.
//
// The mechanism is the socket blip. `useAgentSession.onStatus(false)` answers a
// transient close with `abortActiveTurn()` + `dropBackgroundTurns()`, so the
// transport slot is null and the background map is empty. The server, which
// never learned the socket went away, then emits `agent_ask` for the approval
// it is parked on, and `agentConversationStore.ingest` has nothing to route it
// to: `ingestBackgroundTurnEvent` returns at `!entry` and the frame is gone.
// Nothing errors, the panel looks idle, the server looks healthy.
//
// A refresh restores the card from the persisted row's `pending_ask`; a socket
// blip does not. That asymmetry is why restarting the tab "fixed" it for the
// user and why this only ever showed up through a feedback form.
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test.describe(
  'approval ask recovery across socket drop and refresh',
  { tag: ['@cloud', '@ui'] },
  () => {
    const PROMPT = 'turn this image into a video'

    test.beforeEach(async ({ turnLock }) => {
      await turnLock.openOnBlankWorkflow()
      await turnLock.startTurn(PROMPT)
    })

    test('the approval card reaches the panel after a reconnect', async ({
      turnLock
    }) => {
      const reconnected = await turnLock.dropSocket()

      // Preconditions stay above the marker so a wiped thread or a lost prompt
      // reads as a real failure rather than the expected one.
      await expect(turnLock.userBubbles).toHaveText([PROMPT])

      // The server is parked on this ask and will not proceed without an
      // answer. `ws.send()` throws on a dead route, so pushing stays above
      // test.fail() too.
      turnLock.push(reconnected, RUN_APPROVAL_EVENT)
      expect(turnLock.pendingAskIsPrimed()).toBe(false)

      test.fail()
      await expect(
        turnLock.panel.getByText(enMessages.agent.runApproval.question)
      ).toBeVisible()
      await expect(turnLock.runApprovalButton).toBeVisible()
    })

    test('the user can answer the ask that arrived after the reconnect', async ({
      turnLock
    }) => {
      const reconnected = await turnLock.dropSocket()
      await expect(turnLock.userBubbles).toHaveText([PROMPT])
      turnLock.push(reconnected, RUN_APPROVAL_EVENT)
      expect(turnLock.pendingAskIsPrimed()).toBe(false)

      test.fail()
      // Recovery must restore both the card and its active turn identity;
      // `answerAsk` deliberately refuses to POST without `activeTurnId`.
      await turnLock.runApprovalButton.click({ timeout: 10_000 })
      await expect.poll(() => turnLock.answeredAsks()).toEqual(['run'])
    })

    // Keeps the locators above honest. If the approval card never renders under
    // this fixture at all — a changed testid, a gate, reworded copy — this case
    // reddens and the two expected failures above stop being evidence of the
    // defect they name.
    test('the same ask renders when the socket never drops', async ({
      turnLock
    }) => {
      const live = await turnLock.liveSocket()

      turnLock.push(live, RUN_APPROVAL_EVENT)
      expect(turnLock.pendingAskIsPrimed()).toBe(false)

      await expect(
        turnLock.panel.getByText(enMessages.agent.runApproval.question)
      ).toBeVisible()
      await turnLock.runApprovalButton.click()
      await expect.poll(() => turnLock.answeredAsks()).toEqual(['run'])
    })

    test('a refresh restores the persisted approval ask', async ({
      page,
      turnLock
    }) => {
      turnLock.primePendingAsk(RUN_APPROVAL_EVENT)

      await page.reload()
      await expect(
        page.getByTestId(TestIds.topbar.integratedTabBarActions)
      ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 30_000 })
      await expect(turnLock.panel).toBeVisible({ timeout: 30_000 })
      await expect(
        turnLock.panel.getByText(enMessages.agent.runApproval.question)
      ).toBeVisible({ timeout: 30_000 })

      await turnLock.runApprovalButton.click({ timeout: 10_000 })
      await expect
        .poll(() => turnLock.answeredAsks(), { timeout: 10_000 })
        .toEqual(['run'])

      turnLock.push(await turnLock.liveSocket(), RUN_APPROVAL_RESOLVED_EVENT)
      await expect(turnLock.runApprovalButton).toBeHidden({ timeout: 10_000 })
      expect(turnLock.answeredAsks()).toEqual(['run'])
    })
  }
)
