import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

test.describe('Linear Agent UX scenarios', { tag: '@cloud' }, () => {
  for (const width of [320, 640]) {
    test(`X-01 / PM-672 keeps controls usable at ${width}px panel width`, async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
      const panel = page.locator('#agent-panel-root')

      await panel.evaluate((element, panelWidth) => {
        element.style.width = `${panelWidth}px`
      }, width)

      const composer = panel.getByRole('textbox')
      const send = panel.getByRole('button', { name: 'Send' })
      await composer.fill('Keep controls usable')

      await expect(composer).toBeVisible()
      await expect(send).toBeVisible()
      await expect(send).toBeEnabled()
    })
  }
})
