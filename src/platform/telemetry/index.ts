/**
 * Telemetry Provider - OSS Build Safety
 *
 * ⚠️ CRITICAL: OSS Build Safety ⚠️
 * This module is conditionally compiled based on distribution. When building
 * the open source version (DISTRIBUTION unset), this entire module and its dependencies
 * are excluded through Vite's tree-shaking optimization.
 *
 * To verify OSS builds exclude this code:
 * 1. `DISTRIBUTION= pnpm build` (OSS build)
 * 2. `rg -r dist "telemetry|mixpanel"` (should find nothing)
 * 3. Check dist/assets/*.js files contain no tracking code
 *
 * This approach maintains complete separation between cloud and OSS builds
 * while ensuring the open source version contains no telemetry dependencies.
 */
import { isCloud } from '@/platform/distribution/types'

import { MixpanelTelemetryProvider } from './providers/cloud/MixpanelTelemetryProvider'
import type { TelemetryProvider } from './types'

// Singleton instance
let _telemetryProvider: TelemetryProvider | null = null

/**
 * Telemetry factory - conditionally creates provider based on distribution
 * Returns singleton instance
 */
export function useTelemetry(): TelemetryProvider | null {
  if (_telemetryProvider === null) {
    // Use distribution check for tree-shaking
    if (isCloud) {
      _telemetryProvider = new MixpanelTelemetryProvider()
    }
    // For OSS builds, _telemetryProvider stays null
  }

  return _telemetryProvider
}
