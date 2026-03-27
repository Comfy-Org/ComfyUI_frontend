import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Image Compare', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('widgets/image_compare_widget')
    await comfyPage.vueNodes.waitForNodes()
  })

  function createTestImageDataUrl(label: string, color: string): string {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">` +
      `<rect width="200" height="200" fill="${color}"/>` +
      `<text x="50%" y="50%" fill="white" font-size="24" ` +
      `text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  async function setImageCompareValue(
    comfyPage: ComfyPage,
    value: { beforeImages: string[]; afterImages: string[] }
  ) {
    await comfyPage.page.evaluate(
      ({ value }) => {
        const node = window.app!.graph.getNodeById(1)
        const widget = node?.widgets?.find((w) => w.type === 'imagecompare')
        if (widget) {
          widget.value = value
          widget.callback?.(value)
        }
      },
      { value }
    )
    await comfyPage.nextFrame()
  }

  test(
    'Shows empty state when no images are set',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()

      await expect(node).toContainText('No images to compare')
      await expect(node.locator('img')).toHaveCount(0)
      await expect(node.locator('[role="presentation"]')).toHaveCount(0)
    }
  )

  test(
    'Slider defaults to 50% with both images set',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const beforeUrl = createTestImageDataUrl('Before', '#c00')
      const afterUrl = createTestImageDataUrl('After', '#00c')
      await setImageCompareValue(comfyPage, {
        beforeImages: [beforeUrl],
        afterImages: [afterUrl]
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      const beforeImg = node.locator('img[alt="Before image"]')
      const afterImg = node.locator('img[alt="After image"]')
      await expect(beforeImg).toBeVisible()
      await expect(afterImg).toBeVisible()

      const handle = node.locator('[role="presentation"]')
      await expect(handle).toBeVisible()

      expect(
        await handle.evaluate((el) => (el as HTMLElement).style.left)
      ).toBe('50%')
      await expect(beforeImg).toHaveCSS('clip-path', /50%/)

      await expect(node).toHaveScreenshot('image-compare-default-50.png')
    }
  )
})
