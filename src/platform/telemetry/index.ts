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
import { MixpanelTelemetryProvider } from './providers/cloud/MixpanelTelemetryProvider'
import type { TelemetryProvider } from './types'

type GtmModule = {
  initGtm: () => void
  pushDataLayerEvent: (event: Record<string, unknown>) => void
}

// Singleton instance
let _telemetryProvider: TelemetryProvider | null = null
let gtmModulePromise: Promise<GtmModule> | null = null
const IS_CLOUD_BUILD = __DISTRIBUTION__ === 'cloud'

function loadGtmModule(): Promise<GtmModule> {
  if (!gtmModulePromise) {
    gtmModulePromise = import('./gtm')
  }
  return gtmModulePromise
}

/**
 * Telemetry factory - conditionally creates provider based on distribution
 * Returns singleton instance.
 *
 * CRITICAL: This returns undefined in OSS builds. There is no telemetry provider
 * for OSS builds and all tracking calls are no-ops.
 */
export function useTelemetry(): TelemetryProvider | null {
  if (_telemetryProvider === null) {
    // Use distribution check for tree-shaking
    if (IS_CLOUD_BUILD) {
      _telemetryProvider = new MixpanelTelemetryProvider()
    }
    // For OSS builds, _telemetryProvider stays null
  }

  return _telemetryProvider
}

export function initGtm(): void {
  if (!IS_CLOUD_BUILD || typeof window === 'undefined') return
  void loadGtmModule().then(({ initGtm }) => {
    initGtm()
  })
}

export function pushDataLayerEvent(event: Record<string, unknown>): void {
  if (!IS_CLOUD_BUILD || typeof window === 'undefined') return
  void loadGtmModule().then(({ pushDataLayerEvent }) => {
    pushDataLayerEvent(event)
  })
}
