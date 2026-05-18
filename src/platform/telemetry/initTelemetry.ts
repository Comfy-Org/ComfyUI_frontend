/**
 * Telemetry Provider - Cloud Initialization
 *
 * This module is only imported in cloud builds to keep
 * cloud telemetry code out of local/desktop bundles.
 */
import { setTelemetryRegistry } from './index'

const IS_CLOUD_BUILD = __DISTRIBUTION__ === 'cloud'

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
      { GtmTelemetryProvider },
      { ImpactTelemetryProvider },
      { PostHogTelemetryProvider },
      { ClickHouseTelemetryProvider }
    ] = await Promise.all([
      import('./TelemetryRegistry'),
      import('./providers/cloud/MixpanelTelemetryProvider'),
      import('./providers/cloud/GtmTelemetryProvider'),
      import('./providers/cloud/ImpactTelemetryProvider'),
      import('./providers/cloud/PostHogTelemetryProvider'),
      import('./providers/cloud/ClickHouseTelemetryProvider')
    ])

    const registry = new TelemetryRegistry()
    registry.registerProvider(new MixpanelTelemetryProvider())
    registry.registerProvider(new GtmTelemetryProvider())
    registry.registerProvider(new ImpactTelemetryProvider())
    registry.registerProvider(new PostHogTelemetryProvider())
    registry.registerProvider(new ClickHouseTelemetryProvider())

    setTelemetryRegistry(registry)
  })()

  return _initPromise
}
