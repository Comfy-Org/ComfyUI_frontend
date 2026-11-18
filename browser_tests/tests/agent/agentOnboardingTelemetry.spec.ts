import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'
import type { CapturedTelemetryEvent } from '@e2e/fixtures/hostTelemetryFixture'

const test = mergeTests(agentTest, hostTelemetryFixture)

const STEP_EVENT = 'app:agent_onboarding_step'

function stepEvents(captured: CapturedTelemetryEvent[]) {
  return captured
    .filter(({ event }) => event === STEP_EVENT)
    .map(({ properties }) => properties)
}

test.describe(
  'Agent onboarding tour telemetry',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test('reports Escape on the last card as finish', async ({
      page,
      hostTelemetry
    }) => {
      await bootAgentApp(page, true, {
        onboardingCompleted: false,
        features: { enable_telemetry: true }
      })
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()

      const intro = await agentPanel.expectTourCard(
        enMessages.agent.coachTitle,
        enMessages.agent.coachBody,
        '1 of 3'
      )
      await intro.getByRole('button', { name: enMessages.g.next }).click()
      const workflow = await agentPanel.expectTourCard(
        enMessages.agent.coachWorkflowTitle,
        enMessages.agent.coachWorkflowBody,
        '2 of 3'
      )
      await workflow.getByRole('button', { name: enMessages.g.next }).click()
      await agentPanel.expectTourCard(
        enMessages.agent.coachHistoryTitle,
        enMessages.agent.coachHistoryBody,
        '3 of 3'
      )

      await page.keyboard.press('Escape')

      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect
        .poll(() => stepEvents(hostTelemetry))
        .toEqual([
          { step: 1, card: 'intro', total: 3, action: 'next' },
          { step: 2, card: 'workflow', total: 3, action: 'next' },
          { step: 3, card: 'history', total: 3, action: 'finish' }
        ])
    })

    test('reports Escape on the first card as skip', async ({
      page,
      hostTelemetry
    }) => {
      await bootAgentApp(page, true, {
        onboardingCompleted: false,
        features: { enable_telemetry: true }
      })
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.expectTourCard(
        enMessages.agent.coachTitle,
        enMessages.agent.coachBody,
        '1 of 3'
      )

      await page.keyboard.press('Escape')

      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect
        .poll(() => stepEvents(hostTelemetry))
        .toEqual([{ step: 1, card: 'intro', total: 3, action: 'skip' }])
    })
  }
)
