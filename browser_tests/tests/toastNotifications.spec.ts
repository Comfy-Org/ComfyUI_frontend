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
      window.app!.extensionManager.toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Test execution error',
        life: 30000
      })
    })
    await comfyPage.nextFrame()
  }

  test('Error toast appears when triggered', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()
  })

  test('Graph toast fallback respects the workspace inset', async ({
    comfyPage
  }) => {
    const workspaceInset = 240
    await comfyPage.page.evaluate((inset) => {
      document.documentElement.style.setProperty(
        '--workspace-inset-right',
        `${inset}px`
      )
      document
        .querySelectorAll<HTMLElement>(
          '.graph-canvas-panel, .docked-agent-panel'
        )
        .forEach((element) => {
          element.style.setProperty('anchor-name', 'none')
        })
    }, workspaceInset)

    await triggerErrorToast(comfyPage)

    const graphToast = comfyPage.page
      .locator('.graph-toast .p-toast-message')
      .filter({ hasText: 'Test execution error' })
    await expect(graphToast).toBeVisible()

    const bounds = await graphToast.boundingBox()
    const viewport = comfyPage.page.viewportSize()
    expect(bounds).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      viewport!.width - workspaceInset
    )
  })

  test('Toast shows correct error severity class', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)

    const errorToast = comfyPage.page.locator(
      '.p-toast-message.p-toast-message-error'
    )
    await expect(errorToast.first()).toBeVisible()
  })

  test('Toast can be dismissed via close button', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()

    const closeButton = comfyPage.page.locator('.p-toast-close-button').first()
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
      comfyPage.page.locator('.p-toast-message.p-toast-message-error').first()
    ).toBeVisible()

    await expect(comfyPage.toast.toastErrors).not.toHaveCount(0)
  })
})
