import { mergeTests } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { agentConsentTest } from '@e2e/fixtures/agentConsentFixture'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'
import type { CapturedTelemetryEvent } from '@e2e/fixtures/hostTelemetryFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

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
const test = mergeTests(agentConsentTest, hostTelemetryFixture)

export const agentConsentTelemetryTest = test.extend<{
  consentTelemetry: CapturedTelemetryEvent[]
}>({
  consentTelemetry: async ({ hostTelemetry }, use) => use(hostTelemetry),
  page: async ({ page }, use) => {
    // Layered over the fixture's own `/api/features`, which the later route
    // wins. Keep the authenticated allowlist grant from the base fixture: that
    // grant is read directly from remote config once auth has loaded, not from
    // PostHog's bootstrap flags. `enable_telemetry` gates the host sink.
    const features: RemoteConfig = {
      'agent-in-app-experience': true,
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
