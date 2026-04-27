import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test.describe('Queue Notification Banners', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await comfyPage.setup()
  })

  test('Banner appears when prompt is queued', async ({ comfyPage }) => {
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    const banner = comfyPage.page.locator('[role="status"][aria-live="polite"]')
    await expect(banner).toBeVisible()
  })

  test('Banner shows queuing text initially', async ({ comfyPage }) => {
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    const banner = comfyPage.page.locator('[role="status"][aria-live="polite"]')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(/Job queuing|Job queued/)
  })

  test('Error overlay appears on failed execution', async ({ comfyPage }) => {
    await comfyPage.canvasOps.disconnectEdge()
    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    const errorOverlay = comfyPage.page.locator('[data-testid="error-overlay"]')
    await expect(errorOverlay).toBeVisible()
  })

  test('Error overlay contains error description', async ({ comfyPage }) => {
    await comfyPage.canvasOps.disconnectEdge()
    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    const errorOverlay = comfyPage.page.locator('[data-testid="error-overlay"]')
    await expect(errorOverlay).toBeVisible()
    await expect(errorOverlay).not.toHaveText('')
  })

  test('Error overlay can be dismissed', async ({ comfyPage }) => {
    await comfyPage.canvasOps.disconnectEdge()
    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    const errorOverlay = comfyPage.page.locator('[data-testid="error-overlay"]')
    await expect(errorOverlay).toBeVisible()

    await errorOverlay.getByRole('button', { name: /Dismiss/i }).click()
    await expect(errorOverlay).toBeHidden()
  })

  test('Banner auto-dismisses after display', async ({ comfyPage }) => {
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    const banner = comfyPage.page.locator('[role="status"][aria-live="polite"]')
    await expect(banner).toBeVisible()

    // Banner auto-dismisses after ~4 seconds
    await expect(banner).toBeHidden({ timeout: 10000 })
  })
})
