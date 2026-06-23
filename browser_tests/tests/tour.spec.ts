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
 * and the per-step gates, which depend on backend state the fixture can't
 * control (detection logic is unit-tested in onboardingTours.test.ts).
 *
 * Not covered: detection-driven starts (need a brand-new user and controlled
 * backend assets) and the deferTarget timeout (needs the templates dialog to
 * fail to mount after the click).
 */
test.describe('Onboarding coachmarks', { tag: '@ui' }, () => {
  // The production templates index ships ~400 entries and the dialog
  // lazy-paginates, so the real `default` card never renders into the DOM for
  // the "Select a template" step. Pin the index to a single known `default`
  // card; the workflow JSON itself still loads from the server.
  test.beforeEach(async ({ comfyPage }) => {
    await createTemplateHelper(
      comfyPage.page,
      withTemplates([makeTemplate({ name: 'default', title: 'Default' })])
    ).mock()
  })

  test.describe('blank-canvas tour', () => {
    test.use({ initialSettings: { 'Comfy.VueNodes.Enabled': true } })

    test('walks the forced tour end to end', async ({
      comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding

      // No Nodes 2.0 gate step when the setting is already on.
      await expect(coach.title).toHaveText('This is your canvas')
      await expect(coach.stepLabel).toHaveText('Step 1 of 4')
      await expect(coach.spotlight).toBeVisible()

      await coach.nextButton.click()
      await expect(coach.title).toHaveText('Start from a template')

      // Click-to-advance step: the blocker hole is the target's exact bounds,
      // so a click in the spotlight pad just outside must not advance.
      const templatesButton = coach.coachAnchor('templates-button')
      const box = await templatesButton.boundingBox()
      if (!box) throw new Error('templates button has no bounding box')
      await comfyPage.page.mouse.click(
        box.x + box.width + 4,
        box.y + box.height / 2
      )
      await comfyPage.nextFrame()
      await expect(coach.title).toHaveText('Start from a template')

      await templatesButton.click()
      const dialog = coach.coachAnchor('templates-dialog')
      await expect(dialog).toBeVisible()
      await expect(coach.title).toHaveText('Select a template')

      // Selecting a template closes the dialog and advances to the Run step.
      await comfyPage.templates.loadTemplate('default')
      await expect(dialog).toBeHidden()
      await expect(coach.title).toHaveText('Now run it')

      // A workflow template stays in the graph, so the multi-target run step
      // resolves to the graph run button.
      await expect
        .poll(() => coach.spotlightGap(coach.coachAnchor('run-button')), {
          timeout: 3000
        })
        .toBeLessThanOrEqual(2)

      // The final step offers Done only — Skip would be redundant.
      await expect(coach.skipButton).toBeHidden()
      await coach.doneButton.click()
      await expect(coach.card).toBeHidden()
      expect(await coach.seen('blankCanvas')).toBe(true)
    })

    test('spotlight tracks the templates dialog to its final size', async ({
      comfyPage: _comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding
      await expect(coach.title).toHaveText('This is your canvas')

      await coach.nextButton.click()
      await expect(coach.title).toHaveText('Start from a template')

      await coach.coachAnchor('templates-button').click()
      const dialog = coach.coachAnchor('templates-dialog')
      await expect(dialog).toBeVisible()
      await expect(coach.title).toHaveText('Select a template')

      // The spotlight is the target rect plus an 8px pad on every side; it must
      // match the fully-opened dialog, not the mid-scale-in size it had while
      // the open animation was still running.
      await expect
        .poll(() => coach.spotlightGap(dialog), { timeout: 3000 })
        .toBeLessThanOrEqual(2)
    })

    test('run step retargets the app run button when the loaded template enters app mode', async ({
      comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding
      await expect(coach.title).toHaveText('This is your canvas')

      await coach.nextButton.click()
      await expect(coach.title).toHaveText('Start from a template')
      await coach.coachAnchor('templates-button').click()
      await expect(coach.coachAnchor('templates-dialog')).toBeVisible()

      // Reach the run step via a workflow (graph-mode) template.
      await comfyPage.templates.loadTemplate('default')
      await expect(coach.title).toHaveText('Now run it')
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBeGreaterThan(0)

      // An app template switches to app mode, which hides the graph run button
      // and mounts the app run button; the spotlight must follow the visible one.
      await comfyPage.appMode.enterAppModeWithInputs([])
      const appRun = coach.coachAnchor('app-run-button')
      await expect(appRun).toBeVisible()
      await expect(coach.coachAnchor('run-button')).toBeHidden()
      // The app run button anchors the bottom of the viewport, so the spotlight
      // clamps its padding to keep the ring on screen — assert it still encloses
      // the button rather than wrapping it to the pixel.
      await expect
        .poll(() => coach.spotlightCovers(appRun), { timeout: 3000 })
        .toBe(true)
    })

    test('marches an outline around the target on a click step when the user stalls', async ({
      comfyPage: _comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding
      await expect(coach.title).toHaveText('This is your canvas')

      await coach.nextButton.click()
      await expect(coach.title).toHaveText('Start from a template')

      // The spotlight outline only marches once the user has stalled.
      await expect(coach.spotlightRing).not.toHaveClass(/coach-march/)
      await expect(coach.spotlightRing).toHaveClass(/coach-march/, {
        timeout: 10000
      })

      // Clicking the target advances the tour and stops the marching.
      await coach.coachAnchor('templates-button').click()
      await expect(coach.coachAnchor('templates-dialog')).toBeVisible()
      await expect(coach.spotlightRing).not.toHaveClass(/coach-march/)
    })

    test('blocks clicks outside the spotlight on informational steps', async ({
      comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding
      await expect(coach.title).toHaveText('This is your canvas')

      const box = await coach.coachAnchor('templates-button').boundingBox()
      if (!box) throw new Error('templates button has no bounding box')
      await comfyPage.page.mouse.click(
        box.x + box.width / 2,
        box.y + box.height / 2
      )
      await comfyPage.nextFrame()
      await expect(coach.coachAnchor('templates-dialog')).toHaveCount(0)
      await expect(coach.title).toHaveText('This is your canvas')
    })

    test('Escape dismisses the tour and marks it seen', async ({
      comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding
      await expect(coach.card).toBeVisible()

      await comfyPage.page.keyboard.press('Escape')
      await expect(coach.card).toBeHidden()
      expect(await coach.seen('blankCanvas')).toBe(true)
    })

    test('Skip dismisses the tour and marks it seen', async ({
      comfyPage: _comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding
      await expect(coach.card).toBeVisible()

      await coach.skipButton.click()
      await expect(coach.card).toBeHidden()
      expect(await coach.seen('blankCanvas')).toBe(true)
    })

    test('traps focus: starts on the primary action and Tab stays in the coach cycle', async ({
      comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding
      await expect(coach.title).toHaveText('This is your canvas')
      await expect(coach.nextButton).toBeFocused()

      // Skip immediately precedes the primary button in the cycle.
      await comfyPage.page.keyboard.press('Shift+Tab')
      await expect(coach.skipButton).toBeFocused()

      // Focus must never escape the card + spotlighted target.
      for (let i = 0; i < 5; i++) {
        await comfyPage.page.keyboard.press('Tab')
        const inCycle = await comfyPage.page.evaluate(() => {
          const active = document.activeElement
          const overlay = document.querySelector(
            '[data-testid="coach-spotlight"]'
          )?.parentElement
          const target = document.querySelector('[data-coach-id="canvas"]')
          return Boolean(
            active && (overlay?.contains(active) || target?.contains(active))
          )
        })
        expect(inCycle).toBe(true)
      }
    })

    test('pulls stray focus back into the card', async ({
      comfyPage: _comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding
      await expect(coach.title).toHaveText('This is your canvas')

      // The run button is outside both the card and the spotlighted target.
      await coach
        .coachAnchor('run-button')
        .evaluate((el) => (el as HTMLElement).focus())
      await expect(coach.nextButton).toBeFocused()
    })

    test('canvas spotlight starts below the tab bar and stays inside the viewport', async ({
      comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding
      await expect(coach.title).toHaveText('This is your canvas')
      await comfyPage.nextFrame()

      const spotlight = await coach.spotlight.boundingBox()
      const tabs = await comfyPage.page
        .getByTestId('topbar-workflow-tabs')
        .boundingBox()
      const viewport = comfyPage.page.viewportSize()
      if (!spotlight || !tabs || !viewport)
        throw new Error('missing geometry for spotlight assertion')

      expect(spotlight.y).toBeGreaterThanOrEqual(tabs.y + tabs.height - 1)
      expect(spotlight.x).toBeGreaterThanOrEqual(0)
      expect(spotlight.x + spotlight.width).toBeLessThanOrEqual(viewport.width)
      expect(spotlight.y + spotlight.height).toBeLessThanOrEqual(
        viewport.height
      )
    })
  })

  test.describe('Nodes 2.0 gate', () => {
    test.use({ initialSettings: { 'Comfy.VueNodes.Enabled': false } })

    test('leads with the enable step, flips the setting and advances', async ({
      comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding

      await expect(coach.title).toHaveText('Turn on Nodes 2.0')
      await expect(coach.stepLabel).toHaveText('Step 1 of 5')
      await expect(coach.spotlight).toBeHidden()

      await coach.card.getByRole('button', { name: 'Enable Nodes 2.0' }).click()
      await expect(coach.title).toHaveText('This is your canvas')
      expect(
        await comfyPage.settings.getSetting('Comfy.VueNodes.Enabled')
      ).toBe(true)
    })

    test('Skip on the gate ends the whole tour', async ({
      comfyPage,
      onboarding
    }) => {
      await onboarding.startTour('blankCanvas')
      const coach = onboarding
      await expect(coach.title).toHaveText('Turn on Nodes 2.0')

      await coach.skipButton.click()
      await expect(coach.card).toBeHidden()
      expect(await coach.seen('blankCanvas')).toBe(true)
      expect(
        await comfyPage.settings.getSetting('Comfy.VueNodes.Enabled')
      ).toBe(false)
    })
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
      // Graph-mode anchors.
      for (const id of ['canvas', 'run-button', 'templates-button']) {
        await expect(coach.coachAnchor(id)).toBeVisible()
      }
      // The dialog anchor only mounts with the templates dialog open.
      await coach.coachAnchor('templates-button').click()
      await expect(coach.coachAnchor('templates-dialog')).toBeVisible()

      // App-mode anchors only mount once a workflow is running in app mode.
      // Wait for the template to populate the graph first — entering app mode
      // with an empty graph shows the welcome screen, not the controls.
      await comfyPage.templates.loadTemplate('default')
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBeGreaterThan(0)
      await comfyPage.appMode.enterAppModeWithInputs([])
      for (const id of ['app-run-button', 'inputs-list', 'outputs']) {
        await expect(coach.coachAnchor(id)).toBeVisible()
      }
    })
  })
})
