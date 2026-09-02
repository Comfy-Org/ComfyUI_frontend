import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export async function clientPointOnMinimapOverlay(
  overlay: Locator,
  relX: number,
  relY: number
): Promise<{ clientX: number; clientY: number }> {
  const box = await overlay.boundingBox()
  expect(box, 'Minimap interaction overlay not found').toBeTruthy()
  return {
    clientX: box!.x + box!.width * relX,
    clientY: box!.y + box!.height * relY
  }
}

export const MINIMAP_POINTER_OPTS = {
  bubbles: true,
  cancelable: true,
  pointerId: 1
} as const

export async function readMainCanvasOffset(
  page: Page
): Promise<{ x: number; y: number }> {
  return page.evaluate(() => ({
    x: window.app!.canvas.ds.offset[0],
    y: window.app!.canvas.ds.offset[1]
  }))
}
