import type { SsoDiscovery, SsoSignInVia } from '@comfyorg/account-core/sso'
import { sendsToSso } from '@comfyorg/account-core/sso'

export type SsoSignInState = {
  readonly phase:
    | 'idle'
    | 'checking'
    | 'redirecting'
    | 'not-sso'
    | 'invalid-email'
    | 'unavailable'
}

export type SsoSignInEvent =
  | { readonly type: 'submitted' }
  | {
      readonly type: 'discovered'
      readonly discovery: SsoDiscovery
      readonly via: SsoSignInVia
    }
  | { readonly type: 'restored' }

export const isSsoBusy = (state: SsoSignInState): boolean =>
  state.phase === 'checking' || state.phase === 'redirecting'

export function reduceSsoSignIn(
  state: SsoSignInState,
  event: SsoSignInEvent
): SsoSignInState {
  switch (event.type) {
    case 'submitted':
      return isSsoBusy(state) ? state : { phase: 'checking' }
    case 'discovered':
      if (state.phase !== 'checking') return state
      if (sendsToSso(event.discovery, event.via))
        return { phase: 'redirecting' }
      return event.discovery.kind === 'sso'
        ? { phase: 'idle' }
        : { phase: event.discovery.kind }
    case 'restored':
      return { phase: 'idle' }
  }
}
