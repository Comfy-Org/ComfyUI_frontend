import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test.describe('Queue Notification Banners', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setup()
  })

  async function triggerExecutionError(comfyPage: {
    canvasOps: { disconnectEdge(): Promise<void> }
    page: { keyboard: { press(key: string): Promise<void> } }
    command: { executeCommand(cmd: string): Promise<void> }
    nextFrame(): Promise<void>
  }) {
    await comfyPage.canvasOps.disconnectEdge()
    await comfyPage.nextFrame()
    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')
  }

  test('Toast appears when prompt is queued', async ({ comfyPage }) => {
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()
  })

  test('Error toast appears on failed execution', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const errorToast = comfyPage.page.locator(
      '.p-toast-message.p-toast-message-error'
    )
    await expect(errorToast.first()).toBeVisible()
  })

  test('Error toast contains error description', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const errorToast = comfyPage.page.locator(
      '.p-toast-message.p-toast-message-error'
    )
    await expect(errorToast.first()).toBeVisible()
    await expect(errorToast.first()).not.toHaveText('')
  })

  test('Toast close button dismisses individual toast', async ({
    comfyPage
  }) => {
    await triggerExecutionError(comfyPage)

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()

    const closeButton = comfyPage.page
      .locator('.p-toast-close-button')
      .first()
    await closeButton.click()

    await expect(comfyPage.toast.visibleToasts).toHaveCount(0)
  })

  test('Multiple toasts can stack', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)
    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()

    await triggerExecutionError(comfyPage)
    await expect(comfyPage.toast.visibleToasts).not.toHaveCount(0)

    const count = await comfyPage.toast.getVisibleToastCount()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('All toasts can be cleared', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()

    await comfyPage.toast.closeToasts()

    expect(await comfyPage.toast.getVisibleToastCount()).toBe(0)
  })
})
