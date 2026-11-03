import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.beforeEach(async ({ page }) => {
  await page.route('**/src/extensions/core/agentPanel.ts*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'export {}'
    })
  )
})

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
      comfyPage
    }) => {
      await expect(comfyPage.canvas).toBeVisible()

      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await expect(comfyPage.canvas).toHaveFocus()
    })
  }
)
