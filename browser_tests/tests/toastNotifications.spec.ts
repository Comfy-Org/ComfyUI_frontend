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

  test(
    'Toast fits within the mobile viewport',
    { tag: '@mobile' },
    async ({ comfyPage }) => {
      const summary =
        'Mobile viewport regression toast with an intentionally long summary'
      const detail =
        'This notification contains enough detail to wrap across several lines and verify that every part remains visible inside the narrow mobile viewport.'
      await comfyPage.page.evaluate(
        ({ summary, detail }) => {
          window.app!.extensionManager.toast.add({
            severity: 'error',
            summary,
            detail,
            life: 30000
          })
        },
        { summary, detail }
      )
      await comfyPage.nextFrame()

      const toast = comfyPage.page
        .locator('.p-toast-message')
        .filter({ hasText: summary })
      const toastDetail = toast.getByText(detail, { exact: true })
      const viewport = comfyPage.page.viewportSize()
      if (!viewport) {
        throw new Error('The mobile test requires a configured viewport')
      }

      await expect(toast).toBeInViewport({
        ratio: 1
      })
      await expect(toastDetail).toBeInViewport({ ratio: 1 })
      await expect
        .poll(async () => (await toast.boundingBox())?.x ?? 0)
        .toBeGreaterThanOrEqual(16)
      await expect
        .poll(async () => {
          const box = await toast.boundingBox()
          return box ? viewport.width - box.x - box.width : 0
        })
        .toBeGreaterThanOrEqual(16)

      await comfyPage.page.setViewportSize({ width: 800, height: 851 })
      await expect
        .poll(() =>
          toast.evaluate((message) => {
            const root = message.closest('.p-toast')
            const graph = document.querySelector('.graph-canvas-container')
            if (!root || !graph) return Number.POSITIVE_INFINITY

            const graphRect = graph.getBoundingClientRect()
            const expectedRight =
              window.innerWidth - (graphRect.left + graphRect.width) + 20
            return Math.abs(
              Number.parseFloat(getComputedStyle(root).right) - expectedRight
            )
          })
        )
        .toBeLessThanOrEqual(0.5)
    }
  )
})
