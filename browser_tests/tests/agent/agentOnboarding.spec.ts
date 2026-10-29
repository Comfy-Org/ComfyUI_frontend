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
    const agentPanel = new AgentPanel(page)
    await agentPanel.open()

    const intro = agentPanel.tourCard(enMessages.agent.coachTitle)
    await expect(intro.root).toBeVisible()
    await expect(intro.backButton).toHaveCount(0)
    await intro.nextButton.click()

    const workflow = agentPanel.tourCard(enMessages.agent.coachWorkflowTitle)
    await expect(workflow.root).toBeVisible()
    await workflow.backButton.click()

    await expect(intro.root).toBeVisible()
    await expect.poll(() => agentPanel.coachSeenFlag()).toBe('false')
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
    const agentPanel = new AgentPanel(page)
    await agentPanel.open()

    const intro = agentPanel.tourCard(enMessages.agent.coachTitle)
    await expect(intro.root).toBeHidden()

    await page
      .getByRole('button', { name: enMessages.agent.takeTour, exact: true })
      .click()

    // Replay starts at card one, not wherever the finished tour left off.
    await expect(intro.root).toBeVisible()
    await expect(intro.backButton).toHaveCount(0)

    // The persisted flag has to clear too, or a reload re-hides a tour the
    // user just asked to see.
    await expect.poll(() => agentPanel.coachSeenFlag()).not.toBe('true')
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

    const intro = agentPanel.tourCard(enMessages.agent.coachTitle)
    await intro.expectShown(enMessages.agent.coachBody, '1 of 3')
    await expect(intro.skipButton).toHaveCount(1)
    await intro.nextButton.click()

    const workflow = agentPanel.tourCard(enMessages.agent.coachWorkflowTitle)
    await workflow.expectShown(enMessages.agent.coachWorkflowBody, '2 of 3')
    await expect(workflow.skipButton).toHaveCount(1)
    await workflow.nextButton.click()

    const history = agentPanel.tourCard(enMessages.agent.coachHistoryTitle)
    await history.expectShown(enMessages.agent.coachHistoryBody, '3 of 3')
    await expect(history.skipButton).toHaveCount(0)
    await history.doneButton.click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect.poll(() => agentPanel.coachSeenFlag()).toBe('true')

    await page.reload()
    await waitForCloudApp(page)
    await expect(page.locator('#agent-panel-root')).toBeVisible()
    await expect(
      agentPanel.tourCard(enMessages.agent.coachTitle).root
    ).toHaveCount(0)
  })

  test('Escape leaves the last card, which has no Skip of its own', async ({
    page,
    agentFlagEnabled
  }) => {
    // PM-2396 dropped Skip from the last card because it duplicated Done.
    // That makes Escape the only way off that card short of completing the
    // tour, and only the unit tests covered it. If the key handler regresses,
    // a first-time user is left on a card they cannot dismiss -- and the walk
    // test above stays green, because it leaves by clicking Done.
    await bootAgentApp(page, agentFlagEnabled, {
      onboardingCompleted: false
    })
    const agentPanel = new AgentPanel(page)
    await agentPanel.open()

    const intro = agentPanel.tourCard(enMessages.agent.coachTitle)
    await expect(intro.root).toBeVisible()
    await intro.nextButton.click()

    const workflow = agentPanel.tourCard(enMessages.agent.coachWorkflowTitle)
    await expect(workflow.root).toBeVisible()
    await workflow.nextButton.click()

    const history = agentPanel.tourCard(enMessages.agent.coachHistoryTitle)
    await history.expectShown(enMessages.agent.coachHistoryBody, '3 of 3')
    await expect(history.skipButton).toHaveCount(0)
    await expect(history.doneButton).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(history.spotlight).toHaveCount(0)

    // Leaving by Escape still counts as seen. A dismissal that does not
    // persist brings the whole tour back on the next load, which is the same
    // trap from the other side.
    await expect.poll(() => agentPanel.coachSeenFlag()).toBe('true')

    await page.reload()
    await waitForCloudApp(page)
    await expect(page.locator('#agent-panel-root')).toBeVisible()
    await expect(intro.root).toHaveCount(0)
  })
})
