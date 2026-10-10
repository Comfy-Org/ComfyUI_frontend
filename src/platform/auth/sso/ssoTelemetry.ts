import type {
  SsoFlow,
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

/** Starts a new attempt each time the SSO-required screen appears. */
export function trackSsoRequiredShown(
  surface: SsoSurface,
  trigger: SsoRequiredTrigger
): void {
  const telemetry = useTelemetry()
  if (!telemetry) return
  const flow = ssoFlowStore.start(
    trigger === 'customer_create' ? 'cloud_customer_create' : surface
  )
  telemetry.trackSsoEvent({
    name: SSO_TELEMETRY_EVENT.requiredShown,
    properties: { ...flowProperties(flow), trigger }
  })
}

export function trackSsoContinueClicked(surface: SsoSurface): void {
  const telemetry = useTelemetry()
  if (!telemetry) return
  const flow = ssoFlowStore.current() ?? ssoFlowStore.start(surface)
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

/** An SSO session after an attempt this tab started is that attempt's sign-in. */
export function trackSsoSignInCompleted(userId: string): void {
  const telemetry = useTelemetry()
  if (!telemetry) return
  const flow = ssoFlowStore.finish()
  if (!flow) return
  signedInFlow = flow
  telemetry.trackAuth({
    method: 'sso',
    user_id: userId,
    flow_id: flow.flowId
  })
}

export function trackSsoWorkspaceLanded(landedInOrgWorkspace: boolean): void {
  const flow = signedInFlow
  signedInFlow = undefined
  if (!flow) return
  useTelemetry()?.trackSsoEvent({
    name: SSO_TELEMETRY_EVENT.workspaceLanded,
    properties: {
      ...flowProperties(flow),
      landed_in_org_workspace: landedInOrgWorkspace
    }
  })
}
