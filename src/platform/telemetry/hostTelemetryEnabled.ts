import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

const ENABLE_TELEMETRY_FEATURE = 'enable_telemetry'

export function isHostTelemetryEnabled(): boolean {
  const override = getDevOverride<boolean>(ENABLE_TELEMETRY_FEATURE)
  if (override !== undefined) return override

  return remoteConfig.value.enable_telemetry === true
}
