import type { SsoDiscovery } from '@comfyorg/account-core/sso'

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
  | { readonly type: 'discovered'; readonly discovery: SsoDiscovery }
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
      return event.discovery.kind === 'sso'
        ? { phase: 'redirecting' }
        : { phase: event.discovery.kind }
    case 'restored':
      return { phase: 'idle' }
  }
}
