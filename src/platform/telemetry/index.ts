/**
 * Telemetry Provider - OSS Build Safety
 *
 * CRITICAL: OSS Build Safety
 * This module is conditionally compiled based on distribution. When building
 * the open source version (DISTRIBUTION unset), this entire module and its dependencies
 * are excluded through via tree-shaking.
 *
 * To verify OSS builds exclude this code:
 * 1. `DISTRIBUTION= pnpm build` (OSS build)
 * 2. `grep -RinE --include='*.js' 'trackWorkflow|trackEvent|mixpanel' dist/` (should find nothing)
 * 3. Check dist/assets/*.js files contain no tracking code
 *
 * This approach maintains complete separation between cloud and OSS builds
 * while ensuring the open source version contains no telemetry dependencies.
 */
import { isCloud } from '@/platform/distribution/types'

import { MixpanelTelemetryProvider } from './providers/cloud/MixpanelTelemetryProvider'
import { TelemetryService } from './services/TelemetryService'

// Singleton instance
let _telemetryService: TelemetryService | null = null

/**
 * Telemetry service factory - conditionally creates service with providers based on distribution
 * Returns singleton instance.
 *
 * CRITICAL: This returns null in OSS builds. There is no telemetry service
 * for OSS builds and all tracking calls are no-ops.
 */
export function useTelemetryService(): TelemetryService | null {
  if (_telemetryService === null) {
    // Use distribution check for tree-shaking
    if (isCloud) {
      _telemetryService = new TelemetryService()

      // Initialize and add Mixpanel provider
      const mixpanelProvider = new MixpanelTelemetryProvider()
      void mixpanelProvider.initialize().then(() => {
        _telemetryService?.addProvider(mixpanelProvider)
      })
    }
    // For OSS builds, _telemetryService stays null
  }

  return _telemetryService
}

/**
 * @deprecated Use useTelemetryService() instead
 */
export function useTelemetry() {
  return useTelemetryService()
}
