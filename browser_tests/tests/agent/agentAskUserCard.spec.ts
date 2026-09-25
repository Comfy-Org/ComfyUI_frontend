import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  ASK_USER_ANIMAL_OPTIONS,
  PERMISSION_ASK_OPTIONS,
  THINKING_EVENT,
  THINKING_TEXT,
  agentAskEvent,
  agentAskResolvedEvent,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

// An `ask_user` frame is untrusted input from the agent: the card must show
// every option it offered, hold the selection limit (typed Other text counts as
// one), post exactly what was chosen, and refuse to render an ask whose kind
// is missing rather than guess it is a harmless chooser.
const test = mergeTests(agentTest, webSocketFixture)

test.describe('Agent ask_user card', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test.beforeEach(async ({ agentPanel, getAgentSocket }) => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()
    await agentPanel.sendPrompt('Make a winter animal scene')
    const ws = await getAgentSocket()
    // A frame the panel only renders once the turn is active, so the ask
    // below cannot race the turn's acceptance.
    ws.send(JSON.stringify(THINKING_EVENT))
    await expect(agentPanel.root.getByText(THINKING_TEXT)).toBeVisible()
  })

  test('a multi-select ask holds its limit, counts Other text, and posts the trimmed answer', async ({
    agentPanel,
    askAnswers,
    getAgentSocket
  }) => {
    const panel = agentPanel.root
    const prompt = 'Which animals should be in the scene?'
    const other = agentPanel.askOtherInput
    const submit = agentPanel.askSubmitButton
    const ws = await getAgentSocket()

    await test.step('every option and its description is shown', async () => {
      ws.send(
        JSON.stringify(
          agentAskEvent({
            ask_id: 'ask-animals',
            kind: 'ask_user',
            prompt,
            options: ASK_USER_ANIMAL_OPTIONS,
            min_selections: 1,
            max_selections: 2,
            allow_other: true
          })
        )
      )
      await expect(panel.getByText(prompt)).toBeVisible()
      await expect(panel.getByText('Choose up to 2')).toBeVisible()
      await expect(agentPanel.askCheckboxes).toHaveCount(4)
      await expect(agentPanel.askRadios).toHaveCount(0)
      for (const { label, description } of ASK_USER_ANIMAL_OPTIONS) {
        await expect(agentPanel.askCheckbox(label)).toBeEnabled()
        await expect(
          panel.getByText(description, { exact: true })
        ).toBeVisible()
      }
      await expect(submit).toBeDisabled()
    })

    await test.step('one option plus typed Other text reaches the limit', async () => {
      await agentPanel.askCheckbox('Snowy owl').click()
      await expect(agentPanel.askCheckbox('Snowy owl')).toBeChecked()
      await expect(submit).toBeEnabled()

      await other.fill('  a sleeping lynx  ')
      await expect(agentPanel.askCheckbox('Snowy owl')).toBeEnabled()
      for (const label of ['Red fox', 'Arctic hare', 'Grey wolf'])
        await expect(agentPanel.askCheckbox(label)).toBeDisabled()
      await expect(other).toBeEnabled()
    })

    await test.step('Submit posts the selection and the trimmed text', async () => {
      await submit.click()
      await expect.poll(() => askAnswers).toHaveLength(1)
      expect(askAnswers[0].path).toMatch(
        /\/agent\/threads\/[^/]+\/asks\/ask-animals\/answer$/
      )
      expect(askAnswers[0].body).toEqual({
        selected: ['owl'],
        other_text: 'a sleeping lynx'
      })
      await expect(submit).toBeDisabled()
    })

    await test.step('the resolution frame removes the card', async () => {
      ws.send(JSON.stringify(agentAskResolvedEvent('ask-animals', ['owl'])))
      await expect(panel.getByText(prompt)).toBeHidden()
      await expect(agentPanel.askCheckboxes).toHaveCount(0)
      await expect(submit).toBeHidden()
    })
  })

  test('two options at the limit lock Other and post in option order', async ({
    agentPanel,
    askAnswers,
    getAgentSocket
  }) => {
    const ws = await getAgentSocket()

    ws.send(
      JSON.stringify(
        agentAskEvent({
          ask_id: 'ask-animals-order',
          kind: 'ask_user',
          prompt: 'Pick two animals',
          options: ASK_USER_ANIMAL_OPTIONS,
          min_selections: 1,
          max_selections: 2,
          allow_other: true
        })
      )
    )
    await agentPanel.askCheckbox('Grey wolf').click()
    await agentPanel.askCheckbox('Red fox').click()

    await expect(agentPanel.askOtherInput).toBeDisabled()
    await expect(agentPanel.askCheckbox('Snowy owl')).toBeDisabled()

    await agentPanel.askSubmitButton.click()
    await expect.poll(() => askAnswers).toHaveLength(1)
    expect(askAnswers[0].body).toEqual({ selected: ['fox', 'wolf'] })
  })

  test('a required single choice renders radios and drops duplicate options', async ({
    agentPanel,
    askAnswers,
    getAgentSocket
  }) => {
    const panel = agentPanel.root
    const ws = await getAgentSocket()

    ws.send(
      JSON.stringify(
        agentAskEvent({
          ask_id: 'ask-style',
          kind: 'ask_user',
          prompt: 'Which style?',
          options: [
            { id: 'photo', label: 'Photographic', description: null },
            { id: 'paint', label: 'Watercolor' },
            // The server keeps the first option with an id; so does the card.
            { id: 'photo', label: 'Duplicate photographic' }
          ],
          min_selections: 1,
          max_selections: 1,
          allow_other: false
        })
      )
    )

    await expect(panel.getByText('Which style?')).toBeVisible()
    await expect(agentPanel.askRadios).toHaveCount(2)
    await expect(agentPanel.askCheckboxes).toHaveCount(0)
    await expect(panel.getByText('Duplicate photographic')).toHaveCount(0)

    await agentPanel.askRadio('Watercolor').click()
    await agentPanel.askSubmitButton.click()
    await expect.poll(() => askAnswers).toHaveLength(1)
    expect(askAnswers[0].body).toEqual({ selected: ['paint'] })
  })

  test('an ask without a kind shows a notice instead of a question card', async ({
    agentPanel,
    getAgentSocket
  }) => {
    const panel = agentPanel.root
    const ws = await getAgentSocket()

    ws.send(
      JSON.stringify(
        agentAskEvent({
          ask_id: 'ask-without-kind',
          prompt: 'Allow the agent to read your home folder?',
          options: PERMISSION_ASK_OPTIONS,
          min_selections: 1,
          max_selections: 1,
          allow_other: false
        })
      )
    )

    await expect(panel.getByText(enMessages.agent.askUnavailable)).toBeVisible()
    await expect(
      panel.getByText('Allow the agent to read your home folder?')
    ).toHaveCount(0)
    await expect(agentPanel.askRadios).toHaveCount(0)
    await expect(agentPanel.askCheckboxes).toHaveCount(0)
    await expect(agentPanel.askSubmitButton).toHaveCount(0)
  })
})
