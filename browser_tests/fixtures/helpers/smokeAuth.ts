import type { Page } from '@playwright/test'

import type { FirebaseAuthUserRecord } from '@e2e/fixtures/helpers/firebaseAuthStorage'
import {
  FIREBASE_APP_NAME,
  seedFirebaseAuthUser
} from '@e2e/fixtures/helpers/firebaseAuthStorage'

/**
 * Real Cloud authentication for CUSTOM_NODES_ENV=cloud runs: signs in the
 * shared smoke user against Firebase's identitytoolkit REST API (the exact
 * call Cloud's own smoke tooling makes) once per worker, and seeds the REAL
 * session through the same IndexedDB path CloudAuthHelper mocks - with none
 * of that helper's route interceptions, so the frontend's SDK restores a
 * live session and every backend call carries a real bearer token.
 */
export const SMOKE_ENV_VARS = [
  'SMOKE_FIREBASE_API_KEY',
  'SMOKE_ACCOUNT_EMAIL',
  'SMOKE_ACCOUNT_PASSWORD'
] as const

export function missingSmokeEnvVars(
  env: Record<string, string | undefined>
): string[] {
  return SMOKE_ENV_VARS.filter((name) => !env[name])
}

function stringField(
  fields: Record<string, unknown>,
  name: string
): string | undefined {
  const value = fields[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Shape a signInWithPassword response into the exact IndexedDB record the
 * frontend's Firebase SDK restores (see firebaseAuthStorage.ts). Malformed
 * responses fail naming the FIELD - token values are never echoed or logged.
 */
export function smokeAuthUserRecord(
  signInResponse: unknown,
  accountEmail: string,
  apiKey: string,
  nowMs: number
): FirebaseAuthUserRecord {
  const fields =
    typeof signInResponse === 'object' && signInResponse !== null
      ? (signInResponse as Record<string, unknown>)
      : {}
  const idToken = stringField(fields, 'idToken')
  const refreshToken = stringField(fields, 'refreshToken')
  const localId = stringField(fields, 'localId')
  const expiresIn = stringField(fields, 'expiresIn')
  if (
    idToken === undefined ||
    refreshToken === undefined ||
    localId === undefined ||
    expiresIn === undefined
  ) {
    const missing = Object.entries({
      idToken,
      refreshToken,
      localId,
      expiresIn
    })
      .filter(([, value]) => value === undefined)
      .map(([name]) => name)
    throw new Error(
      `smoke sign-in response is missing ${missing.join(', ')} - cannot seed a real cloud session`
    )
  }
  const lifetimeMs = Number(expiresIn) * 1000
  if (!Number.isFinite(lifetimeMs) || lifetimeMs <= 0)
    throw new Error(
      'smoke sign-in response carries a non-numeric or non-positive expiresIn - cannot compute the token expiration'
    )
  const email = stringField(fields, 'email') ?? accountEmail
  const displayName = stringField(fields, 'displayName')
  return {
    uid: localId,
    email,
    // The SDK persists displayName as null when absent, never omits it.
    displayName: displayName ?? null,
    emailVerified: true,
    isAnonymous: false,
    providerData: [
      {
        providerId: 'password',
        uid: email,
        displayName: displayName ?? null,
        email,
        phoneNumber: null,
        photoURL: null
      }
    ],
    stsTokenManager: {
      refreshToken,
      accessToken: idToken,
      expirationTime: nowMs + lifetimeMs
    },
    // The IndexedDB persistence key embeds this apiKey: it must be the
    // project that minted the tokens (the smoke key), or the SDK never
    // finds the record and the app boots signed out.
    apiKey,
    appName: FIREBASE_APP_NAME
  }
}

export function identityToolkitErrorCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body))
    return undefined
  const error = (body as { error: unknown }).error
  if (typeof error !== 'object' || error === null || !('message' in error))
    return undefined
  const message = (error as { message: unknown }).message
  return typeof message === 'string' ? message : undefined
}

async function signInSmokeUser(): Promise<FirebaseAuthUserRecord> {
  const missing = missingSmokeEnvVars(process.env)
  if (missing.length > 0)
    throw new Error(
      `CUSTOM_NODES_ENV=cloud needs ${SMOKE_ENV_VARS.join(', ')} in the ` +
        `environment to sign in the smoke user; missing: ${missing.join(', ')}`
    )
  const email = process.env.SMOKE_ACCOUNT_EMAIL!
  const apiKey = process.env.SMOKE_FIREBASE_API_KEY!
  // Node's own fetch, NOT page.request: the traced transport would retain
  // the credential inside failure trace artifacts.
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: process.env.SMOKE_ACCOUNT_PASSWORD,
        returnSecureToken: true
      })
    }
  )
  const body: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    // identitytoolkit error codes (EMAIL_NOT_FOUND, INVALID_PASSWORD, ...)
    // carry no token material and name the exact credential problem.
    const code = identityToolkitErrorCode(body)
    throw new Error(
      `smoke-user sign-in failed (HTTP ${response.status}${code ? `: ${code}` : ''}) - check the SMOKE_* credentials`
    )
  }
  return smokeAuthUserRecord(body, email, apiKey, Date.now())
}

// One sign-in per worker process; every test context re-seeds the same
// record (contexts are isolated, the session is not).
let smokeUser: Promise<FirebaseAuthUserRecord> | undefined

export async function seedSmokeAuth(page: Page, appUrl: string): Promise<void> {
  // Cache only success: a transient sign-in failure must not poison every
  // remaining test in the worker with the same cached rejection.
  smokeUser ??= signInSmokeUser().catch((error: unknown) => {
    smokeUser = undefined
    throw error
  })
  await seedFirebaseAuthUser(page, appUrl, await smokeUser)
}
