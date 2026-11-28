import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { cloudRemoteConfigImportUndefinedTest as test } from '@e2e/fixtures/cloudRemoteConfigImportUndefinedFixture'

test.describe(
  'Cloud startup when the cloudRemoteConfig chunk fails to fetch (production build)',
  {
    tag: ['@cloud', '@canvas'],
    annotation: {
      type: 'issue',
      description: 'https://comfy-org.sentry.io/issues/7828134479/'
    }
  },
  () => {
    test('reports the failure once and keeps the graph canvas visible and interactive', async ({
      comfyPage,
      failedCloudRemoteConfigImport
    }) => {
      expect(failedCloudRemoteConfigImport.requests).toBeGreaterThan(0)
      await expect
        .poll(() => failedCloudRemoteConfigImport.reports)
        .toHaveLength(1)

      await expect(comfyPage.canvas).toBeVisible()
      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()
      await expect(comfyPage.canvas).toHaveFocus()
    })
  }
)
