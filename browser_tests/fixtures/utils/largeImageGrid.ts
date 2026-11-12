import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { createLargePng } from '@e2e/fixtures/utils/largePng'

const GRID_NODE_COUNT = 12

export const GRID_IMAGE_NAMES = Array.from(
  { length: GRID_NODE_COUNT },
  (_, i) => `perf_grid_${i}.png`
)

export const GRID_LOGGED_FIELDS = [
  'durationMs',
  'frameDurationMs',
  'p95FrameDurationMs',
  'totalBlockingTimeMs',
  'taskDurationMs',
  'heapUsedBytes'
] as const

export async function uploadGridImages(comfyPage: ComfyPage, size: number) {
  for (const [i, name] of GRID_IMAGE_NAMES.entries()) {
    const response = await comfyPage.page.request.post(
      `${comfyPage.url}/api/upload/image`,
      {
        multipart: {
          image: {
            name,
            mimeType: 'image/png',
            buffer: createLargePng(size, size, i + 1)
          },
          overwrite: 'true',
          type: 'input'
        }
      }
    )
    expect(response.ok()).toBe(true)
  }
}

export async function waitForGridImagesDecoded(comfyPage: ComfyPage) {
  await expect(comfyPage.page.getByTestId('main-image')).toHaveCount(
    GRID_NODE_COUNT,
    { timeout: 30_000 }
  )
  await comfyPage.page.waitForFunction(
    async (count) => {
      const imgs = [
        ...document.querySelectorAll<HTMLImageElement>(
          '[data-testid="main-image"]'
        )
      ]
      if (imgs.length !== count) return false
      if (!imgs.every((img) => img.complete && img.naturalWidth > 0))
        return false
      await Promise.all(imgs.map((img) => img.decode()))
      return true
    },
    GRID_NODE_COUNT,
    { timeout: 30_000, polling: 100 }
  )
}

export async function panSweep(comfyPage: ComfyPage) {
  const { page } = comfyPage
  const { cx, cy } = await canvasCenter(comfyPage)
  await page.mouse.move(cx, cy)
  await page.mouse.down({ button: 'middle' })
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(cx + Math.sin(i / 6) * 300, cy + (i % 20) * 8)
    await comfyPage.nextFrame()
  }
  await page.mouse.up({ button: 'middle' })
}

export async function zoomSweep(comfyPage: ComfyPage) {
  const { page } = comfyPage
  const { cx, cy } = await canvasCenter(comfyPage)
  await page.mouse.move(cx, cy)
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, i < 15 ? -120 : 120)
    await comfyPage.nextFrame()
  }
}

async function canvasCenter(comfyPage: ComfyPage) {
  const box = await comfyPage.canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 }
}
