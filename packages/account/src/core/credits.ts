/**
 * The credits read client: an authorized balance read bound to the session
 * client, with identity-keyed in-flight dedupe and the one forced re-mint a
 * stale token is allowed. Presentation (unit conversion, chips, focus
 * triggers) stays with the host.
 */
import type { SessionClient } from './session.js'

export type CreditsState =
  | { readonly status: 'unknown' }
  | { readonly status: 'ok'; readonly cents: number }
  | { readonly status: 'error'; readonly unauthorized?: boolean }

export interface BillingClientOptions {
  readonly session: Pick<SessionClient, 'getSnapshot' | 'remint'>
  readonly balanceUrl: string
  readonly fetchImpl?: typeof fetch
  readonly timeoutMs?: number
}

export interface BillingClient {
  getState: () => CreditsState
  subscribe: (listener: (state: CreditsState) => void) => () => void
  refresh: (options?: { readonly force?: boolean }) => Promise<void>
  reset: () => void
}

export function createBillingClient(
  _options: BillingClientOptions
): BillingClient {
  throw new Error('unimplemented')
}
