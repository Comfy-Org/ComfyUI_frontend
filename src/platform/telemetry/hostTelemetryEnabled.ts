import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

const ENABLE_TELEMETRY_FEATURE = 'enable_telemetry'

export function isHostTelemetryEnabled(): boolean {
  const override = getDevOverride<boolean>(ENABLE_TELEMETRY_FEATURE)
  if (override !== undefined) return override

  return useRemoteConfigStore().config.enable_telemetry === true
}
