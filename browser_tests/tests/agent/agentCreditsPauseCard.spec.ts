import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentAskTest as test } from '@e2e/fixtures/agentAskTurnFixture'
import {
  answerPath,
  askIdFor,
  pausedAskFrame
} from '@e2e/fixtures/data/agent/agentAskFrames'

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
        'It will try again on its own in about 60 seconds.'
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

  test('keeps the credits stop on screen when Resume cannot be confirmed', async ({
    startAskTurn
  }) => {
    const askId = askIdFor('call-paused')
    const { panel, send, refuseAnswer } = await startAskTurn(
      'Build me a sketch-to-image workflow.',
      'auto'
    )
    const pauseCard = panel
      .getByRole('alert')
      .filter({ hasText: enMessages.agent.paused.titleNoFunds })
    const resume = pauseCard.getByRole('button', {
      name: enMessages.agent.paused.resume
    })

    send(pausedAskFrame(askId))
    await expect(pauseCard).toBeVisible()

    await refuseAnswer(askId, 500)
    await resume.click()
    await expect(resume).toBeDisabled()
    await expect(resume).toBeEnabled()

    await expect(pauseCard).toBeVisible()
    await expect(pauseCard).toContainText('Paused until credits are added.')
    await expect(panel.getByText(enMessages.agent.askUnavailable)).toHaveCount(
      0
    )
  })
})
