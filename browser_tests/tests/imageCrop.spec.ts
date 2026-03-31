import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

type CropValue = { x: number; y: number; width: number; height: number } | null

async function getCropValue(comfyPage: ComfyPage): Promise<CropValue> {
  return comfyPage.page.evaluate(() => {
    const n = window.app!.graph.getNodeById(2)
    const w = n?.widgets?.find((w) => w.type === 'imagecrop')
    const v = w?.value as Record<string, number> | undefined
    return v ? { x: v.x, y: v.y, width: v.width, height: v.height } : null
  })
}

test.describe('Image Crop', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
  })

  test.describe('without source image', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/image_crop_widget')
      await comfyPage.vueNodes.waitForNodes()
    })

    test(
      'Shows empty state when no input image is connected',
      { tag: '@smoke' },
      async ({ comfyPage }) => {
        const node = comfyPage.vueNodes.getNodeLocator('1')
        await expect(node).toBeVisible()

        await expect
          .soft(node.locator('.icon-\\[lucide--image\\]'))
          .toBeVisible()
        await expect.soft(node).toContainText('No input image connected')
        await expect.soft(node.locator('.cursor-move')).toHaveCount(0)
        await expect.soft(node.locator('img')).toHaveCount(0)
      }
    )

    test(
      'Renders controls in default state',
      { tag: '@smoke' },
      async ({ comfyPage }) => {
        const node = comfyPage.vueNodes.getNodeLocator('1')
        await expect(node).toBeVisible()

        await expect(node.getByText('Ratio')).toBeVisible()
        await expect(
          node.locator('button:has(.icon-\\[lucide--lock-open\\])')
        ).toBeVisible()
        await expect(node.locator('input')).toHaveCount(4)
      }
    )
  })

  test.describe('with source image after execution', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/image_crop_with_source')
      await comfyPage.vueNodes.waitForNodes()
      await comfyPage.runButton.click()
      await expect(
        comfyPage.vueNodes.getNodeLocator('2').locator('img')
      ).toBeVisible({ timeout: 30_000 })
    })

    test(
      'Displays source image with crop overlay after execution',
      { tag: ['@smoke', '@screenshot'] },
      async ({ comfyPage }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        const img = node.locator('img')

        await expect
          .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBeGreaterThan(0)

        await expect(node.locator('.cursor-move')).toBeVisible()
        await comfyPage.nextFrame()
        await comfyPage.nextFrame()
        await comfyPage.page.evaluate(() =>
          Promise.all(
            document
              .getAnimations()
              .filter((a) => a.playState === 'running')
              .map((a) => a.finished.catch(() => undefined))
          )
        )
        await expect(node).toHaveScreenshot('image-crop-with-source.png', {
          maxDiffPixelRatio: 0.02
        })
      }
    )

    test(
      'Drag crop box updates crop position',
      { tag: ['@smoke', '@screenshot'] },
      async ({ comfyPage }) => {
        const node = comfyPage.vueNodes.getNodeLocator('2')
        const cropBox = node.locator('.cursor-move')
        const box = await cropBox.boundingBox()
        expect(box, 'Crop box not found').not.toBeNull()

        const valueBefore = await getCropValue(comfyPage)
        expect(
          valueBefore,
          'Widget value missing — check fixture setup'
        ).not.toBeNull()

        const startX = box!.x + box!.width / 2
        const startY = box!.y + box!.height / 2

        const pointerOpts = { bubbles: true, cancelable: true, pointerId: 1 }
        await cropBox.dispatchEvent('pointerdown', {
          ...pointerOpts,
          clientX: startX,
          clientY: startY
        })
        await comfyPage.nextFrame()
        await cropBox.dispatchEvent('pointermove', {
          ...pointerOpts,
          clientX: startX + 15,
          clientY: startY + 10
        })
        await comfyPage.nextFrame()
        await cropBox.dispatchEvent('pointermove', {
          ...pointerOpts,
          clientX: startX + 30,
          clientY: startY + 20
        })
        await cropBox.dispatchEvent('pointerup', {
          ...pointerOpts,
          clientX: startX + 30,
          clientY: startY + 20
        })
        await comfyPage.nextFrame()

        await expect(async () => {
          const valueAfter = await getCropValue(comfyPage)
          expect(valueAfter?.x).toBeGreaterThan(valueBefore!.x)
          expect(valueAfter?.y).toBeGreaterThan(valueBefore!.y)
          expect(valueAfter?.width).toBe(valueBefore!.width)
          expect(valueAfter?.height).toBe(valueBefore!.height)
        }).toPass()

        await expect(node).toHaveScreenshot('image-crop-after-drag.png')
      }
    )
  })
})
