import type { Page } from '@playwright/test'

import type { FirebaseAuthUserRecord } from '@e2e/fixtures/helpers/firebaseAuthStorage'
import {
  FIREBASE_APP_NAME,
  FIREBASE_WEB_API_KEY,
  seedFirebaseAuthUser
} from '@e2e/fixtures/helpers/firebaseAuthStorage'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'

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

export interface WorkspaceSession {
  token: string
  expiresAt: number
  workspace: { id: string; name: string; type: string; role: string }
  ownerUid: string
}

// Mirrors WorkspaceTokenResponseSchema in
// src/platform/workspace/stores/workspaceAuthStore.ts.
export function workspaceSessionFromResponse(
  tokenResponse: unknown,
  ownerUid: string
): WorkspaceSession {
  const fields =
    typeof tokenResponse === 'object' && tokenResponse !== null
      ? (tokenResponse as Record<string, unknown>)
      : {}
  const workspaceFields =
    typeof fields.workspace === 'object' && fields.workspace !== null
      ? (fields.workspace as Record<string, unknown>)
      : {}
  const token = stringField(fields, 'token')
  const expiresAtIso = stringField(fields, 'expires_at')
  const role = stringField(fields, 'role')
  const id = stringField(workspaceFields, 'id')
  const name = stringField(workspaceFields, 'name')
  const type = stringField(workspaceFields, 'type')
  if (
    token === undefined ||
    expiresAtIso === undefined ||
    role === undefined ||
    id === undefined ||
    name === undefined ||
    type === undefined
  ) {
    const missing = Object.entries({
      token,
      expires_at: expiresAtIso,
      role,
      'workspace.id': id,
      'workspace.name': name,
      'workspace.type': type
    })
      .filter(([, value]) => value === undefined)
      .map(([field]) => field)
    throw new Error(
      `workspace token response is missing ${missing.join(', ')} - cannot seed a real workspace JWT`
    )
  }
  const expiresAt = Date.parse(expiresAtIso)
  if (!Number.isFinite(expiresAt))
    throw new Error(
      'workspace token response carries an unparsable expires_at - cannot compute the workspace token expiration'
    )
  return { token, expiresAt, workspace: { id, name, type, role }, ownerUid }
}

// Since ~08-03 testcloud 403s data requests that carry a raw Firebase ID token
// (probe run 30873678137: session restores, currentUser true, every settings
// write 403). /auth/token is the exchange the app itself uses; an empty body
// mints the caller's personal workspace.
async function mintWorkspaceSession(
  appUrl: string,
  user: FirebaseAuthUserRecord
): Promise<WorkspaceSession> {
  const response = await fetch(`${appUrl}/api/auth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${user.stsTokenManager.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: '{}',
    signal: AbortSignal.timeout(30_000)
  })
  const body: unknown = await response.json().catch(() => undefined)
  if (!response.ok)
    throw new Error(
      `workspace token mint failed (HTTP ${response.status} POST /api/auth/token) - ` +
        `testcloud refused to exchange the smoke user's Firebase identity for a ` +
        `workspace JWT; the account must exist in the project testcloud reports ` +
        `at /api/features and own a personal workspace`
    )
  return workspaceSessionFromResponse(body, user.uid)
}

const WORKSPACE_TOKEN_MIN_REMAINING_MS = 5 * 60 * 1000

let workspaceSession: Promise<WorkspaceSession> | undefined

async function ensureWorkspaceSession(
  appUrl: string,
  user: FirebaseAuthUserRecord
): Promise<WorkspaceSession> {
  const cached = await workspaceSession?.catch(() => undefined)
  if (
    cached &&
    cached.expiresAt - Date.now() > WORKSPACE_TOKEN_MIN_REMAINING_MS
  )
    return cached
  workspaceSession = mintWorkspaceSession(appUrl, user).catch(
    (error: unknown) => {
      workspaceSession = undefined
      throw error
    }
  )
  return workspaceSession
}

// workspaceAuthStore.initializeFromSession restores from exactly these four keys.
async function seedWorkspaceSession(
  page: Page,
  session: WorkspaceSession
): Promise<void> {
  await page.addInitScript(
    ({ keys, entries }) => {
      sessionStorage.setItem(keys.CURRENT_WORKSPACE, entries.workspace)
      sessionStorage.setItem(keys.TOKEN, entries.token)
      sessionStorage.setItem(keys.EXPIRES_AT, entries.expiresAt)
      sessionStorage.setItem(keys.OWNER_UID, entries.ownerUid)
    },
    {
      keys: WORKSPACE_STORAGE_KEYS,
      entries: {
        workspace: JSON.stringify(session.workspace),
        token: session.token,
        expiresAt: String(session.expiresAt),
        ownerUid: session.ownerUid
      }
    }
  )
}

// /auth/token keeps its Firebase bearer: that exchange is what mints this token.
// /features must answer anonymously the way prod's boot ordering asks it, so the
// flag payload the router guard reads carries unified_cloud_auth false; answered
// authenticated it flips true before the app has minted a unified token, and the
// guard's exit path hard-reloads away the in-memory token in a loop.
// Session creation keeps its Firebase bearer. Rewriting it to the workspace
// JWT returned 500 in the cloud gate.
const WORKSPACE_AUTH_EXCLUDED_PATHS = new Set([
  '/api/auth/session',
  '/api/auth/token',
  '/api/features'
])

