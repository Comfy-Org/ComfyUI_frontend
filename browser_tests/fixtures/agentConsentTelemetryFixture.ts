import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { agentConsentTest } from '@e2e/fixtures/agentConsentFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

export interface CapturedTelemetryEvent {
  event: string
  properties: Record<string, unknown>
}

/**
 * Reads the consent surface's telemetry from inside a real browser.
 *
 * It captures at the **host bridge**, not over the network. `main.ts` registers
 * the host sink after the cloud one when `window.__comfyDesktop2.Telemetry`
 * exists, and `setTelemetryRegistry` keeps the last registry - so every
 * `useTelemetry()` call in the app lands here synchronously, with no batching,
 * no compression and no third-party host to decode. Cloud plus a host bridge is
 * a configuration that exists in production (`main.ts` has an
 * `isCloud && hasHostTelemetryBridge` branch of its own), not one fabricated for
 * the test.
 *
 * What that does and does not prove: the browser proves which events a real
 * interaction produces and with which properties, through the same
 * `TelemetryRegistry` the PostHog provider is registered on. The mapping from a
 * registry call to a PostHog capture is asserted by
 * `PostHogTelemetryProvider.test.ts`, not here.
 *
 * PostHog still initializes, because the agent feature flag is bootstrapped
 * through it; its ingest host is routed so nothing leaves the browser and the
 * network-isolation fixture stays satisfied.
 */
export const agentConsentTelemetryTest = agentConsentTest.extend<{
  consentTelemetry: CapturedTelemetryEvent[]
}>({
  consentTelemetry: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    await use([])
  },
  page: async ({ page, consentTelemetry }, use) => {
    await page.exposeFunction(
      '__captureHostTelemetry',
      (captured: CapturedTelemetryEvent) => {
        consentTelemetry.push(captured)
      }
    )
    await page.addInitScript(() => {
      // Declared before the app boots so `hasHostTelemetryBridge` sees it.
      Object.assign(window, {
        __comfyDesktop2: {
          isRemote: () => false,
          Telemetry: {
            capture: (event: string, properties: Record<string, unknown>) => {
              void (
                window as unknown as {
                  __captureHostTelemetry: (
                    captured: CapturedTelemetryEvent
                  ) => Promise<void>
                }
              ).__captureHostTelemetry({ event, properties })
            }
          }
        }
      })
    })
    // Layered over the fixture's own `/api/features`, which the later route
    // wins. `enable_telemetry` is what gates the host sink; the PostHog values
    // repeat the fixture's because the agent flag is bootstrapped through them.
    const features: RemoteConfig = {
      enable_telemetry: true,
      posthog_project_token: 'phc_e2e_agent_consent_outcome',
      posthog_config: {
        advanced_disable_flags: true,
        bootstrap: {
          featureFlags: { 'agent-in-app-experience': true }
        }
      }
    }
    await page.route('**/api/features', (route) =>
      route.fulfill(jsonRoute(features))
    )
    await page.route('**://t.comfy.org/**', (route) =>
      route.fulfill(jsonRoute({ status: 1 }))
    )
    await use(page)
  }
})
