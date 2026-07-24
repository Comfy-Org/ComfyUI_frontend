import type { Page } from '@playwright/test'

import type { FirebaseAuthUserRecord } from '@e2e/fixtures/helpers/firebaseAuthStorage'
import {
  FIREBASE_APP_NAME,
  FIREBASE_WEB_API_KEY,
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
      'smoke sign-in response carries a non-numeric expiresIn - cannot compute the token expiration'
    )
  const email = stringField(fields, 'email') ?? accountEmail
  const displayName = stringField(fields, 'displayName')
  return {
    uid: localId,
    email,
    ...(displayName === undefined ? {} : { displayName }),
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
    apiKey: FIREBASE_WEB_API_KEY,
    appName: FIREBASE_APP_NAME
  }
}

function identityToolkitErrorCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body))
    return undefined
  const error = (body as { error: unknown }).error
  if (typeof error !== 'object' || error === null || !('message' in error))
    return undefined
  const message = (error as { message: unknown }).message
  return typeof message === 'string' ? message : undefined
}

async function signInSmokeUser(page: Page): Promise<FirebaseAuthUserRecord> {
  const missing = missingSmokeEnvVars(process.env)
  if (missing.length > 0)
    throw new Error(
      `CUSTOM_NODES_ENV=cloud needs ${SMOKE_ENV_VARS.join(', ')} in the ` +
        `environment to sign in the smoke user; missing: ${missing.join(', ')}`
    )
  const email = process.env.SMOKE_ACCOUNT_EMAIL!
  const response = await page.request.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.SMOKE_FIREBASE_API_KEY}`,
    {
      data: {
        email,
        password: process.env.SMOKE_ACCOUNT_PASSWORD,
        returnSecureToken: true
      }
    }
  )
  const body: unknown = await response.json().catch(() => undefined)
  if (!response.ok()) {
    // identitytoolkit error codes (EMAIL_NOT_FOUND, INVALID_PASSWORD, ...)
    // carry no token material and name the exact credential problem.
    const code = identityToolkitErrorCode(body)
    throw new Error(
      `smoke-user sign-in failed (HTTP ${response.status()}${code ? `: ${code}` : ''}) - check the SMOKE_* credentials`
    )
  }
  return smokeAuthUserRecord(body, email, Date.now())
}

// One sign-in per worker process; every test context re-seeds the same
// record (contexts are isolated, the session is not).
let smokeUser: Promise<FirebaseAuthUserRecord> | undefined

export async function seedSmokeAuth(page: Page, appUrl: string): Promise<void> {
  smokeUser ??= signInSmokeUser(page)
  await seedFirebaseAuthUser(page, appUrl, await smokeUser)
}
