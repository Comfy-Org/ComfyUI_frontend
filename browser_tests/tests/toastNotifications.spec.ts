import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Locator } from '@playwright/test'

type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  )
}

test.describe('Toast Notifications', { tag: '@ui' }, () => {
  async function triggerErrorToast(comfyPage: ComfyPage) {
    await comfyPage.page.evaluate(() => {
      window.app!.extensionManager.toast.error('Error', {
        description: 'Test execution error',
        duration: 30000
      })
    })
  }

  test('Toasts outside the graph fall back to the workspace inset', async ({
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

  test('Toasts stay clear of the open properties panel', async ({
    comfyPage
  }) => {
    const { propertiesPanel } = comfyPage.menu
    await propertiesPanel.toggleButton.click()
    await expect(propertiesPanel.root).toBeVisible()

    await triggerErrorToast(comfyPage)

    const graphToast = comfyPage.toast.withText('Test execution error')
    await expect(graphToast).toBeVisible()

    const toastBounds = await graphToast.boundingBox()
    const panelBounds = await propertiesPanel.root.boundingBox()
    expect(toastBounds).not.toBeNull()
    expect(panelBounds).not.toBeNull()
    expect(toastBounds!.x + toastBounds!.width).toBeLessThanOrEqual(
      panelBounds!.x
    )
  })

  test('A toast raised before a dialog opens stays above it', async ({
    comfyPage
  }) => {
    await triggerErrorToast(comfyPage)
    await comfyPage.settingDialog.open()
    const errorToast = comfyPage.toast.withText('Test execution error')

    await comfyPage.toast.dismiss(errorToast)

    await expect(comfyPage.toast.visibleToasts).toHaveCount(0)
    await expect(comfyPage.settingDialog.root).toBeVisible()
  })

  for (const { dialog, open, closeButton } of [
    {
      dialog: 'Settings',
      open: (comfyPage: ComfyPage) => comfyPage.settingDialog.open(),
      closeButton: (comfyPage: ComfyPage) =>
        comfyPage.settingDialog.root.getByRole('button', { name: 'Close' })
    },
    {
      dialog: 'a maximized dialog',
      open: (comfyPage: ComfyPage) =>
        comfyPage.page.evaluate(() => {
          window.app!.extensionManager.dialog.showExtensionDialog({
            key: 'maximized-toast-test',
            title: 'Maximized',
            component: { render: () => null },
            dialogComponentProps: { maximizable: true, maximized: true }
          })
        }),
      closeButton: (comfyPage: ComfyPage) =>
        comfyPage.page
          .getByRole('dialog', { name: 'Maximized' })
          .getByRole('button', { name: 'Close' })
    }
  ]) {
    test(`Toasts stay clear of the close button of ${dialog}`, async ({
      comfyPage
    }) => {
      await open(comfyPage)
      await triggerErrorToast(comfyPage)
      const errorToast = comfyPage.toast.withText('Test execution error')
      await expect(errorToast).toBeVisible()

      const toastBounds = await errorToast.boundingBox()
      const closeBounds = await closeButton(comfyPage).boundingBox()

      expect(toastBounds).not.toBeNull()
      expect(closeBounds).not.toBeNull()
      expect(overlaps(toastBounds!, closeBounds!)).toBe(false)
    })
  }

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
