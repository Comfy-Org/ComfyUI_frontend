import { expect } from '@playwright/test'

import { EMPTY_ASSET_RESPONSE } from '@e2e/fixtures/data/assetFixtures'
import {
  ACTIVE_PERSONAL_BILLING_STATUS,
  ONBOARDING_TOUR_REMOTE_CONFIG
} from '@e2e/fixtures/data/cloudWorkspace'
import {
  CONTINUATION_INPUT,
  FIRST_RUN_NUDGE_ACTIONS,
  FIRST_RUN_OUTPUT,
  FIRST_RUN_OUTPUT_WIDGET_VALUE,
  FIRST_RUN_START_TEMPLATE_ID,
  FIRST_RUN_TEMPLATES
} from '@e2e/fixtures/data/firstRunTour'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { postFirstRunFixture as test } from '@e2e/fixtures/postFirstRunFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

/**
 * Covers the frontend handoff contract with a synthetic LoadImage workflow.
 * Published template graphs and their runtime execution are separate gates.
 */
test.describe(
  'Post-first-run continuations',
  { tag: ['@cloud', '@ui'] },
  () => {
    // A template load, camera flights, a queued run and a graph swap do not fit the default budget.
    test.describe.configure({ timeout: 120_000 })

    test.use({
      initialSettings: {
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
        route.fulfill(jsonRoute(ONBOARDING_TOUR_REMOTE_CONFIG))
      )
      await page.route('**/api/billing/status', (route) =>
        route.fulfill(jsonRoute(ACTIVE_PERSONAL_BILLING_STATUS))
      )
      await page.route('**/api/assets**', (route) =>
        route.fulfill(jsonRoute(EMPTY_ASSET_RESPONSE))
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
        firstRunNudge,
        page,
        postFirstRun
      }) => {
        await postFirstRun.completeTourWithImage()

        await expect(
          firstRunNudge.root,
          'every tour ending has to leave the user somewhere to go next'
        ).toBeVisible({ timeout: 10_000 })
        await expect(
          firstRunNudge.actions,
          'the served catalog carries every continuation, so none are filtered out'
        ).toHaveCount(FIRST_RUN_NUDGE_ACTIONS.length)
        await expect(firstRunNudge.action(action.id)).toContainText(
          action.title
        )

        const requestedTemplate = page.waitForRequest(
          `**/templates/${action.templateId}.json`
        )
        await firstRunNudge.action(action.id).click()
        await requestedTemplate

        await expect(
          firstRunNudge.root,
          'the card only closes once the continuation actually loaded'
        ).toBeHidden()
        await expect
          .poll(() => comfyPage.nodeOps.getNodeCount(), {
            message: 'the continuation never replaced the tour workflow'
          })
          .toBe(1)
        await expect
          .poll(() => postFirstRun.loadedContinuationInput(), {
            message:
              'the first output never reached the metadata-declared image input'
          })
          .toBe(FIRST_RUN_OUTPUT_WIDGET_VALUE)
        await expect(
          comfyPage.vueNodes
            .getNodeLocator(String(CONTINUATION_INPUT.nodeId))
            .locator('img'),
          'the seeded value has to resolve to an image the node can show'
        ).toBeVisible()
      })
    }
  }
)
