import type { Page } from '@playwright/test'

import type { FirebaseAuthUserRecord } from '@e2e/fixtures/helpers/firebaseAuthStorage'
import {
  FIREBASE_APP_NAME,
  FIREBASE_WEB_API_KEY,
  seedFirebaseAuthUser
} from '@e2e/fixtures/helpers/firebaseAuthStorage'

export const SMOKE_ENV_VARS = [
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
  const missing = missingSmokeEnvVars(process.env)
  if (missing.length > 0)
    throw new Error(
      `CUSTOM_NODES_ENV=cloud needs ${SMOKE_ENV_VARS.join(', ')} in the ` +
        `environment to sign in the smoke user; missing: ${missing.join(', ')}`
    )
  const email = process.env.SMOKE_ACCOUNT_EMAIL!
  const apiKey = FIREBASE_WEB_API_KEY
  // Node fetch, not page.request: traced transports retain the credential in failure artifacts.
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: process.env.SMOKE_ACCOUNT_PASSWORD,
        returnSecureToken: true,
        // Mirrors Comfy-Org/cloud testing/smoke/cmd/mint-smoke-api-key/main.go
        // firebaseSignIn, which signs this same account into this same project.
        clientType: 'CLIENT_TYPE_WEB'
      }),
      signal: AbortSignal.timeout(30_000)
    }
  )
  const body: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const code = identityToolkitErrorCode(body)
    throw new Error(
      `smoke-user sign-in failed (HTTP ${response.status}${code ? `: ${code}` : ''}) - ` +
        `the account must exist in the Firebase project this suite signs into ` +
        `(dreamboothy-dev, the project testcloud reports at /api/features); ` +
        `check SMOKE_ACCOUNT_EMAIL / SMOKE_ACCOUNT_PASSWORD`
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
  const user = await smokeUser
  await seedFirebaseAuthUser(page, appUrl, user)
  await markOnboardingSurveyCompleted(page, appUrl, user)
}

// Cloud's router guard reads GET /settings/onboarding_survey BEFORE the graph
// view mounts and treats 404 - the key never stored - as "not completed",
// redirecting to /cloud/survey (src/router.ts, and the 404 branch of
// getSurveyCompletedStatus). CloudSurveyView never initializes
// `window.app.extensionManager`, so an account missing that key hangs every
// app-ready wait forever with a perfectly healthy sign-in behind it - which
// is how a run reports nothing but "timeout". The guard is live on testcloud
// (/api/features reports onboarding_survey_enabled: true), and its survey has
// four required questions, so a headless account never satisfies it by
// accident. Seeding the key is what a real user does by finishing onboarding.
//
// Reads back after writing: an unverified write here would put us right back
// to inferring a cause from a downstream hang.
async function markOnboardingSurveyCompleted(
  page: Page,
  appUrl: string,
  user: FirebaseAuthUserRecord
): Promise<void> {
  const auth = {
    Authorization: `Bearer ${user.stsTokenManager.accessToken}`,
    'Content-Type': 'application/json'
  }
  const settingsUrl = new URL('/api/settings', appUrl).toString()
  const surveyUrl = new URL(
    '/api/settings/onboarding_survey',
    appUrl
  ).toString()

  const before = await page.request.get(surveyUrl, { headers: auth })
  if (before.ok()) {
    console.warn('[cloud] onboarding survey already satisfied; no seed needed')
    return
  }

  // Same endpoint, method and body shape the app itself uses when a real user
  // finishes onboarding (submitSurvey in src/platform/cloud/onboarding/auth.ts):
  // POST /settings with { onboarding_survey: <record> }.
  const wrote = await page.request.post(settingsUrl, {
    headers: auth,
    data: JSON.stringify({
      onboarding_survey: { completed_by: 'e2e-smoke-fixture' }
    })
  })
  if (!wrote.ok())
    throw new Error(
      `could not mark the onboarding survey completed for the smoke account ` +
        `(GET was ${before.status()}, POST was ${wrote.status()}) - without ` +
        `this key cloud boots land on /cloud/survey and never reach the graph`
    )

  const after = await page.request.get(surveyUrl, { headers: auth })
  if (!after.ok())
    throw new Error(
      `onboarding survey key did not persist: POST returned ${wrote.status()} ` +
        `but the read back still returns ${after.status()} - the guard will ` +
        `still bounce this boot to /cloud/survey`
    )
  console.warn(
    `[cloud] onboarding survey seeded and verified (was ${before.status()}, now ${after.status()})`
  )
}
