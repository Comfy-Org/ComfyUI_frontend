import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'

import {
  agentTest as test,
  bootAgentApp,
  storedOnboardedScopes
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

const SCOPE_KEY = 'Comfy.AgentPanel.onboarded.test-user-e2e.ws-personal'

test.describe('Agent onboarding tour', { tag: ['@cloud', '@ui'] }, () => {
  test('returns to the previous card without completing the tour', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled, {
      onboardingCompleted: false
    })
    await new AgentPanel(page).open()

    const firstCard = page.getByRole('dialog', {
      name: enMessages.agent.coachTitle
    })
    await expect(firstCard).toBeVisible()
    await expect(
      firstCard.getByRole('button', {
        name: enMessages.onboardingCoachmarks.back
      })
    ).toHaveCount(0)
    await firstCard.getByRole('button', { name: enMessages.g.next }).click()

    const secondCard = page.getByRole('dialog', {
      name: enMessages.agent.coachWorkflowTitle
    })
    await expect(secondCard).toBeVisible()
    await secondCard
      .getByRole('button', {
        name: enMessages.onboardingCoachmarks.back
      })
      .click()

    await expect(firstCard).toBeVisible()
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), SCOPE_KEY))
      .toBe('false')
  })

  test('replays the tour from the header after it has been completed', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled, {
      onboardingCompleted: true
    })
    await new AgentPanel(page).open()

    const firstCard = page.getByRole('dialog', {
      name: enMessages.agent.coachTitle
    })
    await expect(firstCard).toBeHidden()

    await page
      .getByRole('button', { name: enMessages.agent.takeTour, exact: true })
      .click()

    await expect(firstCard).toBeVisible()
    await expect(
      firstCard.getByRole('button', {
        name: enMessages.onboardingCoachmarks.back
      })
    ).toHaveCount(0)

    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), SCOPE_KEY))
      .not.toBe('true')
  })

  test('walks all four accessible cards and persists completion', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled, {
      onboardingCompleted: false
    })
    await new AgentPanel(page).open()
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
      .poll(() => page.evaluate((key) => localStorage.getItem(key), SCOPE_KEY))
      .toBe('true')

    await expect.poll(() => storedOnboardedScopes(page)).toContain(SCOPE_KEY)
    await page.evaluate((key) => localStorage.removeItem(key), SCOPE_KEY)

    await page.reload()
    await waitForCloudApp(page)
    await expect(page.locator('#agent-composer')).toBeVisible()
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
    )
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
