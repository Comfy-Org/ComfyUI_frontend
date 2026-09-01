import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

test.describe('Linear Agent UX scenarios', { tag: '@cloud' }, () => {
  for (const width of [480, 640]) {
    test(`X-01 / PM-672 keeps controls usable at ${width}px panel width`, async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
      const panel = page.locator('#agent-panel-root')

      const dock = page.getByTestId('docked-agent-panel')
      const resizeHandle = page.getByTestId('agent-panel-resize-handle')
      const handleBox = await resizeHandle.boundingBox()
      if (!handleBox)
        throw new Error('Agent panel resize handle is not visible')
      const handleCenterX = handleBox.x + handleBox.width / 2
      await page.mouse.move(handleCenterX, handleBox.y + 20)
      await page.mouse.down()
      await page.mouse.move(handleCenterX - (width - 420), handleBox.y + 20)
      await page.mouse.up()
      await expect(dock).toHaveCSS('width', `${width}px`)

      const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
      const send = panel.getByRole('button', { name: 'Send' })
      await composer.fill('Keep controls usable')

      await expect(composer).toBeInViewport()
      await expect(send).toBeInViewport()
      await expect(send).toBeEnabled()
    })
  }
})
