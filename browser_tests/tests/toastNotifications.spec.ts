import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

test.describe('Toast Notifications', { tag: '@ui' }, () => {
  async function triggerErrorToast(comfyPage: ComfyPage) {
    await comfyPage.page.evaluate(() => {
      window.app!.extensionManager.toast.error('Error', {
        description: 'Test execution error',
        duration: 30000
      })
    })
  }

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

  test('Toast can be dismissed via close button', async ({ comfyPage }) => {
    await triggerErrorToast(comfyPage)
    const errorToast = comfyPage.toast.toastErrors.filter({
      hasText: 'Test execution error'
    })
    await expect(errorToast).toBeVisible()

    await comfyPage.toast.dismiss(errorToast)

    await expect(comfyPage.toast.visibleToasts).toHaveCount(0)
  })

  test('Legacy extension toast messages still render', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      window.app!.extensionManager.toast.add({
        severity: 'warn',
        summary: 'Legacy summary',
        detail: 'Legacy detail',
        life: 30000
      })
      window.app!.extensionManager.toast.addAlert('Legacy alert')
    })

    await expect(
      comfyPage.toast.toastWarnings.filter({ hasText: 'Legacy detail' })
    ).toBeVisible()
    await expect(
      comfyPage.toast.toastWarnings.filter({ hasText: 'Legacy alert' })
    ).toBeVisible()
  })
})
