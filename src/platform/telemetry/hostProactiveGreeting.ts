import type { ProactiveGreetingTelemetryContext } from '@comfyorg/telemetry/types'

import { isHostTelemetryEnabled } from './hostTelemetryEnabled'

export function supportsHostProactiveGreeting(): boolean {
  const telemetry = window.__comfyDesktop2?.Telemetry
  return (
    telemetry !== undefined &&
    'proactiveGreetingExperimentVersion' in telemetry &&
    telemetry.proactiveGreetingExperimentVersion === 1 &&
    'canEnrollProactiveGreeting' in telemetry &&
    typeof telemetry.canEnrollProactiveGreeting === 'function'
  )
}

export async function canEnrollHostProactiveGreeting(
  userId: string
): Promise<boolean> {
  const telemetry = window.__comfyDesktop2?.Telemetry
  if (
    !isHostTelemetryEnabled() ||
    !supportsHostProactiveGreeting() ||
    !telemetry ||
    !('canEnrollProactiveGreeting' in telemetry) ||
    typeof telemetry.canEnrollProactiveGreeting !== 'function'
  )
    return false
  try {
    const result: unknown = await telemetry.canEnrollProactiveGreeting(userId)
    return result === true
  } catch {
    return false
  }
}

export function hostProactiveGreetingProperties(
  context: ProactiveGreetingTelemetryContext
) {
  return {
    proactive_greeting_user_id: context.user_id,
    proactive_greeting_workspace_id: context.workspace_id,
    proactive_greeting_group_key: context.group_key,
    proactive_greeting_variant: context.variant
  }
}
