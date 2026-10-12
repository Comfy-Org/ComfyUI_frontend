import { expect, mergeTests } from '@playwright/test'

import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'
import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, hostTelemetryFixture, webSocketFixture)

test.describe('Agent starter prompt experiment', { tag: '@cloud' }, () => {
  test.use({
    connectWebSocketToServer: false,
    initialFeatureFlags: { enable_telemetry: true },
    starterPromptSet: 'test'
  })

  test('reports the treatment exposure and carries the arm onto the send', async ({
    agentPanel,
    hostTelemetry
  }) => {
    const treatmentPrompt = enMessages.agent.suggestedPrompts.treatment.cloud[0]

    await test.step('open the panel on the treatment arm', async () => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await expect
        .poll(() =>
          hostTelemetry.find(
            ({ event }) => event === 'app:agent_starter_prompt_exposure'
          )
        )
        .toEqual({
          event: 'app:agent_starter_prompt_exposure',
          properties: { '$feature/agent-starter-prompt-set': 'test' }
        })
    })

    await test.step('send a treatment starter prompt', async () => {
      await agentPanel.root
        .getByRole('button', { name: treatmentPrompt })
        .click()
      await expect(agentPanel.composer).toHaveText(treatmentPrompt)
      await agentPanel.sendButton.click()
      await expect
        .poll(
          () =>
            hostTelemetry.find(
              ({ event }) => event === 'app:agent_message_sent'
            )?.properties['$feature/agent-starter-prompt-set']
        )
        .toBe('test')
    })
  })
})
