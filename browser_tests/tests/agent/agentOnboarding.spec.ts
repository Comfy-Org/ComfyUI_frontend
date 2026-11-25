import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'

import {
  AGENT_ONBOARDING_SCOPE_KEY as SCOPE_KEY,
  agentTest as test,
  bootAgentApp,
  storedOnboardedScopes
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { expectRegionScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

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
      await expectRegionScreenshot(
        page,
        [workflow, page.locator('#agent-composer')],
        'agent-tour-workflow-card.png',
        { padding: 16 }
      )
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

  // PM-2396: the tour used to spotlight the canvas on card 3, so it threw the
  // spotlight and the focused card from the panel on the right edge across to
  // the middle of the screen and back again. The card count and the copy are
  // covered above; what is covered here is the invariant that fix established,
  // which nothing else asserts: every card spotlights something inside the
  // Agent panel, and a card does not move once the user can see it. A card
  // re-anchored outside the panel keeps the count and the copy intact and only
  // shows up as geometry.
  test('spotlights only the Agent panel and holds each card still', async ({
    page,
    agentFlagEnabled
  }) => {
    // Generous enough to ignore the per-card placement offset (16px measured
    // across the three cards), tight enough that a card anchored to the canvas
    // a third of a screen away cannot pass.
    const MAX_CARD_TRAVEL_PX = 64
    // Subpixel only: card 1 spotlights the panel itself, so its box is the
    // panel's box.
    const EDGE_TOLERANCE_PX = 2
    const SETTLE_FRAMES = 10
    // Only a bound on the walk, so a tour that never reaches a last card fails
    // instead of looping.
    const MAX_CARDS_WALKED = 8

    await bootAgentApp(page, agentFlagEnabled, {
      onboardingCompleted: false
    })
    await new AgentPanel(page).open()

    const panel = page.locator('#agent-panel-root')
    const spotlight = page.getByTestId('agent-coach-spotlight')
    await expect(panel).toBeVisible()
    const panelBox = await panel.boundingBox()
    if (!panelBox) throw new Error('the Agent panel has no box')

    // Walked by following Next rather than by a known card list, so a card
    // added back outside the panel fails on its own geometry instead of on a
    // step count.
    const cardLefts: number[] = []
    const walked: string[] = []
    const card = page
      .getByRole('dialog')
      .filter({ has: page.getByText(/^\d+ of \d+$/) })

    for (let step = 1; step <= MAX_CARDS_WALKED; step++) {
      await expect(card).toBeVisible()
      await expect(spotlight).toBeVisible()
      const title = (
        await card.getByRole('heading').first().textContent()
      )?.trim()
      walked.push(title ?? `card ${step}`)

      await test.step(`card "${title}" spotlights inside the panel`, async () => {
        const spotlightBox = await spotlight.boundingBox()
        if (!spotlightBox) throw new Error('the spotlight has no box')
        expect({
          leftOfPanelEdge: spotlightBox.x >= panelBox.x - EDGE_TOLERANCE_PX,
          rightOfPanelEdge:
            spotlightBox.x + spotlightBox.width <=
            panelBox.x + panelBox.width + EDGE_TOLERANCE_PX,
          belowPanelTop: spotlightBox.y >= panelBox.y - EDGE_TOLERANCE_PX,
          abovePanelBottom:
            spotlightBox.y + spotlightBox.height <=
            panelBox.y + panelBox.height + EDGE_TOLERANCE_PX
        }).toEqual({
          leftOfPanelEdge: true,
          rightOfPanelEdge: true,
          belowPanelTop: true,
          abovePanelBottom: true
        })
      })

      await test.step(`card "${title}" does not move once it is visible`, async () => {
        const first = await card.boundingBox()
        if (!first) throw new Error('the tour card has no box')
        let maxDrift = 0
        for (let frame = 0; frame < SETTLE_FRAMES; frame++) {
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => resolve(null))
              )
          )
          const next = await card.boundingBox()
          if (!next) throw new Error('the tour card lost its box')
          maxDrift = Math.max(
            maxDrift,
            Math.abs(next.x - first.x),
            Math.abs(next.y - first.y)
          )
        }
        expect(maxDrift).toBeLessThanOrEqual(EDGE_TOLERANCE_PX)
        cardLefts.push(first.x)
      })

      const next = card.getByRole('button', { name: enMessages.g.next })
      if ((await next.count()) === 0) break
      await next.click()
    }

    expect(walked).toEqual([
      enMessages.agent.coachTitle,
      enMessages.agent.coachWorkflowTitle,
      enMessages.agent.coachHistoryTitle
    ])
    expect(Math.max(...cardLefts) - Math.min(...cardLefts)).toBeLessThanOrEqual(
      MAX_CARD_TRAVEL_PX
    )
  })

  test('Escape leaves the last card, which has no Skip button', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled, {
      onboardingCompleted: false
    })
    const agentPanel = new AgentPanel(page)

    await test.step('Finish the tour with Escape on the last card', async () => {
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
    })

    await test.step('Save completion without the local flag', async () => {
      await expect
        .poll(() =>
          page.evaluate((key) => localStorage.getItem(key), SCOPE_KEY)
        )
        .toBe('true')
      await expect.poll(() => storedOnboardedScopes(page)).toContain(SCOPE_KEY)
      await page.evaluate((key) => localStorage.removeItem(key), SCOPE_KEY)
    })

    await test.step('Restore completion after reload', async () => {
      await agentPanel.reload()
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
})
