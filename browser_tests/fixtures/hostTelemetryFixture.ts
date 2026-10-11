import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export interface CapturedTelemetryEvent {
  event: string
  properties: Record<string, unknown>
}

let drainMarkers = 0

export async function drainHostTelemetry(
  page: Page,
  hostTelemetry: CapturedTelemetryEvent[]
): Promise<void> {
  const marker = `e2e:host_telemetry_drain_${++drainMarkers}`
  await page.evaluate(async (event) => {
    await window.__captureHostTelemetry?.({ event, properties: {} })
  }, marker)
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
