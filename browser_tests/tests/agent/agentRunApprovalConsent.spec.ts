import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentAskTest as test } from '@e2e/fixtures/agentAskTurnFixture'
import {
  ASK_USER_QUESTION,
  RUN_ASK_ID,
  answerPath,
  askCancelled,
  askIdFor,
  askResolved,
  askTurnIds,
  askUserQuestionFrame,
  pausedAskFrame,
  runApprovalAsk,
  singleChoiceQuestionFrame,
  toolCall
} from '@e2e/fixtures/data/agent/agentAskFrames'

test.describe(
  'Agent run approval consent',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('in Ask mode the run waits on the card, and only the user’s click answers it', async ({
      startAskTurn
    }) => {
      test.setTimeout(60_000)
      const { panel, send, answers } = await startAskTurn(
        'Run it.',
        'ask_approval'
      )
      const cardLead = panel.getByText(enMessages.agent.runApproval.leadBound)
      const runButton = panel.getByRole('button', {
        name: enMessages.agent.runApproval.run,
        exact: true
      })
      const cancelButton = panel.getByRole('button', {
        name: enMessages.agent.runApproval.cancel,
        exact: true
      })

      await test.step('the card alone answers nothing', async () => {
        send(runApprovalAsk())
        await expect(cardLead).toBeVisible()
        await expect(runButton).toBeEnabled()
        await expect(cancelButton).toBeEnabled()
        expect(answers()).toHaveLength(0)
      })

      await test.step('the click answers exactly the ask shown, once', async () => {
        await runButton.click()
        await expect.poll(() => answers().length).toBe(1)
        expect(answers()[0]).toEqual({
          path: answerPath(RUN_ASK_ID),
          body: { selected: ['run'] }
        })
        await expect(runButton).toBeDisabled()
        await expect(cancelButton).toBeDisabled()
        expect(answers()).toHaveLength(1)
      })

      await test.step('the resolved run shows up as activity', async () => {
        send(askResolved(['run']))
        await expect(cardLead).toHaveCount(0)
        const runActivity = panel
          .getByRole('listitem')
          .filter({ hasText: 'Run' })
        await expect(runActivity).toHaveCount(0)
        send(toolCall('run', 'running'))
        await expect(runActivity.first()).toBeVisible()
      })

      await test.step('the turn finishes without another answer', async () => {
        send(toolCall('run', 'success'))
        const done = 'Submitted. I will report back when it finishes.'
        send({
          type: 'agent_message_delta',
          data: { delta: done, ...askTurnIds }
        })
        send({
          type: 'agent_message_done',
          data: { ...askTurnIds, usage: null }
        })
        await expect(panel.getByText(done, { exact: true })).toBeVisible()
        expect(answers()).toHaveLength(1)
      })
    })

    test('declining the card answers cancel exactly once', async ({
      startAskTurn
    }) => {
      test.setTimeout(60_000)
      const { panel, send, answers } = await startAskTurn(
        'Run it.',
        'ask_approval'
      )
      const cardLead = panel.getByText(enMessages.agent.runApproval.leadBound)

      send(runApprovalAsk())
      await expect(cardLead).toBeVisible()
      await panel
        .getByRole('button', {
          name: enMessages.agent.runApproval.cancel,
          exact: true
        })
        .click()
      await expect.poll(() => answers().length).toBe(1)
      expect(answers()[0]).toEqual({
        path: answerPath(RUN_ASK_ID),
        body: { selected: ['cancel'] }
      })

      send(askResolved(['cancel']))
      await expect(cardLead).toHaveCount(0)
      const done = 'Understood — I won’t run it.'
      send({
        type: 'agent_message_delta',
        data: { delta: done, ...askTurnIds }
      })
      send({ type: 'agent_message_done', data: { ...askTurnIds, usage: null } })
      await expect(panel.getByText(done, { exact: true })).toBeVisible()
      expect(answers()).toHaveLength(1)
    })

    test('the panel never answers a run approval by itself, whatever the stored preference says', async ({
      startAskTurn
    }) => {
      test.setTimeout(60_000)
      const { panel, send, answers } = await startAskTurn('Run it.', 'auto')
      const cardLead = panel.getByText(enMessages.agent.runApproval.leadBound)
      const runButton = panel.getByRole('button', {
        name: enMessages.agent.runApproval.run,
        exact: true
      })

      send(runApprovalAsk())
      await expect(cardLead).toBeVisible()
      await expect(runButton).toBeEnabled()

      await test.step('a later frame has been processed', async () => {
        const draft = 'Waiting on your approval.'
        send({
          type: 'agent_message_draft',
          data: { text: draft, ...askTurnIds }
        })
        await expect(panel.getByText(draft, { exact: true })).toBeVisible()
      })

      expect(answers()).toHaveLength(0)
      await expect(runButton).toBeEnabled()
      await expect(cardLead).toBeVisible()
    })
  }
)

test.describe(
  'Agent ask_user question',
  { tag: ['@cloud', '@agent', '@screenshot'] },
  () => {
    test.use({ viewport: { width: 1920, height: 1280 } })

    test('the question card posts its answer to its ask and reads back the committed answer', async ({
      startAskTurn
    }) => {
      const askId = askIdFor('call-ask')
      const { panel, send, answers } = await startAskTurn('Paint it.', 'auto')
      const card = panel.getByRole('group', {
        name: enMessages.agent.askUser.card
      })
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
          ['Oil painting', 'Other: watercolor']
        )
        await expect(card).toHaveScreenshot('agent-ask-user-card-answered.png')
      })
    })

    test('each card state renders as its own card', async ({
      startAskTurn
    }) => {
      const { panel, send, holdAnswer, refuseAnswer, questionCard } =
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
        await questionCard('Which first?').getByText('Oil painting').click()
        const submit = questionCard('Which first?').getByRole('button', {
          name: enMessages.g.submit
        })
        await submit.click()
        await expect(submit).toBeDisabled()
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
        await questionCard('Which size?').getByText('Oil painting').click()
        await questionCard('Which size?')
          .getByRole('button', { name: enMessages.g.submit })
          .click()
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
        await questionCard('Which light?').getByText('Oil painting').click()
        await questionCard('Which light?')
          .getByRole('button', { name: enMessages.g.submit })
          .click()
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
