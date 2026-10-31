import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

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
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem(
            'Comfy.AgentPanel.onboarded.test-user-e2e.ws-personal'
          )
        )
      )
      .toBe('false')
  })

  test('points the first card at the highlighted panel and answers clicks on it', async ({
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
    const arrow = page.getByTestId('agent-coach-arrow')
    const spotlight = page.getByTestId('agent-coach-spotlight')
    await expect(arrow).toHaveCSS('visibility', 'visible')
    await expect
      .poll(async () => {
        const [arrowBox, spotlightBox] = await Promise.all([
          arrow.boundingBox(),
          spotlight.boundingBox()
        ])
        if (!arrowBox || !spotlightBox) return null
        return {
          leftOfSpotlight: arrowBox.x < spotlightBox.x,
          centersAligned:
            Math.abs(
              arrowBox.y +
                arrowBox.height / 2 -
                (spotlightBox.y + spotlightBox.height / 2)
            ) < 4
        }
      })
      .toEqual({ leftOfSpotlight: true, centersAligned: true })

    const spotlightBox = await spotlight.boundingBox()
    if (!spotlightBox) throw new Error('spotlight has no box')
    await page.mouse.click(
      spotlightBox.x + spotlightBox.width / 2,
      spotlightBox.y + spotlightBox.height / 2
    )

    await expect(firstCard).toBeFocused()
    await expect(firstCard).toBeVisible()
  })

  test('replays the tour from the header after it has been completed', async ({
    page,
    agentFlagEnabled
  }) => {
    // DES-1208's replay path. The header control is the only way back into the
    // tour once it is done, and nothing else covers it end to end.
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

    // Replay starts at card one, not wherever the finished tour left off.
    await expect(firstCard).toBeVisible()
    await expect(
      firstCard.getByRole('button', {
        name: enMessages.onboardingCoachmarks.back
      })
    ).toHaveCount(0)

    // The persisted flag has to clear too, or a reload re-hides a tour the
    // user just asked to see.
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem(
            'Comfy.AgentPanel.onboarded.test-user-e2e.ws-personal'
          )
        )
      )
      .not.toBe('true')
  })

  test('walks every accessible card and persists completion', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled, {
      onboardingCompleted: false
    })
    const agentPanel = new AgentPanel(page)
    await agentPanel.open()
    const intro = await agentPanel.expectTourCard(
      enMessages.agent.coachTitle,
      enMessages.agent.coachBody,
      '1 of 3'
    )
    await expect(agentPanel.tourSkipButton(intro)).toHaveCount(1)
    await intro.getByRole('button', { name: enMessages.g.next }).click()

    const workflow = await agentPanel.expectTourCard(
      enMessages.agent.coachWorkflowTitle,
      enMessages.agent.coachWorkflowBody,
      '2 of 3'
    )
    await expect(agentPanel.tourSkipButton(workflow)).toHaveCount(1)
    await workflow.getByRole('button', { name: enMessages.g.next }).click()

    const history = await agentPanel.expectTourCard(
      enMessages.agent.coachHistoryTitle,
      enMessages.agent.coachHistoryBody,
      '3 of 3'
    )
    await expect(agentPanel.tourSkipButton(history)).toHaveCount(0)
    await history
      .getByRole('button', { name: enMessages.onboardingCoachmarks.done })
      .click()

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

  test('Escape leaves the last card, which has no Skip button', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled, {
      onboardingCompleted: false
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

    const history = await agentPanel.expectTourCard(
      enMessages.agent.coachHistoryTitle,
      enMessages.agent.coachHistoryBody,
      '3 of 3'
    )
    await expect(agentPanel.tourSkipButton(history)).toHaveCount(0)

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('agent-coach-spotlight')).toHaveCount(0)
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
