import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export interface CapturedTelemetryEvent {
  event: string
  properties: Record<string, unknown>
}

let drainMarkers = 0

/**
 * Waits until every telemetry capture issued so far has reached
 * {@link hostTelemetryFixture}'s array.
 *
 * Only *absence* assertions need this. The bridge below hands each event to the
 * `__captureHostTelemetry` binding and discards the promise (`void`), so
 * delivery into `hostTelemetry` is asynchronous: a test that reads the array
 * immediately after an interaction can find it still empty, and
 * `expect(hostTelemetry.some(...)).toBe(false)` then passes whether or not the
 * app emitted the event. Presence assertions are already safe because
 * `expect.poll` retries until the event lands.
 *
 * The boundary is a marker pushed through the same binding: awaiting its
 * round-trip proves the channel has drained, and bindings from one page are
 * delivered in call order, so anything captured earlier has already arrived.
 * The marker is removed again so callers only ever see real events.
 */
export async function drainHostTelemetry(
  page: Page,
  hostTelemetry: CapturedTelemetryEvent[]
): Promise<void> {
  const marker = `e2e:host_telemetry_drain_${++drainMarkers}`
  await page.evaluate(async (event) => {
    await window.__captureHostTelemetry?.({ event, properties: {} })
  }, marker)
  // Fails loudly rather than silently skipping the boundary if the binding is
  // ever missing, which the optional call above would otherwise swallow.
  await expect
    .poll(() => hostTelemetry.some(({ event }) => event === marker))
    .toBe(true)
  hostTelemetry.splice(
    hostTelemetry.findIndex(({ event }) => event === marker),
    1
  )
}

export const hostTelemetryFixture = base.extend<{
  hostTelemetry: CapturedTelemetryEvent[]
}>({
  hostTelemetry: async ({ browserName: _browserName }, use) => {
    await use([])
  },
  page: async ({ page, hostTelemetry }, use) => {
    await page.exposeFunction(
      '__captureHostTelemetry',
      (captured: CapturedTelemetryEvent) => {
        hostTelemetry.push(captured)
      }
    )
    await page.addInitScript(() => {
      Object.assign(window, {
        __comfyDesktop2: {
          isRemote: () => false,
          Telemetry: {
            capture: (event: string, properties: Record<string, unknown>) => {
              void window.__captureHostTelemetry?.({ event, properties })
            }
          }
        }
      })
    })
    await use(page)
  }
})
