import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export interface CapturedTelemetryEvent {
  event: string
  properties: Record<string, unknown>
}

export const hostTelemetryFixture = base.extend<{
  hostTelemetry: CapturedTelemetryEvent[]
}>({
  hostTelemetry: async ({ page }, use) => {
    const capturedTelemetry: CapturedTelemetryEvent[] = []
    await page.exposeFunction(
      '__captureHostTelemetry',
      (captured: CapturedTelemetryEvent) => capturedTelemetry.push(captured)
    )
    await page.addInitScript(() => {
      Object.assign(window, {
        __comfyDesktop2: {
          isRemote: () => false,
          Telemetry: {
            capture: (event: string, properties: Record<string, unknown>) => {
              void window.__captureHostTelemetry({ event, properties })
            }
          }
        }
      })
    })
    await use(capturedTelemetry)
  }
})
