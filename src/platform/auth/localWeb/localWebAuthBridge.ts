import { z } from 'zod'

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
const UNREACHABLE_TOKEN_RETRY_DELAYS_MS = [
  5_000, 10_000, 20_000, 40_000, 60_000, 60_000, 60_000, 60_000
]
const TAB_WORKSPACE_KEY = 'Comfy.LocalWebSignIn.TabWorkspace'
const CALLBACK_PARAMS = [
  'code',
  'state',
  'error',
  'error_description',
  'error_uri',
  'iss'
]

const zCallbackMessage = z.object({
  type: z.literal(CALLBACK_MESSAGE_TYPE),
  search: z.string()
})

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

/** The sign-in window: opened blank on the click, then sent to authorize. */
export interface LocalWebPopup {
  readonly closed: boolean
  close(): void
  location: { href: string }
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
  openPopup: () => LocalWebPopup | null
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
  let tokenUnreachable = false
  let unreachableTokenRetry:
    | { round: number; timer: ReturnType<typeof setTimeout> | undefined }
    | undefined
  let unreachableTokenRetryRound = 0
  let signingIn:
    | {
        popup: LocalWebPopup
        cancel: () => void
        done: Promise<DesktopHostAuthState>
      }
    | undefined

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

  function abandonSignIn(): void {
    signingIn?.cancel()
    signingIn?.popup.close()
    signingIn = undefined
  }

