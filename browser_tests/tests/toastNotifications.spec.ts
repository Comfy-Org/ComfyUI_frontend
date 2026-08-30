import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Toast Notifications', { tag: '@ui' }, () => {
  async function triggerErrorToast(comfyPage: {
    page: { evaluate: (fn: () => void) => Promise<void> }
    nextFrame: () => Promise<void>
  }) {
    await comfyPage.page.evaluate(() => {
      window.app!.extensionManager.toast.error('Error', {
        description: 'Test execution error',
        duration: 30000
      })
    })
    await comfyPage.nextFrame()
  }

  test('Error toast appears when triggered', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()
  })

  test('Toast shows correct error severity class', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)

    const errorToast = comfyPage.page
      .getByTestId('toast')
      .and(comfyPage.page.locator('[data-toast-kind="error"]'))
    await expect(errorToast.first()).toBeVisible()
  })

  test('Toast can be dismissed via close button', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()

    const closeButton = comfyPage.page.getByTestId('toast-close').first()
    await closeButton.click()

    await expect(comfyPage.toast.visibleToasts).toHaveCount(0)
  })

  test('All toasts cleared via closeToasts helper', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()

    await comfyPage.toast.closeToasts()

    await expect(comfyPage.toast.visibleToasts).toHaveCount(0)
  })

  test('Toast error count is accurate', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)

    await expect(
      comfyPage.page
        .getByTestId('toast')
        .and(comfyPage.page.locator('[data-toast-kind="error"]'))
        .first()
    ).toBeVisible()

    await expect(comfyPage.toast.toastErrors).not.toHaveCount(0)
  })
})
