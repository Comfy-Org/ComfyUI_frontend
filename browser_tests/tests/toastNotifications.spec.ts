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

    await expect(
      comfyPage.toast.toastErrors.filter({ hasText: 'Test execution error' })
    ).toBeVisible()
  })

  test('Toasts stay clear of the workspace inset', async ({ comfyPage }) => {
    const workspaceInset = 240
    await comfyPage.page.evaluate((inset) => {
      document.documentElement.style.setProperty(
        '--workspace-inset-right',
        `${inset}px`
      )
    }, workspaceInset)

    await triggerErrorToast(comfyPage)

    const graphToast = comfyPage.toast.withText('Test execution error')
    await expect(graphToast).toBeVisible()

    const bounds = await graphToast.boundingBox()
    const viewport = comfyPage.page.viewportSize()
    expect(bounds).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      viewport!.width - workspaceInset
    )
  })

  test('Error toast is announced as an alert', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)

    await expect(
      comfyPage.toast.alerts.filter({ hasText: 'Test execution error' })
    ).toBeVisible()
    await expect(comfyPage.toast.toastErrors).toHaveCount(1)
  })

  test('Toast can be dismissed via close button', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)
    const errorToast = comfyPage.toast.withText('Test execution error')
    await expect(errorToast).toBeVisible()

    await comfyPage.toast.dismiss(errorToast)

    await expect(comfyPage.toast.visibleToasts).toHaveCount(0)
  })

  test('All toasts cleared via closeToasts helper', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)

    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()

    await comfyPage.toast.closeToasts()

    await expect(comfyPage.toast.visibleToasts).toHaveCount(0)
  })

  test('Legacy extension toast messages still render and dismiss', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      const message = {
        severity: 'warn',
        summary: 'Legacy summary',
        detail: 'Legacy detail',
        life: 30000
      } as const
      window.app!.extensionManager.toast.add(message)
      window.app!.extensionManager.toast.addAlert('Legacy alert')
      window.app!.extensionManager.toast.remove(message)
    })

    await expect(
      comfyPage.toast.toastWarnings.filter({ hasText: 'Legacy alert' })
    ).toBeVisible()
    await expect(comfyPage.toast.withText('Legacy detail')).toHaveCount(0)
  })
})