  function signOutLocally(): DesktopHostAuthState {
    abandonSignIn()
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

  function keptFor(
    workspaceId: string,
    userId: string
  ): OAuthTokens | undefined {
    const kept = env.tokens.readWorkspace(workspaceId)
    return kept && readAccessTokenIdentity(kept.accessToken)?.userId === userId
      ? kept
      : undefined
  }

  async function keptWorkspaceTokens(
    workspaceId: string,
    userId: string
  ): Promise<
    | { kind: 'kept'; tokens: OAuthTokens }
    | { kind: 'missing' }
    | { kind: 'unavailable' }
  > {
    const kept = keptFor(workspaceId, userId)
    if (!kept) return { kind: 'missing' }
    if (isFresh(kept)) return { kind: 'kept', tokens: kept }
    const result = await refreshAccessToken(kept.refreshToken, tokenOptions())
    if (result.ok) return { kind: 'kept', tokens: result.tokens }
    if (result.reason === 'unavailable') return { kind: 'unavailable' }
    env.tokens.forgetWorkspace(workspaceId, kept)
    return { kind: 'missing' }
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

  function stopUnreachableTokenRetry(): void {
    clearTimeout(unreachableTokenRetry?.timer)
    unreachableTokenRetry = undefined
  }

  function markTokenReachable(): void {
    stopUnreachableTokenRetry()
    if (!tokenUnreachable) return
    tokenUnreachable = false
    emit()
  }

  function markTokenUnreachable(): void {
    tokenUnreachable = true
    if (unreachableTokenRetry) return
    unreachableTokenRetry = {
      round: ++unreachableTokenRetryRound,
      timer: undefined
    }
    retryUnreachableToken(unreachableTokenRetry.round, 0)
  }

  function retryUnreachableToken(round: number, attempt: number): void {
    if (unreachableTokenRetry?.round !== round) return
    if (attempt >= UNREACHABLE_TOKEN_RETRY_DELAYS_MS.length) {
      stopUnreachableTokenRetry()
      return
    }
    unreachableTokenRetry.timer = setTimeout(() => {
      void freshTokens()
        .catch(() => undefined)
        .then((tokens) => {
          if (unreachableTokenRetry?.round !== round) return
          if (tokens) {
            markTokenReachable()
            return
          }
          if (!activeTokens()) {
            tokenUnreachable = false
            stopUnreachableTokenRetry()
            return
          }
          retryUnreachableToken(round, attempt + 1)
        })
    }, UNREACHABLE_TOKEN_RETRY_DELAYS_MS[attempt])
  }

  env.tokens.subscribe(emit)

  const callbackUri = new URL(CALLBACK_PATH, env.issuer).href
  const issuerOrigin = new URL(env.issuer).origin

  function readCallbackSearch(data: unknown): string | undefined {
    const message = zCallbackMessage.safeParse(data)
    return message.success ? message.data.search : undefined
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
    redirectUri: string,
    stillWanted: () => boolean = () => true
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
    if (!stillWanted()) return { kind: 'none' }
    forgetOtherAccount(result.tokens)
    const adopted = adopt(result.tokens, { forNewTabs: true })
    if (adopted !== 'adopted') return { kind: 'failed', reason: adopted }
    emit()
    return { kind: 'signed_in' }
  }

  function isSignedInAs(userId: string): boolean {
    const state = currentState()
    return state.status === 'signed_in' && state.userId === userId
  }

  async function preparedAuthorizeUrl(
    stillWanted: () => boolean
  ): Promise<string | undefined> {
    if (!stillWanted()) return undefined
    const pkce = await createPkceRequest().catch(() => undefined)
    if (!pkce || !stillWanted()) return undefined
    const pageOrigin = new URL(env.pageUrl()).origin
    const state = `${pkce.state}~${encodeURIComponent(pageOrigin)}`
    if (
      !savePendingSignIn(env.sessionStorage, { verifier: pkce.verifier, state })
    ) {
      env.reportSignInFailure({ kind: 'failed', reason: 'storage-unavailable' })
      return undefined
    }
    return authorizeUrl({
      issuer: env.issuer,
      clientId: LOCAL_WEB_CLIENT_ID,
      redirectUri: callbackUri,
      challenge: pkce.challenge,
      state
    })
  }

  async function finishPopupSignIn(
    search: string,
    stillWanted: () => boolean
  ): Promise<void> {
    const outcome = await finishSignIn(
      new URLSearchParams(search),
      callbackUri,
      stillWanted
    )
    if (outcome.kind === 'failed' && outcome.reason !== 'denied') {
      env.reportSignInFailure(outcome)
    }
  }

  async function signInThroughPopup(
    popup: LocalWebPopup,
    stillWanted: () => boolean
  ): Promise<DesktopHostAuthState> {
    const url = await preparedAuthorizeUrl(stillWanted)
    if (!url) {
      popup.close()
      return currentState()
    }
    popup.location.href = url
    const search = await callbackFrom(popup)
    if (search !== undefined && stillWanted())
      await finishPopupSignIn(search, stillWanted)
    return currentState()
  }

  function requestSignIn(
    stillWanted: () => boolean = () => true
  ): Promise<DesktopHostAuthState> {
    if (signingIn) return signingIn.done
    const popup = env.openPopup()
    if (!popup) {
      env.reportSignInFailure({ kind: 'failed', reason: 'popup-blocked' })
      return Promise.resolve(currentState())
    }
    let canceled = false
    const done = signInThroughPopup(
      popup,
      () => !canceled && stillWanted()
    ).finally(() => {
      if (signingIn?.done === done) signingIn = undefined
    })
    signingIn = { popup, cancel: () => (canceled = true), done }
    return done
  }

  return {
    getState: async () => currentState(),

    onChanged(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },

    async getWorkspaceToken(workspaceId) {
      const tokens = await freshTokens()
      if (!tokens) {
        if (activeTokens()) {
          markTokenUnreachable()
        } else {
          tokenUnreachable = false
          stopUnreachableTokenRetry()
        }
        return null
      }
      markTokenReachable()
      const identity = readAccessTokenIdentity(tokens.accessToken)
      return identity?.workspaceId === workspaceId ? tokens.accessToken : null
    },

    requestSignIn: () => requestSignIn(),

    async switchWorkspace(workspaceId) {
      const current = currentState()
      if (current.status !== 'signed_in') return requestSignIn()
      if (current.workspaceId === workspaceId) return current
      const stillSignedIn = () => isSignedInAs(current.userId)
      if (!keptFor(workspaceId, current.userId))
        return requestSignIn(stillSignedIn)
      const switched = await env.withRefreshLock(async () => {
        const kept = await keptWorkspaceTokens(workspaceId, current.userId)
        return (
          kept.kind === 'kept' &&
          adopt(kept.tokens, { forNewTabs: false }) === 'adopted'
        )
      })
      if (switched) emit()
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
