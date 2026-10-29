import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentAskTest as test } from '@e2e/fixtures/agentAskTurnFixture'
import {
  answerPath,
  askIdFor,
  pausedAskFrame
} from '@e2e/fixtures/data/agent/agentAskFrames'

/**
 * PM-1649. A hobbyist on 1.58.0 reported the agent "just stops when credits are
 * used up. There is no warning; it just stops in the middle of building a
 * workflow ... I have an unfinished workflow no idea what it was trying to
 * build."
 *
 * The server already says exactly what happened: admission parks the turn and
 * raises a `paused` ask carrying `reason: no_funds` and its own user-ready copy.
 * That card is unnegotiated — the API contract says it "is raised for every
 * client" — but the panel listed `paused` nowhere in RENDERED_ASK_KINDS, so the
 * ask fell through to the generic "waiting on a step this panel can't show"
 * notice and the credits reason was dropped on the floor.
 *
 * So this asserts the user-visible half of that report: the stop is named as a
 * credits stop, the work already done is still on screen, and there is a way
 * out.
 */
test.describe('Agent credits pause card', { tag: ['@cloud', '@agent'] }, () => {
  test('names a mid-task credits stop and offers a way out', async ({
    startAskTurn
  }) => {
    const askId = askIdFor('call-paused')
    const { panel, send, answers } = await startAskTurn(
      'Build me a sketch-to-image workflow.',
      'auto'
    )
    const pauseCard = panel
      .getByRole('alert')
      .filter({ hasText: enMessages.agent.paused.titleNoFunds })

    await test.step('the pause reads as a credits stop, not an unshowable step', async () => {
      send(pausedAskFrame(askId))
      await expect(pauseCard).toBeVisible()
      await expect(pauseCard).toContainText('Paused until credits are added.')
      await expect(
        panel.getByText(enMessages.agent.askUnavailable)
      ).toHaveCount(0)
    })

    await test.step('the turn it was partway through is still on screen', async () => {
      await expect(
        panel.getByText('Build me a sketch-to-image workflow.').first()
      ).toBeVisible()
    })

    await test.step('it says the agent retries on its own', async () => {
      await expect(pauseCard).toContainText(
        enMessages.agent.paused.recheck.replace('{seconds}', '60')
      )
    })

    await test.step('resuming answers that ask, once', async () => {
      await pauseCard
        .getByRole('button', { name: enMessages.agent.paused.resume })
        .click()
      await expect.poll(() => answers().length).toBe(1)
      expect(answers()[0]).toEqual({
        path: answerPath(askId),
        body: { selected: ['resume'] }
      })
    })
  })
})
