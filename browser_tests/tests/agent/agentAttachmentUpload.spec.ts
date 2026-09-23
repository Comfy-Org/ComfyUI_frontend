import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

test.describe('Agent attachment cancellation', { tag: '@cloud' }, () => {
  test('closing the panel removes a pending upload and preserves a sendable draft', async ({
    comfyPage,
    agentPanel
  }) => {
    const page = comfyPage.page
    let releaseUpload = () => {}
    const uploadHeld = new Promise<void>((resolve) => {
      releaseUpload = resolve
    })
    await page.route('**/api/upload/image', async (route) => {
      await uploadHeld
      await route.abort()
    })

    try {
      const openButton = page.getByRole('button', {
        name: enMessages.agent.entryButton,
        exact: true
      })
      await openButton.click()
      await agentPanel.selectWorkflow()
      const panel = page.locator('#agent-panel-root')
      const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
      const send = panel.getByRole('button', { name: 'Send', exact: true })
      await composer.fill('Keep this draft')
      await expect(send).toBeEnabled()

      const uploadReceived = page.waitForRequest('**/api/upload/image')
      await panel.getByTestId('agent-file-input').setInputFiles({
        name: 'pending.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from('pending upload')
      })
      await uploadReceived
      await expect(
        panel.getByTestId('composer-asset-section').getByText('pending.mp4')
      ).toBeVisible()
      await expect(send).toBeDisabled()

      await panel
        .getByRole('button', { name: enMessages.g.close, exact: true })
        .click()
      await expect(panel).toHaveCount(0)
      await openButton.click()

      await expect(composer).toHaveText('Keep this draft')
      await expect(panel.getByText('pending.mp4', { exact: true })).toHaveCount(
        0
      )
      await expect(send).toBeEnabled()
    } finally {
      releaseUpload()
      await page.unrouteAll({ behavior: 'wait' })
    }
  })
})
