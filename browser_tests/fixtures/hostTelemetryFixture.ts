import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export interface CapturedTelemetryEvent {
  event: string
  properties: Record<string, unknown>
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
