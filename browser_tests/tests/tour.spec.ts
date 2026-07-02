import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { onboardingFixture } from '@e2e/fixtures/tourFixture'

import { COACH_IDS } from '@/platform/onboarding/onboardingTours'

const test = mergeTests(comfyPageFixture, onboardingFixture)

// Relies on the default workflow the test server loads (locally: pnpm dev:test)
// — an empty graph would show the welcome screen, not the tour's controls.
test.describe('Onboarding coachmarks', { tag: '@ui' }, () => {
  test.describe('app-mode tour', () => {
    test('opens on the welcome landing, focuses Start, and Skip dismisses it', async ({
      comfyPage,
      onboarding
    }) => {
      await comfyPage.appMode.enterAppModeWithInputs([])
      await onboarding.startTour('appMode')
      const coach = onboarding

      await expect(coach.landing).toBeVisible()
      await expect(coach.landing.getByRole('heading')).toHaveText(
        'Welcome to Apps'
      )
      await expect(coach.landingStartButton).toBeFocused()

      await coach.landingSkipButton.click()
      await expect(coach.landing).toBeHidden()
      expect(await coach.seen('appMode')).toBe(true)
    })

    test('Escape dismisses the welcome landing and marks it seen', async ({
      comfyPage,
      onboarding
    }) => {
      await comfyPage.appMode.enterAppModeWithInputs([])
      await onboarding.startTour('appMode')
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
      await comfyPage.appMode.enterAppModeWithInputs([])
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
      // Read settled placements, not a transient mid-animation frame.
      await comfyPage.page.emulateMedia({ reducedMotion: 'reduce' })
      await comfyPage.appMode.enterAppModeWithInputs([])

      await coach.startTour('appMode')
      await expect(coach.landing).toBeVisible()
      await coach.landingStartButton.click()

      // Step 3 (outputs) is the vertically-centred `leftCenter` placement that
      // must not slide off the top/bottom edge.
      for (const step of [1, 2, 3]) {
        const card = coach.cardForStep(step)
        await expect(card).toBeVisible()
        await expect(card).toBeInViewport({ ratio: 1 })
        await coach.cardNextButton.click()
      }

      // Step 4 (assets button) advances by clicking its target, not Next.
      await expect(coach.cardForStep(4)).toBeInViewport({ ratio: 1 })
      await coach.coachAnchor('assets-button').click()

      await expect(coach.cardForStep(5)).toBeInViewport({ ratio: 1 })
    })
  })
})
