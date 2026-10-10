import type {
  SsoFlow,
  SsoRequiredPresentation,
  SsoRequiredTrigger,
  SsoSignInFailureReason,
  SsoSurface
} from '@comfyorg/account-core/telemetry'
import {
  createSsoFlow,
  SSO_TELEMETRY_EVENT,
  ssoFlowStore
} from '@comfyorg/account-core/telemetry'

import { useTelemetry } from '@/platform/telemetry'

/** The attempt that just signed in, until its first workspace opens. */
let signedInFlow: SsoFlow | undefined

function flowProperties({ flowId, surface }: SsoFlow) {
  return { surface, flow_id: flowId }
}

/**
 * Starts a new attempt each time SSO is required. A `redirect` leaves for SSO
 * without a screen, so its attempt is already continued.
 */
export function trackSsoRequiredShown(
  surface: SsoSurface,
  trigger: SsoRequiredTrigger,
  presentation: SsoRequiredPresentation
): void {
  const telemetry = useTelemetry()
  if (!telemetry) return
  const flow = ssoFlowStore.start(
    trigger === 'customer_create' ? 'cloud_customer_create' : surface,
    presentation === 'redirect'
  )
  telemetry.trackSsoEvent({
    name: SSO_TELEMETRY_EVENT.requiredShown,
    properties: { ...flowProperties(flow), trigger, presentation }
  })
}

export function trackSsoContinueClicked(surface: SsoSurface): void {
  const telemetry = useTelemetry()
  if (!telemetry) return
  const flow = ssoFlowStore.markContinued(surface)
  telemetry.trackSsoEvent({
    name: SSO_TELEMETRY_EVENT.continueClicked,
    properties: flowProperties(flow)
  })
}

export function trackSsoSignInFailed(
  reason: SsoSignInFailureReason,
  surface: SsoSurface
): void {
  const telemetry = useTelemetry()
  if (!telemetry) return
  const flow = ssoFlowStore.finish() ?? createSsoFlow(surface)
  telemetry.trackSsoEvent({
    name: SSO_TELEMETRY_EVENT.signInFailed,
    properties: { ...flowProperties(flow), reason }
  })
}

/** An SSO session after an attempt this tab continued is that attempt's sign-in. */
export function trackSsoSignInCompleted(): void {
  const flow = ssoFlowStore.finish()
  if (!flow?.continued) return
  signedInFlow = flow
  useTelemetry()?.trackSsoEvent({
    name: SSO_TELEMETRY_EVENT.signInCompleted,
    properties: flowProperties(flow)
  })
}

/** The SSO-required screen closed without the person continuing. */
export function abandonSsoFlow(): void {
  ssoFlowStore.abandon()
}

/** Another sign-in method completed, so no SSO attempt is in flight. */
export function endSsoFlow(): void {
  ssoFlowStore.finish()
}

export function trackSsoWorkspaceLanded(
  landedInDefaultWorkspace: boolean
): void {
  const flow = signedInFlow
  signedInFlow = undefined
  if (!flow) return
  useTelemetry()?.trackSsoEvent({
    name: SSO_TELEMETRY_EVENT.workspaceLanded,
    properties: {
      ...flowProperties(flow),
      landed_in_default_workspace: landedInDefaultWorkspace
    }
  })
}
