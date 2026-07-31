import type { Page } from '@playwright/test'

/**
 * Dispatches a wire-level custom event on the app's api singleton, simulating
 * a websocket broadcast (e.g. `assets.seed.fast_complete`). Uses the raw
 * EventTarget dispatch because `api.dispatchCustomEvent` is typed against the
 * ApiEventTypes map, which deliberately excludes events consumed via
 * `addCustomEventListener`.
 */
export async function dispatchApiCustomEvent(
  page: Page,
  type: string
): Promise<void> {
  await page.evaluate((eventType) => {
    EventTarget.prototype.dispatchEvent.call(
      window.app!.api,
      new CustomEvent(eventType)
    )
  }, type)
}
