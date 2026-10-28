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
const CALLBACK_PATH = '/oauth/local-callback.html'
const CALLBACK_MESSAGE_TYPE = 'comfy-local-web-sign-in'
const POPUP_POLL_MS = 500
const TAB_WORKSPACE_KEY = 'Comfy.LocalWebSignIn.TabWorkspace'
const CALLBACK_PARAMS = [
  'code',
  'state',
  'error',
  'error_description',
  'error_uri',
  'iss'
]

export interface FailedSignIn {
  kind: 'failed'
  reason:
    | 'state-mismatch'
    | 'denied'
    | 'invalid-token'
    | 'storage-unavailable'
    | 'popup-blocked'
    | TokenFailureReason
  error?: string
}

type SignInCallbackOutcome =
  | { kind: 'none' }
  | { kind: 'signed_in' }
  | FailedSignIn

/** The window the authorize page opened in; only its closing is observed. */
export interface LocalWebPopup {
  readonly closed: boolean
}

export interface LocalWebMessage {
  readonly origin: string
  readonly source: unknown
  readonly data: unknown
}

export interface LocalWebAuthEnvironment {
  /** Cloud origin that runs the OAuth server. */
  issuer: string
  /** The page URL, which carries the authorize redirect on return. */
  pageUrl: () => string
  replaceUrl: (url: string) => void
  sessionStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  tokens: LocalWebTokenStore
  /** Runs a refresh while no other tab of this origin is refreshing. */
  withRefreshLock: <T>(task: () => Promise<T>) => Promise<T>
  fetchImpl: typeof fetch
  now: () => number
  /** Opens the authorize page in a popup; null when the browser blocked it. */
  openPopup: (url: string) => LocalWebPopup | null
  /** Subscribes to messages posted to this page. */
  onMessage: (listener: (message: LocalWebMessage) => void) => () => void
  /** Tells the person a popup sign-in did not finish. */
  reportSignInFailure: (failure: FailedSignIn) => void
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

  function pinTab(workspaceId: string): void {
    try {
      env.sessionStorage.setItem(TAB_WORKSPACE_KEY, workspaceId)
    } catch {
      return
    }
  }

  function workspaceOf(tokens: OAuthTokens | undefined): string | undefined {
    return tokens && readAccessTokenIdentity(tokens.accessToken)?.workspaceId
  }

  function activeTokens(): OAuthTokens | undefined {
    const pinned = tabWorkspaceId()
    const tabTokens = pinned ? env.tokens.readWorkspace(pinned) : undefined
    if (tabTokens) return tabTokens
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
    if (!env.tokens.writeWorkspace(workspaceId, tokens)) return false
    pinTab(workspaceId)
    return true
  }

  function adopt(
    tokens: OAuthTokens,
    { forNewTabs }: { forNewTabs: boolean }
  ): 'adopted' | 'invalid-token' | 'storage-unavailable' {
    const identity = readAccessTokenIdentity(tokens.accessToken)
    if (!identity) return 'invalid-token'
    const { workspaceId } = identity
    const writesShared = forNewTabs || isDefaultForNewTabs(workspaceId)
    if (writesShared && !env.tokens.write(tokens)) return 'storage-unavailable'
    const kept = workspaceId ? keepForTab(workspaceId, tokens) : writesShared
    return kept || writesShared ? 'adopted' : 'storage-unavailable'
  }

  function forgetOtherAccount(tokens: OAuthTokens): void {
    const incoming = readAccessTokenIdentity(tokens.accessToken)?.userId
    const kept = activeTokens()
    const previous = kept && readAccessTokenIdentity(kept.accessToken)?.userId
    if (previous && incoming && previous !== incoming) env.tokens.clear()
  }