export function shouldRewriteAuthHeader(url: URL, apiPrefix: string): boolean {
  return (
    url.href.startsWith(apiPrefix) &&
    !WORKSPACE_AUTH_EXCLUDED_PATHS.has(url.pathname)
  )
}

// The restored session only feeds getAuthHeader's teamWorkspaces branch, and on
// testcloud unified_cloud_auth returns above it (authStore.ts) from an in-memory
// token no fixture can seed - probe run 30873678137 shows both flag states
// within one boot. Attaching the minted JWT on the wire serves either branch.
async function attachWorkspaceAuthHeader(
  page: Page,
  appUrl: string,
  token: string
): Promise<void> {
  const apiPrefix = new URL('/api/', appUrl).toString()
  await page.route(
    (url) => shouldRewriteAuthHeader(url, apiPrefix),
    (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          authorization: `Bearer ${token}`
        }
      })
  )
}

export async function storeSmokeSettings(
  appUrl: string,
  token: string,
  settings: Record<string, unknown>,
  request: typeof fetch = fetch
): Promise<void> {
  const response = await request(`${appUrl}/api/settings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings),
    signal: AbortSignal.timeout(30_000)
  })
  await response.text()
  if (!response.ok)
    throw new Error(
      `cloud startup settings seed failed (HTTP ${response.status} POST /api/settings) - ` +
        `testcloud refused the smoke user's workspace JWT before app boot`
    )
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

async function cachedSmokeUser(): Promise<FirebaseAuthUserRecord> {
  smokeUser ??= signInSmokeUser().catch((error: unknown) => {
    smokeUser = undefined
    throw error
  })
  return smokeUser
}

export interface SmokeAuthSeedActions {
  signIn: () => Promise<FirebaseAuthUserRecord>
  seedFirebase: typeof seedFirebaseAuthUser
  ensureSession: typeof ensureWorkspaceSession
  storeSettings: typeof storeSmokeSettings
  seedWorkspace: typeof seedWorkspaceSession
  attachHeader: typeof attachWorkspaceAuthHeader
  bypassSurvey: typeof bypassOnboardingSurvey
  blockTelemetry: typeof blockThirdPartyTelemetry
}

const defaultSmokeAuthSeedActions: SmokeAuthSeedActions = {
  signIn: cachedSmokeUser,
  seedFirebase: seedFirebaseAuthUser,
  ensureSession: ensureWorkspaceSession,
  storeSettings: storeSmokeSettings,
  seedWorkspace: seedWorkspaceSession,
  attachHeader: attachWorkspaceAuthHeader,
  bypassSurvey: bypassOnboardingSurvey,
  blockTelemetry: blockThirdPartyTelemetry
}

export async function seedSmokeAuth(
  page: Page,
  appUrl: string,
  startupSettings: Record<string, unknown>,
  actions: SmokeAuthSeedActions = defaultSmokeAuthSeedActions
): Promise<void> {
  const user = await actions.signIn()
  await actions.seedFirebase(page, appUrl, user)
  // The app pins persistence to browserLocalPersistence (authStore setPersistence),
  // so the IndexedDB seed alone races that switch and boots signed out
  // intermittently (gate run 30717671737). Seed localStorage under the same key.
  await page.evaluate((record) => {
    const key = `firebase:authUser:${record.apiKey}:${record.appName}`
    localStorage.setItem(key, JSON.stringify(record))
  }, user)
  const session = await actions.ensureSession(appUrl, user)
  await actions.storeSettings(appUrl, session.token, startupSettings)
  await actions.seedWorkspace(page, session)
  // Registered before the routes below: Playwright matches handlers in reverse
  // registration order, so this one is the fallback the others defer to.
  await actions.attachHeader(page, appUrl, session.token)
  await actions.bypassSurvey(page)
  await actions.blockTelemetry(page)
}

// Third-party analytics egress, not cloud backend data. The CI preview origin
// (localhost:4173) is CORS-denied by mp.comfy.org, and each denial logs a
// console error that reds whichever pack's collector window catches it - 23
// packs in gate run 30719735171, all before the first backend 502. Aborting
// (not stubbing) makes the requests fail fast and keeps CI out of production
// analytics. Hosts mirror ComfyPage's TRACE_TELEMETRY third-party set.
// Host-anchored: a bare URL regex also matched the app's own same-origin
// vendor-sentry-*.js chunk and aborted the entry module (runs 30855533100 and
// 30868067295 - every test failed at boot on Failed to fetch main-*.js).
const TELEMETRY_HOSTS =
  /(^|\.)(mp\.comfy\.org|customer\.io|gist\.build|sy-d\.io|sentry\.io)$/
async function blockThirdPartyTelemetry(page: Page): Promise<void> {
  // Fulfill 200 + {} - never abort, never empty-body: an abort logs
  // net::ERR_FAILED (x4 per boot, run 30871208042) and an empty 204 makes the
  // SDK's response.json() throw 'Unexpected end of JSON input' (run
  // 30871967215). An empty JSON object parses clean and logs nothing.
  await page.route(
    (url) => TELEMETRY_HOSTS.test(url.hostname),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}'
      })
  )
}

async function bypassOnboardingSurvey(page: Page): Promise<void> {
  await page.route('**/settings/onboarding_survey', async (route) => {
    if (route.request().method() !== 'GET') {
      // fallback, not continue: continue skips the workspace-auth handler.
      await route.fallback()
      return
    }
    console.warn(`[cloud] survey gate intercepted: ${route.request().url()}`)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ value: { completed_by: 'e2e-smoke-fixture' } })
    })
  })
}
