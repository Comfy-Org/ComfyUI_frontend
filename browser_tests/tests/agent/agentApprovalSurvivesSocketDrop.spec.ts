import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  RUN_APPROVAL_EVENT,
  agentTurnLockTest as test
} from '@e2e/fixtures/agentTurnLockFixture'

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
// Deliberately not a refresh: on a refresh the ask comes back, because the
// persisted row carries `pending_ask` and `normalizeAgentTranscript` restores
// the card. That asymmetry is why restarting the tab "fixed" it for the user
// and why this only ever showed up through a feedback form.
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test.describe(
  'an approval ask survives a socket drop',
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

      test.fail()
      await expect(
        turnLock.panel.getByText(enMessages.agent.runApproval.question)
      ).toBeVisible()
      await expect(
        turnLock.panel.getByRole('button', {
          name: enMessages.agent.runApproval.run,
          exact: true
        })
      ).toBeVisible()
    })

    test('the user can answer the ask that arrived after the reconnect', async ({
      turnLock
    }) => {
      const reconnected = await turnLock.dropSocket()
      await expect(turnLock.userBubbles).toHaveText([PROMPT])
      turnLock.push(reconnected, RUN_APPROVAL_EVENT)

      test.fail()
      // Answering is the whole point: a card the user cannot act on leaves the
      // turn parked exactly as a missing card does.
      await turnLock.panel
        .getByRole('button', {
          name: enMessages.agent.runApproval.run,
          exact: true
        })
        .click({ timeout: 10_000 })
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

      await expect(
        turnLock.panel.getByText(enMessages.agent.runApproval.question)
      ).toBeVisible()
      await turnLock.panel
        .getByRole('button', {
          name: enMessages.agent.runApproval.run,
          exact: true
        })
        .click()
      await expect.poll(() => turnLock.answeredAsks()).toEqual(['run'])
    })

    // Asserting the wire shape here, not in the fixture, so a future edit to
    // RUN_APPROVAL_EVENT that made it unparseable would surface as a failed
    // assertion rather than as three silently-vacuous pushes.
    test('the fixture pushes an ask the client can parse', () => {
      const event: AgentWsEvent = RUN_APPROVAL_EVENT
      expect(event.type).toBe('agent_ask')
      expect(event.data).toMatchObject({ kind: 'run_approval' })
    })
  }
)
