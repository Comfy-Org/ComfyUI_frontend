import type {
  OAuthTokens,
  TokenFailureReason
} from '@comfyorg/account-core/oauthPkce'
import {
  LOCAL_WEB_CLIENT_ID,
  authorizeUrl,
  createPkceRequest,
  exchangeAuthorizationCode,
  localRedirectUri,
  readAuthorizationResponse,
  refreshAccessToken
} from '@comfyorg/account-core/oauthPkce'

import type {
  DesktopHostAuthBridge,
  DesktopHostAuthState
} from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import { readAccessTokenIdentity } from '@/platform/auth/localWeb/accessTokenIdentity'
import type { LocalWebTokenStore } from '@/platform/auth/localWeb/localWebTokenStore'
import {
  savePendingSignIn,
  takePendingSignIn
} from '@/platform/auth/localWeb/pendingSignIn'

const REFRESH_MARGIN_MS = 60_000
const CALLBACK_PARAMS = [
  'code',
  'state',
  'error',
  'error_description',
  'error_uri',
  'iss'
]

type SignInCallbackOutcome =
  | { kind: 'none' }
  | { kind: 'signed_in' }
  | {
      kind: 'failed'
      reason: 'state-mismatch' | 'denied' | 'invalid-token' | TokenFailureReason
      error?: string
    }

export interface LocalWebAuthEnvironment {
  /** Cloud origin that runs the OAuth server. */
  issuer: string
  /** The page URL, which carries the authorize redirect on return. */
  pageUrl: () => string
  navigate: (url: string) => void
  replaceUrl: (url: string) => void
  sessionStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  tokens: LocalWebTokenStore
  fetchImpl: typeof fetch
  now: () => number
}

export interface LocalWebAuthBridge extends DesktopHostAuthBridge {
  /** Finishes a sign-in the authorize redirect brought back to this page. */
  completeSignIn(): Promise<SignInCallbackOutcome>
}

/**
 * The Desktop auth bridge contract served from the browser itself: the page
 * signs in to Cloud with authorization code + PKCE and hands out the OAuth
 * access token as the workspace credential, exactly as Desktop does.
 */
export function createLocalWebAuthBridge(
  env: LocalWebAuthEnvironment
): LocalWebAuthBridge {
  const listeners = new Set<(state: DesktopHostAuthState) => void>()
  let refreshing: Promise<OAuthTokens | undefined> | undefined

  const tokenOptions = () => ({
    issuer: env.issuer,
    clientId: LOCAL_WEB_CLIENT_ID,
    fetchImpl: env.fetchImpl,
    now: env.now
  })

  function currentState(): DesktopHostAuthState {
    const tokens = env.tokens.read()
    const identity = tokens && readAccessTokenIdentity(tokens.accessToken)
    return identity
      ? { status: 'signed_in', ...identity }
      : { status: 'signed_out' }
  }

  function emit(): void {
    const state = currentState()
    listeners.forEach((listener) => listener(state))
  }

  function adopt(tokens: OAuthTokens): boolean {
    if (!readAccessTokenIdentity(tokens.accessToken)) return false
    env.tokens.write(tokens)
    return true
  }

  function signOutLocally(): DesktopHostAuthState {
    env.tokens.clear()
    emit()
    return currentState()
  }

  async function refresh(stale: OAuthTokens): Promise<OAuthTokens | undefined> {
    const result = await refreshAccessToken(stale.refreshToken, tokenOptions())
    if (env.tokens.read() !== stale) return undefined
    if (result.ok && adopt(result.tokens)) return result.tokens
    if (!result.ok && result.reason === 'unavailable') return undefined
    signOutLocally()
    return undefined
  }

  async function freshTokens(): Promise<OAuthTokens | undefined> {
    const tokens = env.tokens.read()
    if (!tokens) return undefined
    if (tokens.expiresAt - env.now() > REFRESH_MARGIN_MS) return tokens
    refreshing ??= refresh(tokens).finally(() => {
      refreshing = undefined
    })
    return refreshing
  }

  return {
    getState: async () => currentState(),

    onChanged(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },

    async getWorkspaceToken(workspaceId) {
      const tokens = await freshTokens()
      if (!tokens) return null
      const identity = readAccessTokenIdentity(tokens.accessToken)
      return identity?.workspaceId === workspaceId ? tokens.accessToken : null
    },

    async requestSignIn() {
      const pkce = await createPkceRequest().catch(() => undefined)
      if (
        !pkce ||
        !savePendingSignIn(env.sessionStorage, {
          verifier: pkce.verifier,
          state: pkce.state
        })
      ) {
        return currentState()
      }
      env.navigate(
        authorizeUrl({
          issuer: env.issuer,
          clientId: LOCAL_WEB_CLIENT_ID,
          redirectUri: localRedirectUri(new URL(env.pageUrl()).origin),
          challenge: pkce.challenge,
          state: pkce.state
        })
      )
      return new Promise<DesktopHostAuthState>(() => {})
    },

    signOut: async () => signOutLocally(),

    async completeSignIn() {
      const url = new URL(env.pageUrl())
      const pending = takePendingSignIn(env.sessionStorage)
      const response = readAuthorizationResponse(
        url.searchParams,
        pending?.state
      )
      if (response.kind === 'none') return { kind: 'none' }

      CALLBACK_PARAMS.forEach((param) => url.searchParams.delete(param))
      env.replaceUrl(url.href)

      if (response.kind === 'denied') {
        return { kind: 'failed', reason: 'denied', error: response.error }
      }
      if (response.kind === 'state-mismatch' || !pending) {
        return { kind: 'failed', reason: 'state-mismatch' }
      }
      const result = await exchangeAuthorizationCode(
        {
          code: response.code,
          verifier: pending.verifier,
          redirectUri: localRedirectUri(url.origin)
        },
        tokenOptions()
      )
      if (!result.ok) {
        return { kind: 'failed', reason: result.reason, error: result.error }
      }
      if (!adopt(result.tokens)) {
        return { kind: 'failed', reason: 'invalid-token' }
      }
      emit()
      return { kind: 'signed_in' }
    }
  }
}
