import type { WebSessionMode } from '@comfyorg/account-core/billing'
import type { SessionErrorCode } from '@comfyorg/account-core/session'

import type { BillingWebSessionPhase } from '@/router'
import { trackOncePerTab } from '@/telemetry/trackOncePerTab'

function signinReason(phase: BillingWebSessionPhase | undefined) {
  if (phase === 'signed-out') return 'no_session'
  if (phase === 'error') return 'refused'
  return undefined
}

/** Reports the sign-in screen once the session is known to need it; a phase still resolving says nothing. */
export function reportSigninRequired(
  phase: BillingWebSessionPhase | undefined
): void {
  const reason = signinReason(phase)
  if (reason === undefined) return
  trackOncePerTab({
    operation: 'web_session',
    stage: 'signin_required',
    outcome: 'pending',
    reason
  })
}

export function reportSessionEstablished(
  origin: 'restored' | 'interactive',
  mode: WebSessionMode
): void {
  trackOncePerTab({
    operation: 'web_session',
    stage: 'established',
    outcome: 'pending',
    origin,
    mode
  })
}

/** Once per code, so a reload or a retry that fails the same way adds nothing. */
export function reportSessionFailed(code: SessionErrorCode): void {
  trackOncePerTab(
    {
      operation: 'web_session',
      stage: 'failed',
      outcome: 'pending',
      error_code: code
    },
    code
  )
}
