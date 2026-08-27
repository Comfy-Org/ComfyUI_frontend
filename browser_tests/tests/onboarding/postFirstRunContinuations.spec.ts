import { expect } from '@playwright/test'

import { FIRST_RUN_SUGGESTIONS } from '@/renderer/extensions/firstRunTour/nudge/firstRunNudgeSuggestions'

import {
  CONTINUATION_INPUT,
  FIRST_RUN_OUTPUT,
  FIRST_RUN_OUTPUT_WIDGET_VALUE,
  FIRST_RUN_START_TEMPLATE_ID,
  FIRST_RUN_TEMPLATES
} from '@e2e/fixtures/data/firstRunTour'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { postFirstRunFixture as test } from '@e2e/fixtures/postFirstRunFixture'
import { mockFirstRunTourBackend } from '@e2e/fixtures/utils/firstRunTourMocks'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

/**
 * Which continuation the walk clicks does not matter here: the id-to-template
 * mapping is covered per action in `FirstRunTourNudge.test.ts`, and what this
 * suite adds is the wiring underneath it — a fetched graph replacing the tour
 * workflow with the first output seeded into its declared input.
 */
const CONTINUATION = FIRST_RUN_SUGGESTIONS[0]

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
      }
    })

    test.beforeEach(async ({ page, templateApi }) => {
      templateApi.configure(withTemplates(FIRST_RUN_TEMPLATES))
      await templateApi.mock()

      await mockFirstRunTourBackend(page)
      await page.route(
        `**/templates/${FIRST_RUN_START_TEMPLATE_ID}.json`,
        (route) =>
          route.fulfill({
            contentType: 'application/json',
            // Synthetic graph matching the tour's pinned prompt and output roles.
            path: assetPath('onboarding/first_run_tour_contract.json')
          })
      )
      for (const { templateId } of FIRST_RUN_SUGGESTIONS) {
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

    test('passes the first output to the continuation it loads', async ({
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
      ).toHaveCount(FIRST_RUN_SUGGESTIONS.length)

      const requestedTemplate = page.waitForRequest(
        `**/templates/${CONTINUATION.templateId}.json`
      )
      await firstRunNudge.action(CONTINUATION.id).click()
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
)
