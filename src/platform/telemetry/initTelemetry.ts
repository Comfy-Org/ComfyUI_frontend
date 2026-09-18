/**
 * Telemetry Provider - Cloud Initialization
 *
 * This module is only imported in cloud builds to keep
 * cloud telemetry code out of local/desktop bundles.
 */
import { setTelemetryRegistry } from './index'
import { TelemetryRegistry } from './TelemetryRegistry'

const IS_CLOUD_BUILD = __DISTRIBUTION__ === 'cloud'

let _initPromise: Promise<void> | null = null
let cloudRegistry: TelemetryRegistry | undefined

export function initTelemetryRegistry(): TelemetryRegistry | undefined {
  if (!IS_CLOUD_BUILD) return
  if (!cloudRegistry) {
    cloudRegistry = new TelemetryRegistry()
    setTelemetryRegistry(cloudRegistry)
  }
  return cloudRegistry
}

/**
 * Initialize telemetry providers for cloud builds.
 * Must be called early in app startup (e.g., main.ts).
 * Safe to call multiple times - only initializes once.
 */
export async function initTelemetry(): Promise<void> {
  const registry = initTelemetryRegistry()
  if (!registry) return
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    const [
      { MixpanelTelemetryProvider },
      { GtmTelemetryProvider },
      { ImpactTelemetryProvider },
      { PostHogTelemetryProvider },
      { ClickHouseTelemetryProvider },
      { SyftTelemetryProvider },
      { CustomerIoTelemetryProvider },
      { DatadogRumTelemetryProvider },
      { SentryTelemetryProvider }
    ] = await Promise.all([
      import('./providers/cloud/MixpanelTelemetryProvider'),
      import('./providers/cloud/GtmTelemetryProvider'),
      import('./providers/cloud/ImpactTelemetryProvider'),
      import('./providers/cloud/PostHogTelemetryProvider'),
      import('./providers/cloud/ClickHouseTelemetryProvider'),
      import('./providers/cloud/SyftTelemetryProvider'),
      import('./providers/cloud/CustomerIoTelemetryProvider'),
      import('./providers/cloud/DatadogRumTelemetryProvider'),
      import('./providers/cloud/SentryTelemetryProvider')
    ])

    registry.registerProvider(new MixpanelTelemetryProvider())
    registry.registerProvider(new GtmTelemetryProvider())
    registry.registerProvider(new ImpactTelemetryProvider())
    registry.registerProvider(new PostHogTelemetryProvider())
    registry.registerProvider(new ClickHouseTelemetryProvider())
    registry.registerProvider(new SyftTelemetryProvider())
    registry.registerProvider(new CustomerIoTelemetryProvider())
    registry.registerProvider(new DatadogRumTelemetryProvider())
    registry.registerProvider(new SentryTelemetryProvider())
  })()

  return _initPromise
}