  function signOutLocally(): DesktopHostAuthState {
    env.tokens.clear()
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

  const callbackUri = new URL(CALLBACK_PATH, env.issuer).href
  const issuerOrigin = new URL(env.issuer).origin

  function readCallbackSearch(data: unknown): string | undefined {
    if (typeof data !== 'object' || data === null) return undefined
    const { type, search } = data as { type?: unknown; search?: unknown }
    return type === CALLBACK_MESSAGE_TYPE && typeof search === 'string'
      ? search
      : undefined
  }

  function callbackFrom(popup: LocalWebPopup): Promise<string | undefined> {
    return new Promise((resolve) => {
      const finish = (search: string | undefined) => {
        stopListening()
        clearInterval(closedPoll)
        resolve(search)
      }
      const stopListening = env.onMessage((message) => {
        if (message.origin !== issuerOrigin || message.source !== popup) return
        const search = readCallbackSearch(message.data)
        if (search !== undefined) finish(search)
      })
      const closedPoll = setInterval(() => {
        if (popup.closed) finish(undefined)
      }, POPUP_POLL_MS)
    })
  }

  async function finishSignIn(
    params: URLSearchParams,
    redirectUri: string
  ): Promise<SignInCallbackOutcome> {
    const pending = takePendingSignIn(env.sessionStorage)
    const response = readAuthorizationResponse(params, pending?.state)
    if (response.kind === 'denied') {
      return { kind: 'failed', reason: 'denied', error: response.error }
    }
    if (response.kind !== 'code' || !pending) {
      return { kind: 'failed', reason: 'state-mismatch' }
    }
    const result = await exchangeAuthorizationCode(
      { code: response.code, verifier: pending.verifier, redirectUri },
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

  async function requestSignIn(): Promise<DesktopHostAuthState> {
    const pkce = await createPkceRequest().catch(() => undefined)
    const pageOrigin = new URL(env.pageUrl()).origin
    const state = pkce && `${pkce.state}~${encodeURIComponent(pageOrigin)}`
    if (
      !pkce ||
      !state ||
      !savePendingSignIn(env.sessionStorage, { verifier: pkce.verifier, state })
    ) {
      return currentState()
    }
    const popup = env.openPopup(
      authorizeUrl({
        issuer: env.issuer,
        clientId: LOCAL_WEB_CLIENT_ID,
        redirectUri: callbackUri,
        challenge: pkce.challenge,
        state
      })
    )
    if (!popup) {
      env.reportSignInFailure({ kind: 'failed', reason: 'popup-blocked' })
      return currentState()
    }
    const search = await callbackFrom(popup)
    if (search === undefined) return currentState()
    const outcome = await finishSignIn(new URLSearchParams(search), callbackUri)
    if (outcome.kind === 'failed' && outcome.reason !== 'denied') {
      env.reportSignInFailure(outcome)
    }
    return currentState()
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

    requestSignIn,

    async switchWorkspace(workspaceId) {
      const current = currentState()
      if (current.status !== 'signed_in') return requestSignIn()
      if (current.workspaceId === workspaceId) return current
      const outcome = await env.withRefreshLock(async () => {
        const kept = await keptWorkspaceTokens(workspaceId, current.userId)
        if (kept.kind !== 'kept') return kept.kind
        return adopt(kept.tokens, { forNewTabs: false }) === 'adopted'
          ? 'switched'
          : 'missing'
      })
      if (outcome === 'unavailable') return currentState()
      if (outcome === 'missing') return requestSignIn()
      emit()
      return currentState()
    },

    signOut: () => env.withRefreshLock(async () => signOutLocally()),

    async completeSignIn() {
      const url = new URL(env.pageUrl())
      const isRedirect =
        url.searchParams.has('code') || url.searchParams.has('error')
      if (!isRedirect) return { kind: 'none' }
      const params = new URLSearchParams(url.searchParams)
      CALLBACK_PARAMS.forEach((param) => url.searchParams.delete(param))
      env.replaceUrl(url.href)
      return finishSignIn(params, localRedirectUri(url.origin))
    }
  }
}
