import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

// Matches the Agent panel module as the Vite dev server serves it and as the
// built cloud artifact CI serves it (`assets/agentPanel-<hash>.js`).
const AGENT_PANEL_MODULE =
  /\/(?:src\/extensions\/core\/agentPanel\.ts|assets\/agentPanel-[\w-]+\.js)(?:\?.*)?$/

let injectedModuleRequests = 0

test.beforeEach(async ({ page }) => {
  injectedModuleRequests = 0
  await page.route(AGENT_PANEL_MODULE, (route) => {
    injectedModuleRequests++
    return route.fulfill({
      contentType: 'text/javascript',
      body: 'export {}'
    })
  })
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
      expect(injectedModuleRequests).toBeGreaterThan(0)
      await expect(comfyPage.canvas).toBeVisible()

      await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
      await comfyPage.nextFrame()
      await expect(comfyPage.canvas).toHaveFocus()
    })
  }
)
