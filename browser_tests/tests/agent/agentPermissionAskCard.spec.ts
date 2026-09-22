import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  PERMISSION_ASK_OPTIONS,
  THINKING_EVENT,
  THINKING_TEXT,
  agentAskEvent,
  agentAskResolvedEvent,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

// A `permission` ask is the local agent asking to reach a folder or a website.
// It used to fall through to nothing, leaving the turn waiting on a prompt the
// user could not see or answer.
const test = mergeTests(agentTest, webSocketFixture)

test.describe('Agent permission ask card', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test.beforeEach(async ({ agentPanel, getWebSocket }) => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()
    await agentPanel.sendPrompt('Use the reference images in my folder')
    const ws = await getWebSocket()
    // A frame the panel only renders once the turn is active, so the ask
    // below cannot race the turn's acceptance.
    ws.send(JSON.stringify(THINKING_EVENT))
    await expect(agentPanel.root.getByText(THINKING_TEXT)).toBeVisible()
  })

  test('Allow posts the answer, locks the card, and the resolution removes it', async ({
    agentPanel,
    askAnswers,
    getWebSocket
  }) => {
    const panel = agentPanel.root
    const target = '/Users/me/Pictures/references'
    const reason = 'Read the reference images you mentioned'
    const allow = agentPanel.permissionAllowButton
    const deny = agentPanel.permissionDenyButton
    const ws = await getWebSocket()

    await test.step('the card names the folder and the reason', async () => {
      ws.send(
        JSON.stringify(
          agentAskEvent({
            ask_id: 'ask-permission-path',
            kind: 'permission',
            prompt: 'Allow the agent to read this folder?',
            options: PERMISSION_ASK_OPTIONS,
            min_selections: 1,
            max_selections: 1,
            allow_other: false,
            context: {
              request_id: 'request-path',
              target_kind: 'path',
              target,
              reason
            }
          })
        )
      )
      await expect(
        panel.getByText(enMessages.agent.permissionAsk.leadPath)
      ).toBeVisible()
      await expect(panel.getByText(target, { exact: true })).toBeVisible()
      await expect(panel.getByText(`Why: ${reason}`)).toBeVisible()
      await expect(allow).toBeEnabled()
      await expect(deny).toBeEnabled()
    })

    await test.step('Allow posts the selection and disables both actions', async () => {
      await allow.click()
      await expect.poll(() => askAnswers).toHaveLength(1)
      expect(askAnswers[0].path).toMatch(
        /\/agent\/threads\/[^/]+\/asks\/ask-permission-path\/answer$/
      )
      expect(askAnswers[0].body).toEqual({ selected: ['allow'] })
      // Held until the server's resolution frame, so a second click cannot
      // answer twice.
      await expect(allow).toBeDisabled()
      await expect(deny).toBeDisabled()
    })

    await test.step('the resolution frame removes the card', async () => {
      ws.send(
        JSON.stringify(agentAskResolvedEvent('ask-permission-path', ['allow']))
      )
      await expect(panel.getByText(target, { exact: true })).toBeHidden()
      await expect(allow).toBeHidden()
      await expect(deny).toBeHidden()
      expect(askAnswers).toHaveLength(1)
    })
  })

  test('Deny on a website ask posts deny', async ({
    agentPanel,
    askAnswers,
    getWebSocket
  }) => {
    const panel = agentPanel.root
    const target = 'api.example.com'
    const ws = await getWebSocket()

    ws.send(
      JSON.stringify(
        agentAskEvent({
          ask_id: 'ask-permission-host',
          kind: 'permission',
          prompt: 'Allow the agent to connect to this website?',
          options: PERMISSION_ASK_OPTIONS,
          min_selections: 1,
          max_selections: 1,
          allow_other: false,
          context: {
            request_id: 'request-host',
            target_kind: 'host',
            target,
            reason: 'Download the model weights'
          }
        })
      )
    )
    await expect(
      panel.getByText(enMessages.agent.permissionAsk.leadHost)
    ).toBeVisible()
    await expect(panel.getByText(target, { exact: true })).toBeVisible()

    await agentPanel.permissionDenyButton.click()
    await expect.poll(() => askAnswers).toHaveLength(1)
    expect(askAnswers[0].body).toEqual({ selected: ['deny'] })

    ws.send(
      JSON.stringify(agentAskResolvedEvent('ask-permission-host', ['deny']))
    )
    await expect(panel.getByText(target, { exact: true })).toBeHidden()
  })
})
