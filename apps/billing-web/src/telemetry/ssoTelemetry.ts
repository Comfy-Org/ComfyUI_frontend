import type { SsoFlow } from '@comfyorg/account-core/telemetry'
import {
  SSO_TELEMETRY_EVENT,
  ssoFlowStore
} from '@comfyorg/account-core/telemetry'

import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'

const flowProperties = ({ flowId, surface }: SsoFlow) => ({
  surface,
  flow_id: flowId
})

/** Billing web's only SSO refusal is the session's `SSO_REQUIRED`. */
export function reportSsoRequiredShown(): void {
  billingWebTelemetry.trackSsoEvent({
    name: SSO_TELEMETRY_EVENT.requiredShown,
    properties: {
      ...flowProperties(ssoFlowStore.start('billing_web')),
      trigger: 'session_refused'
    }
  })
}

export function reportSsoContinueClicked(): void {
  billingWebTelemetry.trackSsoEvent({
    name: SSO_TELEMETRY_EVENT.continueClicked,
    properties: flowProperties(
      ssoFlowStore.current() ?? ssoFlowStore.start('billing_web')
    )
  })
}
