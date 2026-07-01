import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import {
  createTemplateHelper,
  withTemplates
} from '@e2e/fixtures/helpers/TemplateHelper'
import { onboardingFixture } from '@e2e/fixtures/tourFixture'

import { COACH_IDS } from '@/platform/onboarding/onboardingTours'

const test = mergeTests(comfyPageFixture, onboardingFixture)

// The tour only starts in app mode, so load a workflow and enter it first —
// an empty graph shows the welcome screen, not the controls the tour points at.
async function enterPopulatedAppMode(comfyPage: ComfyPage) {
  await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
  await comfyPage.templates.loadTemplate('default')
  await expect
    .poll(() => comfyPage.nodeOps.getGraphNodesCount())
    .toBeGreaterThan(0)
  await comfyPage.appMode.enterAppModeWithInputs([])
}

test.describe('Onboarding coachmarks', { tag: '@ui' }, () => {
  // The production templates index ships ~400 entries and lazy-paginates, so pin
  // it to a single known `default` card; the workflow JSON still loads from the server.
  test.beforeEach(async ({ comfyPage }) => {
    await createTemplateHelper(
      comfyPage.page,
      withTemplates([makeTemplate({ name: 'default', title: 'Default' })])
    ).mock()
  })

  test.describe('app-mode tour', () => {
    test('opens on the welcome landing, focuses Start, and Skip dismisses it', async ({
      comfyPage,
      onboarding
    }) => {
      await enterPopulatedAppMode(comfyPage)
      await onboarding.startTour()
      const coach = onboarding

      await expect(coach.landing).toBeVisible()
      await expect(coach.landing.getByRole('heading')).toHaveText(
        'Welcome to Apps'
      )
      // The focus trap lands on the primary action.
      await expect(coach.landingStartButton).toBeFocused()

      await coach.landingSkipButton.click()
      await expect(coach.landing).toBeHidden()
      expect(await coach.seen('appMode')).toBe(true)
    })

    test('Escape dismisses the welcome landing and marks it seen', async ({
      comfyPage,
      onboarding
    }) => {
      await enterPopulatedAppMode(comfyPage)
      await onboarding.startTour()
      const coach = onboarding
      await expect(coach.landing).toBeVisible()
      await expect(coach.landingStartButton).toBeFocused()

      await comfyPage.page.keyboard.press('Escape')
      await expect(coach.landing).toBeHidden()
      expect(await coach.seen('appMode')).toBe(true)
    })
  })

  test.describe('coach anchors', () => {
    test('every registry id resolves to an element (drift guard)', async ({
      comfyPage,
      onboarding
    }) => {
      const coach = onboarding
      await enterPopulatedAppMode(comfyPage)
      // The assets panel only mounts once its button is clicked; every other
      // anchor should already be present in a running app.
      for (const id of Object.values(COACH_IDS).filter(
        (id) => id !== COACH_IDS.assetsPanel
      )) {
        await expect(coach.coachAnchor(id)).toBeVisible()
      }
      await coach.coachAnchor(COACH_IDS.assetsButton).click()
      await expect(coach.coachAnchor(COACH_IDS.assetsPanel)).toBeVisible()
    })
  })

  test.describe('spotlight placement', () => {
    test('every spotlight card stays fully within the viewport', async ({
      comfyPage,
      onboarding
    }) => {
      const coach = onboarding
      // Disable the card's position transition so viewport checks read the
      // settled placement, not a transient mid-animation frame.
      await comfyPage.page.emulateMedia({ reducedMotion: 'reduce' })
      await enterPopulatedAppMode(comfyPage)

      await coach.startTour()
      await expect(coach.landing).toBeVisible()
      await coach.landingStartButton.click()

      // Next-advanced steps. Step 3 (outputs) is the vertically-centred
      // `leftCenter` placement that must not slide off the top/bottom edge.
      for (const step of [1, 2, 3]) {
        const card = coach.cardForStep(step)
        await expect(card).toBeVisible()
        await expect(card).toBeInViewport({ ratio: 1 })
        await coach.cardNextButton.click()
      }

      // Step 4 (assets button) advances by clicking its target, not Next.
      await expect(coach.cardForStep(4)).toBeInViewport({ ratio: 1 })
      await coach.coachAnchor('assets-button').click()

      // Step 5 (assets panel) opens from that click.
      await expect(coach.cardForStep(5)).toBeInViewport({ ratio: 1 })
    })
  })
})
