import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export interface CapturedTelemetryEvent {
  event: string
  properties: Record<string, unknown>
}

/**
 * A `reportError()` call as the Desktop bridge receives it.
 *
 * `properties` is the flattened tag bag `reportError` builds — the caller's
 * `tags` plus `error_type`, `surface` and `level`. Reading the report here is
 * the only way a browser spec can see it: Sentry is not initialized in E2E and
 * Datadog RUM is gated on a comfy.org hostname, so those two sinks are inert
 * and the report only pends. The bridge leg is a production path of its own
 * (`main.ts` registers the host sink whenever `window.__comfyDesktop2` exists),
 * not a hook added for tests.
 */
export interface CapturedHostErrorReport {
  message: string
  stack?: string
  properties: Record<string, unknown>
}

export const hostTelemetryFixture = base.extend<{
  hostTelemetry: CapturedTelemetryEvent[]
  hostErrorReports: CapturedHostErrorReport[]
}>({
  hostTelemetry: async ({ browserName: _browserName }, use) => {
    await use([])
  },
  hostErrorReports: async ({ browserName: _browserName }, use) => {
    await use([])
  },
  page: async ({ page, hostTelemetry, hostErrorReports }, use) => {
    await page.exposeFunction(
      '__captureHostTelemetry',
      (captured: CapturedTelemetryEvent) => {
        hostTelemetry.push(captured)
      }
    )
    await page.exposeFunction(
      '__captureHostErrorReport',
      (captured: CapturedHostErrorReport) => {
        hostErrorReports.push(captured)
      }
    )
    await page.addInitScript(() => {
      Object.assign(window, {
        __comfyDesktop2: {
          isRemote: () => false,
          Telemetry: {
            capture: (event: string, properties: Record<string, unknown>) => {
              void window.__captureHostTelemetry?.({ event, properties })
            },
            captureException: (
              error: { message: string; stack?: string },
              properties: Record<string, unknown>
            ) => {
              void window.__captureHostErrorReport?.({
                message: error.message,
                stack: error.stack,
                properties
              })
            }
          }
        }
      })
    })
    await use(page)
  }
})
