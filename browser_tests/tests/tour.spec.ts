import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import {
  createTemplateHelper,
  withTemplates
} from '@e2e/fixtures/helpers/TemplateHelper'
import { onboardingFixture } from '@e2e/fixtures/tourFixture'

const test = mergeTests(comfyPageFixture, onboardingFixture)

/**
 * Tours are forced via `?coach=<tour>` — it bypasses detection, the seen-flag
 * and the per-step gates, which depend on backend state the fixture can't control.
 */
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
      comfyPage: _comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('appMode')
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
      await onboarding.startTour('appMode')
      const coach = onboarding
      await expect(coach.landing).toBeVisible()

      await comfyPage.page.keyboard.press('Escape')
      await expect(coach.landing).toBeHidden()
      expect(await coach.seen('appMode')).toBe(true)
    })
  })

  test.describe('coach anchors', () => {
    // comfyPage is requested (unused) so its fixture performs the app setup.
    test('every registry id resolves to an element (drift guard)', async ({
      comfyPage,
      onboarding
    }) => {
      // Keep in sync with COACH_IDS in src/platform/onboarding/onboardingTours.ts
      // (importing it would execute app modules outside the browser).
      const coach = onboarding
      // App-mode anchors only mount once a workflow is running in app mode.
      // Wait for the template to populate the graph first — entering app mode
      // with an empty graph shows the welcome screen, not the controls.
      await comfyPage.templates.loadTemplate('default')
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBeGreaterThan(0)
      await comfyPage.appMode.enterAppModeWithInputs([])
      for (const id of [
        'app-run-button',
        'inputs-list',
        'outputs',
        'assets-button'
      ]) {
        await expect(coach.coachAnchor(id)).toBeVisible()
      }
      // The assets panel mounts when the app-mode assets button is clicked.
      await coach.coachAnchor('assets-button').click()
      await expect(coach.coachAnchor('assets-panel')).toBeVisible()
    })
  })
})
