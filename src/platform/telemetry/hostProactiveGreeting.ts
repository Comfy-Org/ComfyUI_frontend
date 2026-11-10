import type {
  ComfyDesktop2TelemetryBridge,
  ComfyDesktop2TelemetryProperties
} from '@comfyorg/comfyui-desktop-bridge-types'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { ProactiveGreetingTelemetryContext } from '@comfyorg/telemetry/types'
import { isCloud } from '@/platform/distribution/types'

type HostAdmission = 'allowed' | 'denied' | 'verify-firebase'

interface ProactiveGreetingCapability {
  proactiveGreetingExperimentVersion: 1 | 2
  getProactiveGreetingAdmission(
    userId: string,
    firebaseIdToken?: string
  ): Promise<HostAdmission>
  enrollProactiveGreeting(
    properties: ComfyDesktop2TelemetryProperties
  ): Promise<boolean>
  onProactiveGreetingAdmissionChanged(callback: () => void): () => void
}

type ProactiveGreetingBridge = ComfyDesktop2TelemetryBridge &
  ProactiveGreetingCapability

type HostOperation = 'admission' | 'subscribe' | 'enroll' | 'capture'
const reportedHostFailures = new Set<HostOperation>()

export function reportHostProactiveGreetingFailure(
  operation: HostOperation
): void {
  if (reportedHostFailures.has(operation)) return
  reportedHostFailures.add(operation)
  reportError(new Error('Desktop proactive greeting bridge call failed'), {
    errorType: 'failure_in_desktop_proactive_greeting_bridge',
    surface: 'agent',
    level: 'warning',
    tags: { operation }
  })
}

export function requiresHostProactiveGreetingAdmission(): boolean {
  return !isCloud || Boolean(window.__comfyDesktop2?.Telemetry)
}

export function getHostProactiveGreetingBridge():
  | ProactiveGreetingBridge
  | undefined {
  const telemetry:
    | (ComfyDesktop2TelemetryBridge & Partial<ProactiveGreetingCapability>)
    | undefined = window.__comfyDesktop2?.Telemetry
  if (
    telemetry?.proactiveGreetingExperimentVersion === 2 &&
    typeof telemetry.getProactiveGreetingAdmission === 'function' &&
    typeof telemetry.enrollProactiveGreeting === 'function' &&
    typeof telemetry.onProactiveGreetingAdmissionChanged === 'function'
  )
    return telemetry as ProactiveGreetingBridge
}

export function supportsHostProactiveGreeting(): boolean {
  return getHostProactiveGreetingBridge() !== undefined
}

export async function getHostProactiveGreetingAdmission(
  userId: string,
  firebaseIdToken?: string
): Promise<HostAdmission> {
  const telemetry = getHostProactiveGreetingBridge()
  if (!telemetry) return 'denied'
  try {
    const result: unknown = await telemetry.getProactiveGreetingAdmission(
      userId,
      firebaseIdToken
    )
    return result === 'allowed' || result === 'verify-firebase'
      ? result
      : 'denied'
  } catch {
    reportHostProactiveGreetingFailure('admission')
    return 'denied'
  }
}

export function subscribeToHostProactiveGreetingAdmission(
  callback: () => void
): (() => void) | undefined {
  const telemetry = getHostProactiveGreetingBridge()
  if (!telemetry) return
  try {
    const unsubscribe: unknown =
      telemetry.onProactiveGreetingAdmissionChanged(callback)
    if (typeof unsubscribe === 'function') return () => unsubscribe()
  } catch {
    reportHostProactiveGreetingFailure('subscribe')
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
