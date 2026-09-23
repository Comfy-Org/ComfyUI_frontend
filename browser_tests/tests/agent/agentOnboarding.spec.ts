import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

test.describe('Agent onboarding tour', { tag: ['@cloud', '@ui'] }, () => {
  test('walks all four accessible cards and persists completion', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled, {
      onboardingCompleted: false
    })
    await page
      .getByRole('button', { name: enMessages.agent.entryButton, exact: true })
      .click()
    const steps = [
      [enMessages.agent.coachTitle, enMessages.agent.coachBody],
      [enMessages.agent.coachWorkflowTitle, enMessages.agent.coachWorkflowBody],
      [enMessages.agent.coachGraphTitle, enMessages.agent.coachGraphBody],
      [enMessages.agent.coachHistoryTitle, enMessages.agent.coachHistoryBody]
    ] as const

    for (const [index, [title, description]] of steps.entries()) {
      const dialog = page.getByRole('dialog', { name: title })
      await expect(dialog).toBeVisible()
      await expect(dialog).toHaveAccessibleDescription(description)
      await expect(dialog).toContainText(`${index + 1} of ${steps.length}`)
      await expect(page.getByTestId('agent-coach-spotlight')).toBeVisible()
      await expect(dialog).toBeInViewport({ ratio: 1 })
      await dialog
        .getByRole('button', {
          name:
            index === steps.length - 1
              ? enMessages.onboardingCoachmarks.done
              : enMessages.g.next
        })
        .click()
    }

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem(
            'Comfy.AgentPanel.onboarded.test-user-e2e.ws-personal'
          )
        )
      )
      .toBe('true')

    await page.reload()
    await waitForCloudApp(page)
    await expect(page.locator('#agent-panel-root')).toBeVisible()
    await expect(
      page.getByRole('dialog', { name: enMessages.agent.coachTitle })
    ).toHaveCount(0)
  })
})
