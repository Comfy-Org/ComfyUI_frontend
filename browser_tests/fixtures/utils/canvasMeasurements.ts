import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export interface CanvasBox {
  readonly layoutWidth: number
  readonly layoutHeight: number
  readonly backingWidth: number
  readonly backingHeight: number
  readonly containerWidth: number
  readonly containerHeight: number
}

export async function readCanvasBox(page: Page): Promise<CanvasBox> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#graph-canvas')!
    const container = canvas.parentElement!
    const rect = canvas.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    return {
      layoutWidth: rect.width,
      layoutHeight: rect.height,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height
    }
  })
}

export function expectDevicePixelBackingStore(
  box: CanvasBox,
  dpr: number
): void {
  expect(box.backingWidth).toBe(Math.round(box.layoutWidth * dpr))
  expect(box.backingHeight).toBe(Math.round(box.layoutHeight * dpr))
}
