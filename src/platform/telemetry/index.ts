/**
 * Telemetry Provider - OSS Build Safety
 *
 * CRITICAL: OSS Build Safety
 * This module uses dynamic imports to ensure all cloud telemetry code
 * is tree-shaken from OSS builds. No top-level imports of provider code.
 *
 * To verify OSS builds exclude this code:
 * 1. `DISTRIBUTION= pnpm build` (OSS build)
 * 2. `grep -RinE --include='*.js' 'mixpanel|googletagmanager|dataLayer' dist/`
 * 3. Should find nothing
 */
import type { TelemetryDispatcher } from './types'

const IS_CLOUD_BUILD = __DISTRIBUTION__ === 'cloud'

let _telemetryRegistry: TelemetryDispatcher | null = null
let _initPromise: Promise<void> | null = null

/**
 * Initialize telemetry providers for cloud builds.
 * Must be called early in app startup (e.g., main.ts).
 * Safe to call multiple times - only initializes once.
 */
export async function initTelemetry(): Promise<void> {
  if (!IS_CLOUD_BUILD) return
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    const [
      { TelemetryRegistry },
      { MixpanelTelemetryProvider },
      { GtmTelemetryProvider }
    ] = await Promise.all([
      import('./TelemetryRegistry'),
      import('./providers/cloud/MixpanelTelemetryProvider'),
      import('./providers/cloud/GtmTelemetryProvider')
    ])

    const registry = new TelemetryRegistry()
    registry.registerProvider(new MixpanelTelemetryProvider())
    registry.registerProvider(new GtmTelemetryProvider())

    _telemetryRegistry = registry
  })()

  return _initPromise
}

/**
 * Get the telemetry dispatcher for tracking events.
 * Returns null in OSS builds - all tracking calls become no-ops.
 *
 * Usage: useTelemetry()?.trackAuth({ method: 'google' })
 */
export function useTelemetry(): TelemetryDispatcher | null {
  return _telemetryRegistry
}
