import {
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
  signOut
} from 'firebase/auth'

import { createTimeoutSignal } from '@comfyorg/api-client/abortSignal'

import { safeSessionStorage } from '@/base/storage/safeStorage'
import { getFirebaseConfig } from '@/config/firebase'

export const topLevelProviders =
  import.meta.env.VITE_WORKSPACE_PROVIDER_NAVIGATION === 'top-level'
export type EditorProvider = 'google' | 'github'
const key = 'Comfy.EditorProvider'
const resultKey = key + '.callback'
const lifetime = 10 * 60_000
const callbackPath = '/oauth/editor-callback.html'
const origins = {
  google: 'https://accounts.google.com',
  github: 'https://github.com'
}
const providers = { google: 'google.com', github: 'github.com' }

interface Attempt {
  provider: EditorProvider
  state: string
  sessionId: string
  destination: string
  at: number
}

export interface ProviderReturn {
  attempt: Attempt
  requestUri: string
}

async function identityCall(method: string, body: Record<string, unknown>) {
  const url = new URL(
    'https://identitytoolkit.googleapis.com/v1/accounts:' + method
  )
  url.searchParams.set('key', getFirebaseConfig().apiKey ?? '')
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: createTimeoutSignal(15000)
  })
  if (!response.ok) return
  return (await response.json()) as Record<string, unknown>
}

function fresh(attempt: Attempt) {
  return (
    Number.isFinite(attempt.at) &&
    attempt.at <= Date.now() &&
    Date.now() - attempt.at < lifetime
  )
}

function destinationPath(value: string): string | undefined {
  const url = new URL(value, location.origin)
  if (
    url.origin !== location.origin ||
    !['/cloud/login', '/cloud/signup'].includes(url.pathname)
  )
    return
  return url.pathname + url.search
}

export async function beginProviderNavigation(
  provider: EditorProvider,
  isCurrent: () => boolean
) {
  const continueUri = location.origin + callbackPath
  const current = new URL(location.href)
  const login = new URL('/cloud/login', current.origin)
  login.searchParams.set(
    'previousFullPath',
    current.pathname + current.search + current.hash
  )
  const destination = destinationPath(
    ['/cloud/login', '/cloud/signup'].includes(current.pathname)
      ? current.href
      : login.href
  )
  if (!destination) return new Error('Invalid sign-in return path.')
  if (!safeSessionStorage.isPersistent)
    return new Error('Browser session storage is unavailable.')
  const result = await identityCall('createAuthUri', {
    providerId: providers[provider],
    continueUri,
    oauthScope: provider === 'google' ? 'openid email profile' : 'user:email',
    ...(provider === 'google'
      ? { customParameter: { prompt: 'select_account' } }
      : {})
  })
  if (!result)
    return new Error('The identity provider could not complete sign-in.')
  if (
    typeof result.authUri !== 'string' ||
    typeof result.sessionId !== 'string' ||
    !result.sessionId
  )
    return new Error(
      'The identity provider returned an invalid sign-in request.'
    )
  const url = new URL(result.authUri)
  const state = url.searchParams.get('state')
  if (
    !state ||
    url.origin !== origins[provider] ||
    url.username ||
    url.password ||
    url.searchParams.get('redirect_uri') !== continueUri
  )
    return new Error(
      'The identity provider returned an unexpected destination.'
    )
  if (!isCurrent()) return
  const cleared = safeSessionStorage.remove(resultKey)
  if (!cleared.ok) return new Error('Browser session storage is unavailable.')
  const saved = safeSessionStorage.setItem(
    key,
    JSON.stringify({
      provider,
      state,
      sessionId: result.sessionId,
      destination,
      at: Date.now()
    } satisfies Attempt)
  )
  if (saved !== 'ok' || safeSessionStorage.backend !== 'sessionStorage')
    return new Error('Browser session storage is unavailable.')
  location.assign(url.href)
}

/** The callback clears the URL before restoring the original editor login route. */
export function takeProviderReturn(): ProviderReturn | Error | undefined {
  const requestUri = safeSessionStorage.getItem(resultKey)
  if (!requestUri) return
  if (!safeSessionStorage.remove(resultKey).ok)
    return new Error('Sign-in has expired.')
  const stored = safeSessionStorage.getItem(key)
  if (!safeSessionStorage.remove(key).ok || !stored)
    return new Error('Sign-in has expired.')
  const attempt: Attempt = JSON.parse(stored)
  if (
    !Object.hasOwn(providers, attempt.provider) ||
    !attempt.state ||
    !attempt.sessionId ||
    !fresh(attempt) ||
    destinationPath(location.href) !== attempt.destination
  )
    return new Error('Sign-in has expired.')
  return { attempt, requestUri }
}

function validProviderReturn({ attempt, requestUri }: ProviderReturn): boolean {
  const url = new URL(requestUri)
  return (
    url.origin === location.origin &&
    url.pathname === callbackPath &&
    fresh(attempt) &&
    url.searchParams.getAll('state').length === 1 &&
    url.searchParams.get('state') === attempt.state &&
    !url.searchParams.has('error') &&
    url.searchParams.getAll('code').length === 1 &&
    Boolean(url.searchParams.get('code'))
  )
}

function providerCredentialFor(
  provider: EditorProvider,
  result: Record<string, unknown>
) {
  const accessToken =
    typeof result.oauthAccessToken === 'string'
      ? result.oauthAccessToken
      : undefined
  if (provider === 'github')
    return accessToken ? GithubAuthProvider.credential(accessToken) : undefined
  const idToken =
    typeof result.oauthIdToken === 'string' ? result.oauthIdToken : undefined
  return idToken || accessToken
    ? GoogleAuthProvider.credential(idToken, accessToken)
    : undefined
}

export async function exchangeProviderReturn(
  value: ProviderReturn,
  isCurrent: () => boolean
) {
  const { attempt, requestUri } = value
  if (!validProviderReturn(value))
    return new Error('Sign-in was cancelled or expired.')
  const result = await identityCall('signInWithIdp', {
    requestUri,
    sessionId: attempt.sessionId,
    returnSecureToken: true,
    returnIdpCredential: true
  })
  if (!result)
    return new Error('The identity provider could not complete sign-in.')
  if (
    !isCurrent() ||
    result.providerId !== providers[attempt.provider] ||
    result.needConfirmation ||
    result.mfaPendingCredential ||
    typeof result.localId !== 'string' ||
    !result.localId
  )
    return new Error('The identity provider requires another sign-in step.')
  const providerCredential = providerCredentialFor(attempt.provider, result)
  if (!providerCredential) return new Error('Missing provider credential.')
  const auth = getAuth()
  const credential = await signInWithCredential(auth, providerCredential)
  if (credential.user.uid !== result.localId) {
    await signOut(auth)
    return new Error('The sign-in response did not match the selected account.')
  }
  return credential
}
