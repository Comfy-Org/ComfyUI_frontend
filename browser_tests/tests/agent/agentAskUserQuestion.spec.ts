import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentAskTest as test } from '@e2e/fixtures/agentAskTurnFixture'
import {
  ASK_USER_QUESTION,
  answerPath,
  askCancelled,
  askIdFor,
  askResolved,
  askUserQuestionFrame,
  pausedAskFrame,
  singleChoiceQuestionFrame
} from '@e2e/fixtures/data/agent/agentAskFrames'

test.describe(
  'Agent ask_user question',
  { tag: ['@cloud', '@agent', '@screenshot'] },
  () => {
    test.use({ viewport: { width: 1920, height: 1280 } })

    test('the question card posts its answer to its ask and reads back the committed answer', async ({
      startAskTurn
    }) => {
      const askId = askIdFor('call-ask')
      const { panel, send, answers, questionCard } = await startAskTurn(
        'Paint it.',
        'auto'
      )
      const card = questionCard(ASK_USER_QUESTION)
      const choices = panel.getByRole('group', { name: ASK_USER_QUESTION })

      await test.step('the question arrives as a card with every option', async () => {
        send(askUserQuestionFrame(askId))
        await expect(
          choices.getByRole('checkbox', { name: 'Oil painting' })
        ).toBeVisible()
        await expect(card).toHaveScreenshot('agent-ask-user-card.png')
      })

      await test.step('answering posts once, to that ask', async () => {
        await choices.getByRole('checkbox', { name: 'Oil painting' }).click()
        await panel
          .getByRole('textbox', { name: enMessages.agent.askUser.other })
          .fill('watercolor')
        await panel.getByRole('button', { name: enMessages.g.submit }).click()
        await expect.poll(() => answers().length).toBe(1)
        expect(answers()[0]).toEqual({
          path: answerPath(askId),
          body: { selected: ['oil'], other_text: 'watercolor' }
        })
      })

      await test.step('the resolved card reads back the committed answer', async () => {
        send(askResolved(['oil'], askId, { other_text: 'watercolor' }))
        await expect(card.getByRole('status').getByRole('listitem')).toHaveText(
          [
            'Oil painting',
            enMessages.agent.askUser.otherAnswer.replace('{text}', 'watercolor')
          ]
        )
        await expect(card).toHaveScreenshot('agent-ask-user-card-answered.png')
      })
    })

    test('a radio, in-flight, closed, refused and unconfirmed question and an unrenderable ask each show their own card', async ({
      startAskTurn
    }) => {
      const { panel, send, holdAnswer, refuseAnswer, questionCard, answer } =
        await startAskTurn('Paint it.', 'auto')

      await test.step('a single-choice question reads as radios', async () => {
        send(singleChoiceQuestionFrame(askIdFor('call-radio'), 'Which first?'))
        await expect(
          questionCard('Which first?').getByRole('radio', {
            name: 'Oil painting'
          })
        ).toBeEnabled()
        await expect(questionCard('Which first?')).toHaveScreenshot(
          'agent-ask-user-card-radio.png'
        )
      })

      await test.step('an answer in flight locks the card', async () => {
        const release = await holdAnswer(askIdFor('call-radio'))
        await answer('Which first?', 'Oil painting')
        await expect(
          questionCard('Which first?').getByRole('button', {
            name: enMessages.g.submit
          })
        ).toBeDisabled()
        await expect(questionCard('Which first?')).toHaveScreenshot(
          'agent-ask-user-card-in-flight.png'
        )
        release()
      })

      await test.step('a question closed without an answer says so', async () => {
        send(
          singleChoiceQuestionFrame(askIdFor('call-closed'), 'Which palette?')
        )
        send(askCancelled(askIdFor('call-closed')))
        await expect(questionCard('Which palette?')).toContainText(
          enMessages.agent.askUser.closed
        )
        await expect(questionCard('Which palette?')).toHaveScreenshot(
          'agent-ask-user-card-closed.png'
        )
      })

      await test.step('a refused answer leaves the card no longer open', async () => {
        await refuseAnswer(askIdFor('call-retired'), 403)
        send(singleChoiceQuestionFrame(askIdFor('call-retired'), 'Which size?'))
        await answer('Which size?', 'Oil painting')
        await expect(questionCard('Which size?')).toContainText(
          enMessages.agent.askUser.retired
        )
        await expect(questionCard('Which size?')).toHaveScreenshot(
          'agent-ask-user-card-retired.png'
        )
      })

      await test.step('an answer that may have landed reads as unconfirmed', async () => {
        await refuseAnswer(askIdFor('call-unconfirmed'), 500)
        send(
          singleChoiceQuestionFrame(
            askIdFor('call-unconfirmed'),
            'Which light?'
          )
        )
        await answer('Which light?', 'Oil painting')
        await expect(questionCard('Which light?')).toContainText(
          enMessages.agent.askUser.unconfirmed
        )
        await expect(questionCard('Which light?')).toHaveScreenshot(
          'agent-ask-user-card-unconfirmed.png'
        )
      })

      await test.step('an ask the panel cannot render shows a notice', async () => {
        send(pausedAskFrame(askIdFor('call-paused')))
        const notice = panel
          .getByRole('status')
          .filter({ hasText: enMessages.agent.askUnavailable })
        await expect(notice).toBeVisible()
        await expect(notice).toHaveScreenshot(
          'agent-ask-unavailable-notice.png'
        )
      })
    })
  }
)
