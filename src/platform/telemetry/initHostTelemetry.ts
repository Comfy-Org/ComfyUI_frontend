import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

import { setTelemetryRegistry } from './index'
import { HostTelemetrySink } from './providers/host/HostTelemetrySink'
import { TelemetryRegistry } from './TelemetryRegistry'

const ENABLE_TELEMETRY_FEATURE = 'enable_telemetry'

function isHostTelemetryEnabled(): boolean {
  const override = getDevOverride<boolean>(ENABLE_TELEMETRY_FEATURE)
  if (override !== undefined) return override

  return remoteConfig.value.enable_telemetry === true
}

export function initHostTelemetry(): void {
  if (!isHostTelemetryEnabled()) return
  if (!window.__comfyDesktop2?.Telemetry) return

  const registry = new TelemetryRegistry()
  registry.registerProvider(new HostTelemetrySink())
  setTelemetryRegistry(registry)
}
