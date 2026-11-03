import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { agentPanelMissingExportTest as test } from '@e2e/fixtures/agentPanelMissingExportFixture'

test.describe(
  'Cloud startup without the Agent panel registration export',
  {
    tag: ['@cloud', '@canvas'],
    annotation: {
      type: 'issue',
      description: 'https://comfy-org.sentry.io/issues/7826229198/'
    }
  },
  () => {
    test('keeps the graph canvas visible and interactive', async ({
      comfyPage,
      injectedAgentPanelModule
    }) => {
      expect(injectedAgentPanelModule.requests).toBeGreaterThan(0)
      await expect(comfyPage.canvas).toBeVisible()

      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()
      await expect(comfyPage.canvas).toHaveFocus()
    })
  }
)
