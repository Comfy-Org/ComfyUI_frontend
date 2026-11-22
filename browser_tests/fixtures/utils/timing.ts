import type { Page } from '@playwright/test'

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function nextFrame(page: Page): Promise<number> {
  return page.evaluate(() => new Promise<number>(requestAnimationFrame))
}

declare global {
  interface Window {
    __releaseHeldFrames?: () => void
  }
}

/** Queues animation frame callbacks until the returned release runs them. */
export async function holdAnimationFrames(
  page: Page
): Promise<() => Promise<void>> {
  await page.evaluate(() => {
    const requestFrame = window.requestAnimationFrame
    const cancelFrame = window.cancelAnimationFrame
    const held = new Map<number, FrameRequestCallback>()
    let nextId = -1
    window.requestAnimationFrame = (callback) => {
      held.set(nextId, callback)
      return nextId--
    }
    window.cancelAnimationFrame = (id) => {
      if (!held.delete(id)) cancelFrame(id)
    }
    window.__releaseHeldFrames = () => {
      window.requestAnimationFrame = requestFrame
      window.cancelAnimationFrame = cancelFrame
      for (const callback of held.values()) requestFrame(callback)
    }
  })
  return async () => {
    await page.evaluate(() => window.__releaseHeldFrames?.())
    await nextFrame(page)
  }
}
