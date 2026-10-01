import type { SessionErrorCode } from '../../sessionContracts.js'

export type WebSessionMode = 'session-client' | 'web-session'

export type WebSessionBillingEvent = {
  operation: 'web_session'
  outcome: 'pending'
} & (
  | {
      stage: 'signin_required'
      reason: 'no_session' | 'refused'
    }
  | {
      stage: 'established'
      /** `interactive` once the customer signed in on billing web itself; `restored` when a session was already there. */
      origin: 'restored' | 'interactive'
      mode: WebSessionMode
    }
  | { stage: 'failed'; code: SessionErrorCode }
)
