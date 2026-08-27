import { expect } from '@playwright/test'

import {
  ACTIVE_FIRST_RUN_SUBSCRIPTION,
  FIRST_RUN_ASSETS,
  FIRST_RUN_FEATURE_FLAGS,
  FIRST_RUN_NUDGE_ACTIONS,
  FIRST_RUN_OUTPUT,
  FIRST_RUN_OUTPUT_WIDGET_VALUE,
  FIRST_RUN_START_TEMPLATE_ID,
  FIRST_RUN_TEMPLATES
} from '@e2e/fixtures/data/postFirstRun'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { postFirstRunFixture as test } from '@e2e/fixtures/postFirstRunFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

/**
 * Covers the frontend handoff contract with a synthetic LoadImage workflow.
 * Published template graphs and their runtime execution are separate gates.
 */
test.describe(
  'Post-first-run continuations',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test.use({
      initialSettings: {
        'Comfy.Assets.UseAssetAPI': true,
        'Comfy.TutorialCompleted': false,
        'Comfy.OnboardingCoachmarks.Seen': ['appMode'],
        'Comfy.VueNodes.Enabled': true
      },
      initialFeatureFlags: { onboarding_tour_enabled: true }
    })

    test.beforeEach(async ({ page, templateApi }) => {
      templateApi.configure(withTemplates([...FIRST_RUN_TEMPLATES]))
      await templateApi.mock()

      await page.route('**/api/features', (route) =>
        route.fulfill(jsonRoute(FIRST_RUN_FEATURE_FLAGS))
      )
      await page.route('**/api/billing/status', (route) =>
        route.fulfill(jsonRoute(ACTIVE_FIRST_RUN_SUBSCRIPTION))
      )
      await page.route('**/api/assets**', (route) =>
        route.fulfill(jsonRoute(FIRST_RUN_ASSETS))
      )
      await page.route('**/internal/files/output**', (route) =>
        route.fulfill(jsonRoute([FIRST_RUN_OUTPUT_WIDGET_VALUE]))
      )
      await page.route(
        `**/templates/${FIRST_RUN_START_TEMPLATE_ID}.json`,
        (route) =>
          route.fulfill({
            contentType: 'application/json',
            // Synthetic graph matching the tour's pinned prompt and output roles.
            path: assetPath('onboarding/first_run_tour_contract.json')
          })
      )
      for (const { templateId } of FIRST_RUN_NUDGE_ACTIONS) {
        await page.route(`**/templates/${templateId}.json`, (route) =>
          route.fulfill({
            contentType: 'application/json',
            path: assetPath('widgets/load_image_widget.json')
          })
        )
      }
      await mockViewFiles(page, {
        [FIRST_RUN_OUTPUT.filename]: {
          contentType: 'image/webp',
          path: assetPath('image64x64.webp')
        },
        [FIRST_RUN_OUTPUT_WIDGET_VALUE]: {
          contentType: 'image/webp',
          path: assetPath('image64x64.webp')
        }
      })
    })

    for (const action of FIRST_RUN_NUDGE_ACTIONS) {
      test(`passes the first output to the ${action.title} template contract`, async ({
        comfyPage,
        firstRunContinuation,
        firstRunNudge,
        page,
        postFirstRun
      }) => {
        test.slow()

        await postFirstRun.completeTourWithImage()

        await expect(firstRunNudge.root).toBeVisible({ timeout: 10_000 })
        await expect(firstRunNudge.actions).toHaveCount(3)
        await expect(firstRunNudge.action(action.id)).toContainText(
          action.title
        )

        const requestedTemplate = page.waitForRequest(
          `**/templates/${action.templateId}.json`
        )
        await firstRunNudge.action(action.id).click()
        await requestedTemplate

        await expect(firstRunNudge.root).toBeHidden()
        await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
        await expect
          .poll(() => postFirstRun.loadedContinuationInput())
          .toBe(FIRST_RUN_OUTPUT_WIDGET_VALUE)
        await expect(firstRunContinuation.outputImage).toBeVisible()
      })
    }
  }
)
