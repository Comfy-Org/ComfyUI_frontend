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
const TAB_WORKSPACE_KEY = 'Comfy.LocalWebSignIn.TabWorkspace'
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
      reason:
        | 'state-mismatch'
        | 'denied'
        | 'invalid-token'
        | 'storage-unavailable'
        | TokenFailureReason
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
  /** Runs a refresh while no other tab of this origin is refreshing. */
  withRefreshLock: <T>(task: () => Promise<T>) => Promise<T>
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

  function tabWorkspaceId(): string | undefined {
    try {
      return env.sessionStorage.getItem(TAB_WORKSPACE_KEY) ?? undefined
    } catch {
      return undefined
    }
  }

  function pinTab(workspaceId: string | undefined): boolean {
    try {
      if (workspaceId)
        env.sessionStorage.setItem(TAB_WORKSPACE_KEY, workspaceId)
      else env.sessionStorage.removeItem(TAB_WORKSPACE_KEY)
      return true
    } catch {
      return false
    }
  }

  function workspaceOf(tokens: OAuthTokens | undefined): string | undefined {
    return tokens && readAccessTokenIdentity(tokens.accessToken)?.workspaceId
  }

  function activeTokens(): OAuthTokens | undefined {
    const pinned = tabWorkspaceId()
    if (pinned) return env.tokens.readWorkspace(pinned)
    const shared = env.tokens.read()
    const sharedWorkspace = workspaceOf(shared)
    if (shared && sharedWorkspace) {
      if (!env.tokens.readWorkspace(sharedWorkspace)) {
        env.tokens.writeWorkspace(sharedWorkspace, shared)
      }
      pinTab(sharedWorkspace)
    }
    return shared
  }

  function currentState(): DesktopHostAuthState {
    const tokens = activeTokens()
    const identity = tokens && readAccessTokenIdentity(tokens.accessToken)
    return identity
      ? { status: 'signed_in', ...identity }
      : { status: 'signed_out' }
  }

  function emit(): void {
    const state = currentState()
    listeners.forEach((listener) => listener(state))
  }

  function isDefaultForNewTabs(workspaceId: string | undefined): boolean {
    const sharedWorkspace = workspaceOf(env.tokens.read())
    return !sharedWorkspace || sharedWorkspace === workspaceId
  }

  function keepForTab(workspaceId: string, tokens: OAuthTokens): boolean {
    return env.tokens.writeWorkspace(workspaceId, tokens) && pinTab(workspaceId)
  }

  function adopt(
    tokens: OAuthTokens,
    { forNewTabs }: { forNewTabs: boolean }
  ): 'adopted' | 'invalid-token' | 'storage-unavailable' {
    const identity = readAccessTokenIdentity(tokens.accessToken)
    if (!identity) return 'invalid-token'
    const { workspaceId } = identity
    const writesShared = forNewTabs || isDefaultForNewTabs(workspaceId)
    if (!workspaceId && !writesShared) return 'storage-unavailable'
    const previousPin = tabWorkspaceId()
    if (workspaceId && !keepForTab(workspaceId, tokens))
      return 'storage-unavailable'
    if (writesShared && !env.tokens.write(tokens)) {
      pinTab(previousPin)
      return 'storage-unavailable'
    }
    return 'adopted'
  }

  function forgetOtherAccount(tokens: OAuthTokens): void {
    const incoming = readAccessTokenIdentity(tokens.accessToken)?.userId
    const kept = activeTokens() ?? env.tokens.read()
    const previous = kept && readAccessTokenIdentity(kept.accessToken)?.userId
    if (previous && incoming && previous !== incoming) env.tokens.clear()
  }

  function signOutLocally(): DesktopHostAuthState {
    env.tokens.clear()
    pinTab(undefined)
    emit()
    return currentState()
  }

  function isFresh(tokens: OAuthTokens): boolean {
    return tokens.expiresAt - env.now() > REFRESH_MARGIN_MS
  }

  async function refreshStoredTokens(): Promise<OAuthTokens | undefined> {
    const stale = activeTokens()
    if (!stale) return undefined
    if (isFresh(stale)) return stale
    const result = await refreshAccessToken(stale.refreshToken, tokenOptions())
    if (activeTokens()?.refreshToken !== stale.refreshToken) return undefined
    if (result.ok && adopt(result.tokens, { forNewTabs: false }) === 'adopted')
      return result.tokens
    if (!result.ok && result.reason === 'unavailable') return undefined
    signOutLocally()
    return undefined
  }

  async function keptWorkspaceTokens(
    workspaceId: string,
    userId: string
  ): Promise<
    | { kind: 'kept'; tokens: OAuthTokens }
    | { kind: 'missing' }
    | { kind: 'unavailable' }
  > {
    const kept = env.tokens.readWorkspace(workspaceId)
    if (!kept || readAccessTokenIdentity(kept.accessToken)?.userId !== userId)
      return { kind: 'missing' }
    if (isFresh(kept)) return { kind: 'kept', tokens: kept }
    const result = await refreshAccessToken(kept.refreshToken, tokenOptions())
    if (result.ok) return { kind: 'kept', tokens: result.tokens }
    return result.reason === 'unavailable'
      ? { kind: 'unavailable' }
      : { kind: 'missing' }
  }

  async function freshTokens(): Promise<OAuthTokens | undefined> {
    const tokens = activeTokens()
    if (!tokens) return undefined
    if (isFresh(tokens)) return tokens
    refreshing ??= env.withRefreshLock(refreshStoredTokens).finally(() => {
      refreshing = undefined
    })
    return refreshing
  }

  env.tokens.subscribe(emit)

  function isSignedInAs(userId: string): boolean {
    const state = currentState()
    return state.status === 'signed_in' && state.userId === userId
  }

  async function requestSignIn(
    stillWanted: () => boolean = () => true
  ): Promise<DesktopHostAuthState> {
    if (!stillWanted()) return currentState()
    const pkce = await createPkceRequest().catch(() => undefined)
    if (
      !stillWanted() ||
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

    requestSignIn: () => requestSignIn(),

    async switchWorkspace(workspaceId) {
      const current = currentState()
      if (current.status !== 'signed_in') return requestSignIn()
      if (current.workspaceId === workspaceId) return current
      const outcome = await env.withRefreshLock(async () => {
        const kept = await keptWorkspaceTokens(workspaceId, current.userId)
        if (kept.kind !== 'kept') return kept.kind
        const adopted = adopt(kept.tokens, { forNewTabs: false })
        if (adopted === 'adopted') return 'switched'
        return adopted === 'storage-unavailable' ? 'unavailable' : 'missing'
      })
      if (outcome === 'unavailable') return currentState()
      if (outcome === 'missing')
        return requestSignIn(() => isSignedInAs(current.userId))
      emit()
      return currentState()
    },

    signOut: () => env.withRefreshLock(async () => signOutLocally()),

    async completeSignIn() {
      const url = new URL(env.pageUrl())
      const isRedirect =
        url.searchParams.has('code') || url.searchParams.has('error')
      if (!isRedirect) return { kind: 'none' }

      const pending = takePendingSignIn(env.sessionStorage)
      const response = readAuthorizationResponse(
        url.searchParams,
        pending?.state
      )

      CALLBACK_PARAMS.forEach((param) => url.searchParams.delete(param))
      env.replaceUrl(url.href)

      if (response.kind === 'denied') {
        return { kind: 'failed', reason: 'denied', error: response.error }
      }
      if (response.kind !== 'code' || !pending) {
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
      forgetOtherAccount(result.tokens)
      const adopted = adopt(result.tokens, { forNewTabs: true })
      if (adopted !== 'adopted') return { kind: 'failed', reason: adopted }
      emit()
      return { kind: 'signed_in' }
    }
  }
}
