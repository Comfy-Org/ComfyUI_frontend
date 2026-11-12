import { expect } from '@playwright/test'

import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { LiveExecutionHelper } from '@e2e/fixtures/helpers/LiveExecutionHelper'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import {
  ENTRY_PATHS,
  TOUR_SEEN_SETTING
} from '@/platform/onboarding/onboardingTours'

export const test = base.extend<{
  comfyPage: ComfyPage
  liveExecution: LiveExecutionHelper
}>({
  localNoMocks: true,
  liveExecution: async ({ page, request }, use, testInfo) => {
    const apiUrl =
      process.env.PLAYWRIGHT_SETUP_API_URL || 'http://127.0.0.1:8188'
    const execution = new LiveExecutionHelper(page, request, apiUrl)
    try {
      await use(execution)
    } finally {
      await testInfo.attach('real-execution-evidence.json', {
        body: JSON.stringify(
          {
            mocks: false,
            jobs: execution.jobIds,
            history: execution.historyByJob,
            requests: execution.requests,
            frames: execution.frames
          },
          null,
          2
        ),
        contentType: 'application/json'
      })
      await execution.cleanup()
    }
  },
  comfyPage: async ({ page, request, liveExecution }, use, testInfo) => {
    expect(liveExecution.jobIds).toEqual([])
    const comfyPage = new ComfyPage(page, request)
    const userId = await comfyPage.setupUser(
      `m1-live-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}-${testInfo.testId.slice(-8)}`
    )
    comfyPage.userIds[testInfo.parallelIndex] = userId
    const settings = await request.post(`${comfyPage.apiUrl}/api/settings`, {
      headers: { 'Comfy-User': userId },
      data: {
        'Comfy.UseNewMenu': 'Top',
        'Comfy.VueNodes.Enabled': false,
        'Comfy.TutorialCompleted': true,
        'Comfy.VersionCompatibility.DisableWarnings': true,
        [TOUR_SEEN_SETTING]: [...ENTRY_PATHS]
      }
    })
    expect(settings.ok()).toBeTruthy()
    await comfyPage.setup({ mockReleases: false })
    await use(comfyPage)
  }
})

export { expect } from '@playwright/test'
