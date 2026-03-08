import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test.describe('Toast Notifications', { tag: '@ui' }, () => {
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

  test('Error toast appears on execution failure', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()
  })

  test('Toast shows correct error severity class', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const errorToast = comfyPage.page.locator(
      '.p-toast-message.p-toast-message-error'
    )
    await expect(errorToast.first()).toBeVisible()
  })

  test('Toast can be dismissed via close button', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()

    const closeButton = comfyPage.page.locator('.p-toast-close-button').first()
    await closeButton.click()

    await expect(comfyPage.toast.visibleToasts).toHaveCount(0)
  })

  test('All toasts cleared via closeToasts helper', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()

    await comfyPage.toast.closeToasts()

    expect(await comfyPage.toast.getVisibleToastCount()).toBe(0)
  })

  test('Toast error count is accurate', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    await expect(
      comfyPage.page.locator('.p-toast-message.p-toast-message-error').first()
    ).toBeVisible()

    const errorCount = await comfyPage.toast.getToastErrorCount()
    expect(errorCount).toBeGreaterThanOrEqual(1)
  })
})
