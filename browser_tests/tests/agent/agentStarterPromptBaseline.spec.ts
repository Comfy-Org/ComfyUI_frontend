import { expect, mergeTests } from '@playwright/test'

import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'
import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, hostTelemetryFixture, webSocketFixture)

test.describe('Agent starter prompt baseline', { tag: '@cloud' }, () => {
  test.use({
    connectWebSocketToServer: false,
    initialFeatureFlags: {
      enable_telemetry: true,
      'agent-starter-prompt-set': 'control'
    }
  })

  test('renders and attributes the winning static prompt without the retired flag', async ({
    agentPanel,
    hostTelemetry
  }) => {
    const prompt = enMessages.agent.suggestedPrompts.treatment.cloud[0]

    await agentPanel.open()
    await agentPanel.selectWorkflow()
    await agentPanel.root.getByRole('button', { name: prompt }).click()
    await expect(agentPanel.composer).toHaveText(prompt)
    await agentPanel.sendButton.click()

    await expect
      .poll(() =>
        hostTelemetry.find(
          ({ event }) => event === 'app:agent_starter_prompt_clicked'
        )
      )
      .toBeDefined()
    const clickEvent = hostTelemetry.find(
      ({ event }) => event === 'app:agent_starter_prompt_clicked'
    )
    expect(clickEvent?.properties).not.toHaveProperty(
      '$feature/agent-starter-prompt-set'
    )
    expect(
      hostTelemetry.find(
        ({ event }) => event === 'app:agent_starter_prompt_exposure'
      )
    ).toBeUndefined()
    await expect
      .poll(() =>
        hostTelemetry.find(({ event }) => event === 'app:agent_message_sent')
      )
      .toBeDefined()
    expect(
      hostTelemetry.find(({ event }) => event === 'app:agent_message_sent')
        ?.properties
    ).not.toHaveProperty('$feature/agent-starter-prompt-set')
  })
})
