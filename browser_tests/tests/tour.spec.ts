import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { onboardingFixture } from '@e2e/fixtures/tourFixture'

import {
  COACH_IDS,
  TOUR_SEEN_SETTING
} from '@/platform/onboarding/onboardingTours'

const test = mergeTests(comfyPageFixture, onboardingFixture)

// Relies on the test server's default workflow (locally: pnpm dev:test).
test.describe('Onboarding coachmarks', { tag: '@ui' }, () => {
  test.describe('app-mode tour', () => {
    // With no tour pre-seeded as seen, entering the app auto-opens it.
    test.use({
      initialSettings: { [TOUR_SEEN_SETTING]: [] }
    })

    test('auto-opens on the welcome landing, focuses Start, and Skip dismisses it', async ({
      comfyPage,
      onboarding
    }) => {
      await comfyPage.appMode.enterAppModeWithInputs([])
      const coach = onboarding

      await expect(coach.landing).toBeVisible()
      await expect(coach.landing.getByRole('heading')).toHaveText(
        'Welcome to Apps'
      )
      await expect(coach.landingStartButton).toBeFocused()

      await coach.landingSkipButton.click()
      await expect(coach.landing).toBeHidden()
      await expect.poll(() => coach.seen('appMode')).toBe(true)
    })

    test('Escape dismisses the welcome landing and marks it seen', async ({
      comfyPage,
      onboarding
    }) => {
      await comfyPage.appMode.enterAppModeWithInputs([])
      const coach = onboarding
      await expect(coach.landing).toBeVisible()
      await expect(coach.landingStartButton).toBeFocused()

      await comfyPage.page.keyboard.press('Escape')
      await expect(coach.landing).toBeHidden()
      await expect.poll(() => coach.seen('appMode')).toBe(true)
    })
  })

  test.describe('coach anchors', () => {
    test('every registry id resolves to an element (drift guard)', async ({
      comfyPage,
      onboarding
    }) => {
      const coach = onboarding
      await comfyPage.appMode.enterAppModeWithInputs([])
      // The assets panel only mounts once the assets sidebar tab is open.
      for (const id of Object.values(COACH_IDS).filter(
        (id) => id !== COACH_IDS.assetsPanel
      )) {
        await expect(coach.coachAnchor(id)).toBeVisible()
      }
      await comfyPage.page.getByRole('button', { name: 'Media Assets' }).click()
      await expect(coach.coachAnchor(COACH_IDS.assetsPanel)).toBeVisible()
    })
  })

  test.describe('spotlight focus', () => {
    test('focuses the primary action, traps Tab in the card, and re-focuses per step', async ({
      comfyPage,
      onboarding
    }) => {
      const coach = onboarding
      await comfyPage.page.emulateMedia({ reducedMotion: 'reduce' })
      await comfyPage.appMode.enterAppModeWithInputs([])

      await coach.startTour('appMode')
      await expect(coach.landing).toBeVisible()
      await coach.landingStartButton.click()

      const step1 = coach.cardForStep(1)
      await expect(step1).toBeVisible()
      // FocusScope's mount-auto-focus is suppressed so focus lands on the
      // primary action rather than the first focusable (Skip).
      await expect(coach.cardNextButton).toBeFocused()

      // Tab more times than the card has controls; the looped trap must keep
      // focus inside the card, never escaping to the app behind the overlay.
      for (let i = 0; i < 4; i++) {
        await comfyPage.page.keyboard.press('Tab')
        await expect(step1.locator(':focus')).toBeVisible()
      }
      await comfyPage.page.keyboard.press('Shift+Tab')
      await expect(step1.locator(':focus')).toBeVisible()

      await coach.cardNextButton.click()
      await expect(coach.cardForStep(2)).toBeVisible()
      await expect(coach.cardNextButton).toBeFocused()
    })
  })

  test.describe('spotlight placement', () => {
    test('every spotlight card stays fully within the viewport and Done completes the tour', async ({
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

      for (const step of [1, 2, 3]) {
        const card = coach.cardForStep(step)
        await expect(card).toBeVisible()
        await expect(card).toBeInViewport({ ratio: 1 })
        await coach.cardNextButton.click()
      }

      // The final assets step auto-opens the assets panel — no target click.
      await expect(coach.cardForStep(4)).toBeInViewport({ ratio: 1 })

      await coach.cardDoneButton.click()
      await expect(coach.card).toBeHidden()
      await expect.poll(() => coach.seen('appMode')).toBe(true)
    })
  })
})
