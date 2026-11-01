import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'

import {
  agentTest as test,
  bootAgentApp,
  storedOnboardedScopes
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { expectRegionScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

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
      .poll(() => page.evaluate((key) => localStorage.getItem(key), SCOPE_KEY))
      .not.toBe('true')
  })

  test(
    'walks every accessible card and persists completion',
    {
      tag: '@screenshot'
    },
    async ({ page, agentFlagEnabled }) => {
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

      const arrow = page.getByTestId('agent-coach-arrow')
      const spotlight = page.getByTestId('agent-coach-spotlight')
      await expect(arrow).toHaveCSS('visibility', 'visible')
      await expect
        .poll(async () => {
          const [arrowBox, spotlightBox, cardBox] = await Promise.all([
            arrow.boundingBox(),
            spotlight.boundingBox(),
            intro.boundingBox()
          ])
          if (!arrowBox || !spotlightBox || !cardBox) return null
          return {
            onCardRightEdge:
              Math.abs(
                arrowBox.x + arrowBox.width / 2 - (cardBox.x + cardBox.width)
              ) < 4,
            leftOfSpotlight: arrowBox.x < spotlightBox.x,
            centersAligned:
              Math.abs(
                arrowBox.y +
                  arrowBox.height / 2 -
                  (spotlightBox.y + spotlightBox.height / 2)
              ) < 4
          }
        })
        .toEqual({
          onCardRightEdge: true,
          leftOfSpotlight: true,
          centersAligned: true
        })
      await expectRegionScreenshot(
        page,
        [intro, arrow],
        'agent-tour-card-arrow.png',
        { padding: 16 }
      )

      const spotlightBox = await spotlight.boundingBox()
      if (!spotlightBox) throw new Error('spotlight has no box')
      await page.clock.install()
      await page.clock.pauseAt(Date.now() + 1_000)
      await page.mouse.click(
        spotlightBox.x + spotlightBox.width / 2,
        spotlightBox.y + spotlightBox.height / 2
      )
      await expect(intro).toBeFocused()
      await expect(intro).toHaveAttribute('data-nudged')
      await expectRegionScreenshot(
        page,
        [intro, arrow],
        'agent-tour-card-nudged.png',
        { padding: 16 }
      )
      await page.clock.resume()

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
    }
  )

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
      .poll(() => page.evaluate((key) => localStorage.getItem(key), SCOPE_KEY))
      .toBe('true')

    // PM-2308: Desktop reaches the app on a new origin after a port change, so
    // the completion has to come back from the user setting rather than from
    // this origin's localStorage.
    await expect.poll(() => storedOnboardedScopes(page)).toContain(SCOPE_KEY)
    await page.evaluate((key) => localStorage.removeItem(key), SCOPE_KEY)

    await page.reload()
    await waitForCloudApp(page)
    // The composer only renders behind consent, the same gate as the coach,
    // and a card shows within a frame of it. Checking before that would pass
    // whether or not the setting was read.
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
