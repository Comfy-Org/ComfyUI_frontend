import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentAskTest as test } from '@e2e/fixtures/agentAskTurnFixture'
import {
  DELETE_APPROVAL_PROMPT,
  RUN_ASK_ID,
  answerPath,
  askExpired,
  askResolved,
  askTurnIds,
  askIdFor,
  deleteApprovalFrame,
  runApprovalAsk,
  toolCall
} from '@e2e/fixtures/data/agent/agentAskFrames'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

// The consent contract this suite pins (fire-2, PM-1494 / PM-1450, slack-18):
// a run_approval ask blocks the run on the user's explicit answer. The server
// holds the run; the panel's whole job is to show the card, send exactly the
// answer the user picked, and never answer on its own. Three independent
// 2026-09-21 reports ("Ask mode doesn't ask to run the workflow") came from
// the server-side gate being disabled while the picker still said Ask — so
// this suite also guards the client half: no code path may self-approve a
// spend, whatever the stored preference claims.

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

    test('an expired card closes without answering', async ({
      startAskTurn
    }) => {
      const { panel, send, answers } = await startAskTurn(
        'Run it.',
        'ask_approval'
      )
      const cardLead = panel.getByText(enMessages.agent.runApproval.leadBound)
      const runButton = panel.getByRole('button', {
        name: enMessages.agent.runApproval.run,
        exact: true
      })

      send(runApprovalAsk())
      await expect(cardLead).toBeVisible()
      await expect(runButton).toBeEnabled()

      send(askExpired())
      await expect(cardLead).toHaveCount(0)
      await expect(runButton).toHaveCount(0)

      const draft = 'The approval expired.'
      send({
        type: 'agent_message_draft',
        data: { text: draft, ...askTurnIds }
      })
      await expect(panel.getByText(draft, { exact: true })).toBeVisible()
      expect(answers()).toHaveLength(0)
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
  'Agent delete approval',
  { tag: ['@cloud', '@agent', '@screenshot'] },
  () => {
    test.use({ viewport: { width: 1920, height: 1280 } })

    test('the card names the nodes and answers only the ask it shows', async ({
      startAskTurn
    }) => {
      const askId = askIdFor('call-delete')
      const { panel, send, answers, holdAnswer } = await startAskTurn(
        'Tidy up.',
        'auto'
      )
      const nodes = panel.getByRole('list', {
        name: enMessages.agent.deleteApproval.nodes
      })
      const deleteButton = panel.getByRole('button', {
        name: enMessages.agent.deleteApproval.delete,
        exact: true
      })
      const keepButton = panel.getByRole('button', {
        name: enMessages.agent.deleteApproval.keep,
        exact: true
      })

      await test.step('the card lists the nodes it would delete', async () => {
        send(deleteApprovalFrame(askId))
        await expect(panel.getByText(DELETE_APPROVAL_PROMPT)).toBeVisible()
        await expect(nodes.getByRole('listitem')).toHaveText([
          /Hero sampler\s*#12/,
          /VAEDecode\s*#13/
        ])
        await expect(deleteButton).toBeEnabled()
        await expect(keepButton).toBeEnabled()
        await expectElementScreenshot(
          panel.getByRole('group', {
            name: enMessages.agent.deleteApproval.card
          }),
          'agent-delete-approval-card.png'
        )
      })

      await test.step('the click posts once, to that ask, and locks the card', async () => {
        const release = await holdAnswer(askId)
        await deleteButton.click()
        await expect(deleteButton).toBeDisabled()
        await expect(keepButton).toBeDisabled()

        release()
        await expect.poll(() => answers().length).toBe(1)
        expect(answers()[0]).toEqual({
          path: answerPath(askId),
          body: { selected: ['delete'] }
        })
      })

      await test.step('the resolved card reads back the answer', async () => {
        send(askResolved(['delete'], askId))
        await expect(
          panel.getByRole('status').filter({ hasText: 'Answered: delete them' })
        ).toBeVisible()
        await expect(deleteButton).toHaveCount(0)
      })
    })
  }
)
