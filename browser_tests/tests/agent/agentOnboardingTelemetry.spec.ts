import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  capturedProperties,
  hostTelemetryFixture
} from '@e2e/fixtures/hostTelemetryFixture'

const test = mergeTests(agentTest, hostTelemetryFixture)

test.describe(
  'Agent onboarding tour telemetry',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test.beforeEach(async ({ page }) => {
      await bootAgentApp(page, true, {
        onboardingCompleted: false,
        features: { enable_telemetry: true }
      })
    })

    test('reports Escape on the last card as finish', async ({
      page,
      hostTelemetry
    }) => {
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
        .poll(() =>
          capturedProperties(hostTelemetry, 'app:agent_onboarding_step')
        )
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
        .poll(() =>
          capturedProperties(hostTelemetry, 'app:agent_onboarding_step')
        )
        .toEqual([{ step: 1, card: 'intro', total: 3, action: 'skip' }])
    })
  }
)
