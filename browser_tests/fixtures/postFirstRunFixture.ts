import { mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { FirstRunNudge } from '@e2e/fixtures/components/FirstRunNudge'
import {
  FIRST_RUN_CONTINUATION,
  FIRST_RUN_INTERMEDIATE_OUTPUT,
  FIRST_RUN_OUTPUT,
  FIRST_RUN_OUTPUT_WIDGET_VALUE,
  FIRST_RUN_START_TEMPLATE_ID,
  FIRST_RUN_TEMPLATES
} from '@e2e/fixtures/data/firstRunTour'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { PostFirstRunHelper } from '@e2e/fixtures/helpers/PostFirstRunHelper'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'
import { onboardingFixture } from '@e2e/fixtures/tourFixture'
import {
  installFirstRunRaceRoutes,
  mockFirstRunTourBackend
} from '@e2e/fixtures/utils/firstRunTourMocks'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'
import { webSocketFixture } from '@e2e/fixtures/ws'

const base = mergeTests(
  comfyPageFixture,
  onboardingFixture,
  templateApiFixture,
  webSocketFixture
)

export const postFirstRunFixture = base.extend<{
  deferFirstRunCatalog: boolean
  firstRunNudge: FirstRunNudge
  firstRunRoutes: Awaited<ReturnType<typeof installFirstRunRaceRoutes>>
  postFirstRun: PostFirstRunHelper
  execution: ExecutionHelper
}>({
  deferFirstRunCatalog: [false, { option: true }],
  firstRunRoutes: [
    async ({ page, templateApi, deferFirstRunCatalog }, use) => {
      templateApi.configure(withTemplates(FIRST_RUN_TEMPLATES))
      await templateApi.mock()
      await mockFirstRunTourBackend(page)
      await templateApi.mockWorkflow(
        FIRST_RUN_START_TEMPLATE_ID,
        assetPath('onboarding/first_run_tour_contract.json')
      )
      await templateApi.mockWorkflow(
        FIRST_RUN_CONTINUATION.templateId,
        assetPath('widgets/load_image_widget.json')
      )
      await mockViewFiles(page, {
        [FIRST_RUN_OUTPUT.filename]: {
          contentType: 'image/webp',
          path: assetPath('image64x64.webp')
        },
        [FIRST_RUN_OUTPUT_WIDGET_VALUE]: {
          contentType: 'image/webp',
          path: assetPath('image64x64.webp')
        },
        [FIRST_RUN_INTERMEDIATE_OUTPUT.filename]: {
          contentType: 'image/webp',
          path: assetPath('example.webp')
        }
      })
      await page.clock.install()
      const routes = await installFirstRunRaceRoutes(page, deferFirstRunCatalog)
      try {
        await use(routes)
      } finally {
        routes.releasePending()
        await page.unrouteAll({ behavior: 'wait' })
      }
    },
    { auto: true }
  ],
  firstRunNudge: async ({ page }, use) => {
    await use(new FirstRunNudge(page))
  },
  execution: async ({ comfyPage, getWebSocket }, use) => {
    await use(new ExecutionHelper(comfyPage, await getWebSocket()))
  },
  postFirstRun: async ({ comfyPage, onboarding, firstRunNudge }, use) => {
    try {
      await use(new PostFirstRunHelper(comfyPage, onboarding, firstRunNudge))
    } finally {
      await comfyPage.canvasOps.resetView()
    }
  }
})
