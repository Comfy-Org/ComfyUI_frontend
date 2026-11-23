import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { cloudRemoteConfigMissingExportTest as test } from '@e2e/fixtures/cloudRemoteConfigMissingExportFixture'

test.describe(
  'Cloud startup without the cloudRemoteConfig export',
  {
    tag: ['@cloud', '@canvas'],
    annotation: {
      type: 'issue',
      description: 'https://comfy-org.sentry.io/issues/7828134479/'
    }
  },
  () => {
    test('keeps the graph canvas visible and interactive', async ({
      comfyPage,
      injectedCloudRemoteConfigModule
    }) => {
      expect(injectedCloudRemoteConfigModule.requests).toBeGreaterThan(0)
      await expect(comfyPage.canvas).toBeVisible()

      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()
      await expect(comfyPage.canvas).toHaveFocus()
    })
  }
)
