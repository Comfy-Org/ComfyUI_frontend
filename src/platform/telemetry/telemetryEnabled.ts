import { isCloud } from '@/platform/distribution/types'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

const ENABLE_TELEMETRY_FEATURE = 'enable_telemetry'

/**
 * Desktop/host telemetry opt-in. The embedded frontend emits telemetry when
 * ComfyUI advertises the `enable_telemetry` feature flag, which desktop sets
 * from the user's consent. A dev-only localStorage override wins if present.
 */
export function isHostTelemetryEnabled(): boolean {
  const override = getDevOverride<boolean>(ENABLE_TELEMETRY_FEATURE)
  if (override !== undefined) return override

  return remoteConfig.value.enable_telemetry === true
}

/**
 * Whether telemetry should be emitted at all: cloud always, or desktop when the
 * host flag is on. Replaces the per-call-site `isCloud` gate so the same funnel
 * fires on desktop.
 */
export function isTelemetryEnabled(): boolean {
  return isCloud || isHostTelemetryEnabled()
}
