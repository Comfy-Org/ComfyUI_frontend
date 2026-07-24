import type { Page } from '@playwright/test'

import type { FirebaseAuthUserRecord } from '@e2e/fixtures/helpers/firebaseAuthStorage'
import {
  FIREBASE_APP_NAME,
  FIREBASE_WEB_API_KEY,
  seedFirebaseAuthUser
} from '@e2e/fixtures/helpers/firebaseAuthStorage'

export const CLOUD_AUTH_ENV_VARS = [
  'CLOUD_TEST_EMAIL',
  'CLOUD_TEST_PASSWORD'
] as const

export function missingCloudAuthEnvVars(
  env: Record<string, string | undefined>
): string[] {
  return CLOUD_AUTH_ENV_VARS.filter((name) => !env[name])
}

function stringField(
  fields: Record<string, unknown>,
  name: string
): string | undefined {
  const value = fields[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

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
    // Must be the token-minting project's key: the SDK's IndexedDB lookup key embeds it.
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
  const missing = missingCloudAuthEnvVars(process.env)
  if (missing.length > 0)
    throw new Error(
      `CUSTOM_NODES_ENV=cloud needs ${CLOUD_AUTH_ENV_VARS.join(', ')} in the ` +
        `environment to sign in the cloud test user; missing: ${missing.join(', ')}`
    )
  const email = process.env.CLOUD_TEST_EMAIL!
  const apiKey = FIREBASE_WEB_API_KEY
  // Node fetch, not page.request: traced transports retain the credential in failure artifacts.
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: process.env.CLOUD_TEST_PASSWORD,
        returnSecureToken: true,
        clientType: 'CLIENT_TYPE_WEB'
      }),
      signal: AbortSignal.timeout(30_000)
    }
  )
  const body: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const code = identityToolkitErrorCode(body)
    throw new Error(
      `cloud test-user sign-in failed (HTTP ${response.status}${code ? `: ${code}` : ''}) - check the CLOUD_TEST_EMAIL / CLOUD_TEST_PASSWORD credentials`
    )
  }
  return smokeAuthUserRecord(body, email, apiKey, Date.now())
}

let smokeUser: Promise<FirebaseAuthUserRecord> | undefined

export async function seedSmokeAuth(page: Page, appUrl: string): Promise<void> {
  smokeUser ??= signInSmokeUser().catch((error: unknown) => {
    smokeUser = undefined
    throw error
  })
  await seedFirebaseAuthUser(page, appUrl, await smokeUser)
}
