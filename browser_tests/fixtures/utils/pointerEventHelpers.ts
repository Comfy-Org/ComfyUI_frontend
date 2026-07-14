import type { Page } from '@playwright/test'

/**
 * Headless Chromium does not track pointer captures initiated by
 * synthetic PointerEvents (created via `new PointerEvent()`).
 * Reka-ui's SliderImpl gates `slideEnd` emission on
 * `target.hasPointerCapture(pointerId)`, which returns false in this
 * scenario, preventing the pressed-state from clearing.
 *
 * This patch adds a shadow WeakMap tracker so that
 * `setPointerCapture` / `hasPointerCapture` / `releasePointerCapture`
 * work correctly for synthetic pointer IDs.
 *
 * Call once per page, before any slider interactions.
 */
export async function patchPointerCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const captures = new WeakMap<Element, Set<number>>()
    const origSet = Element.prototype.setPointerCapture
    const origRelease = Element.prototype.releasePointerCapture
    const origHas = Element.prototype.hasPointerCapture
    Element.prototype.setPointerCapture = function (id: number) {
      let ids = captures.get(this)
      if (!ids) captures.set(this, (ids = new Set()))
      ids.add(id)
      try {
        origSet.call(this, id)
      } catch {
        /* synthetic pointerId not tracked by browser */
      }
    }
    Element.prototype.hasPointerCapture = function (id: number) {
      return captures.get(this)?.has(id) ?? origHas.call(this, id)
    }
    Element.prototype.releasePointerCapture = function (id: number) {
      captures.get(this)?.delete(id)
      try {
        origRelease.call(this, id)
      } catch {
        /* synthetic pointerId not tracked by browser */
      }
    }
  })
}

export function dispatchPointerEvent({
  selector,
  type
}: {
  selector: string
  type: string
}) {
  const el = document.querySelector(selector)
  el?.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse'
    })
  )
}
