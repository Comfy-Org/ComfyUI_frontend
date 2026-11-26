import type { Locator } from '@playwright/test'

/** A rect read after it settled, with how far it moved while settling. */
export interface SettledBox {
  x: number
  y: number
  width: number
  height: number
  drift: number
}

/**
 * Reads `target`'s rect on each of the next `frames` animation frames inside the
 * page, and resolves with the last rect plus the largest offset from the first.
 * One round trip, so the sample and the frame are the same instant.
 */
export async function settledBox(
  target: Locator,
  frames: number
): Promise<SettledBox> {
  return target.evaluate(
    (element, frameCount: number) =>
      new Promise<SettledBox>((resolve) => {
        const first = element.getBoundingClientRect()
        let drift = 0
        let remaining = frameCount
        function sample() {
          const now = element.getBoundingClientRect()
          drift = Math.max(
            drift,
            Math.abs(now.x - first.x),
            Math.abs(now.y - first.y)
          )
          remaining -= 1
          if (remaining > 0) {
            requestAnimationFrame(sample)
            return
          }
          resolve({
            x: now.x,
            y: now.y,
            width: now.width,
            height: now.height,
            drift
          })
        }
        requestAnimationFrame(sample)
      }),
    frames
  )
}

/**
 * Whether `target` is both opaque and laid out. Playwright treats `opacity: 0`
 * as visible, so `toBeVisible()` alone passes on a card that has not been
 * placed yet and its rect is not worth sampling.
 */
export async function isPlaced(target: Locator): Promise<boolean> {
  return target.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return (
      Number(getComputedStyle(element).opacity) === 1 &&
      box.width > 0 &&
      box.height > 0
    )
  })
}
