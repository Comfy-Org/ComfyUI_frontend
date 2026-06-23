import { setTelemetryRegistry } from './index'
import { isHostTelemetryEnabled } from './telemetryEnabled'
import { TelemetryRegistry } from './TelemetryRegistry'
import { HostTelemetrySink } from './providers/host/HostTelemetrySink'

export function initHostTelemetry(): void {
  if (!isHostTelemetryEnabled()) return
  if (!window.__comfyDesktop2?.Telemetry) return

  const registry = new TelemetryRegistry()
  registry.registerProvider(new HostTelemetrySink())
  setTelemetryRegistry(registry)
}
