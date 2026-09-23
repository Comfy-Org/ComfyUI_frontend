import { isHostTelemetryEnabled } from './hostTelemetryEnabled'
import { setTelemetryRegistry } from './index'
import { HostTelemetrySink } from './providers/host/HostTelemetrySink'
import { TelemetryRegistry } from './TelemetryRegistry'

export function initHostTelemetry(): void {
  if (!isHostTelemetryEnabled()) return
  if (!window.__comfyDesktop2?.Telemetry) return

  const registry = new TelemetryRegistry()
  registry.registerProvider(new HostTelemetrySink())
  setTelemetryRegistry(registry)
}
