/**
 * One answer per user per tab, failures included: a checkout view captures
 * it once, and a remount (a workspace switch) must settle to the same answer
 * rather than risk showing the customer the other checkout.
 */
import { CLOUD_BASE_URL } from '@/config/env'
import { billingWebSessionClient } from '@/session/billingWebSession'

export type CheckoutUiVariant = 'embedded' | 'full_page'

export type CheckoutUiState =
  | { readonly phase: 'resolving' }
  | { readonly phase: 'settled'; readonly variant: CheckoutUiVariant }

const FLAG_KEY = 'billing_web_checkout_ui'
const FAIL_CLOSED: CheckoutUiVariant = 'embedded'
const FLAG_FETCH_TIMEOUT_MS = 4000

/** The shared web session's signed-in user and a cookie read of a Cloud URL. */
export interface WebSessionCloudRead {
  readonly uid: string
  readonly read: (
    url: string,
    init: RequestInit
  ) => Promise<Response | undefined>
}

let webSessionCloudRead: () => WebSessionCloudRead | undefined = () => undefined

/** Set by the auth module, which decides whether this tab is on the web session. */
export function provideWebSessionCloudRead(
  source: () => WebSessionCloudRead | undefined
): void {
  webSessionCloudRead = source
}

/** `settled` is terminal, so a mounted checkout can never become the other one. */
export function settleCheckoutUi(
  state: CheckoutUiState,
  variant: CheckoutUiVariant
): CheckoutUiState {
  return state.phase === 'settled' ? state : { phase: 'settled', variant }
}

function parseCheckoutUiVariant(value: unknown): CheckoutUiVariant | undefined {
  return value === 'embedded' || value === 'full_page' ? value : undefined
}

function parseBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function readDevOverride<T>(
  key: string,
  parse: (value: unknown) => T | undefined
): T | undefined {
  if (!import.meta.env.DEV || typeof localStorage === 'undefined')
    return undefined
  let raw: string | null
  try {
    raw = localStorage.getItem(`ff:${key}`)
  } catch {
    return undefined
  }
  if (raw === null) return undefined
  try {
    return parse(JSON.parse(raw))
  } catch {
    console.warn(`[ff] Invalid JSON for override "${key}":`, raw)
    return undefined
  }
}

const FEATURES_URL = `${CLOUD_BASE_URL}/api/features`

type CloudFeatures = Readonly<Record<string, unknown>>

async function featuresOf(
  response: Response | undefined
): Promise<CloudFeatures | undefined> {
  if (!response?.ok) return undefined
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null) return undefined
  return { ...body }
}

/**
 * Pinned to the workspace the session already holds: a target-less
 * `ensureFresh` would mint for the personal workspace and remount the view
 * under the customer.
 */
function readWithToken(workspaceId: string) {
  return async (signal: AbortSignal): Promise<Response | undefined> => {
    const minted = await billingWebSessionClient().ensureFresh(undefined, {
      workspaceId,
      signal,
      timeoutMs: FLAG_FETCH_TIMEOUT_MS
    })
    if (minted?.status !== 'ok') return undefined
    return fetch(FEATURES_URL, {
      headers: { Authorization: `Bearer ${minted.session.token}` },
      cache: 'no-store',
      signal
    })
  }
}

async function resolveFeatures(
  read: (signal: AbortSignal) => Promise<Response | undefined>
): Promise<CloudFeatures | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FLAG_FETCH_TIMEOUT_MS)
  try {
    return await featuresOf(await read(controller.signal))
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

let memo:
  | {
      readonly uid: string
      readonly resolution: Promise<CloudFeatures | undefined>
    }
  | undefined

function awaitCloudFeatures(): Promise<CloudFeatures | undefined> {
  const onSession = webSessionCloudRead()
  if (onSession) {
    const { uid, read } = onSession
    if (memo?.uid !== uid)
      memo = {
        uid,
        resolution: resolveFeatures((signal) =>
          read(FEATURES_URL, { cache: 'no-store', signal })
        )
      }
    return memo.resolution
  }
  const snapshot = billingWebSessionClient().getSnapshot()
  if (snapshot.phase !== 'authenticated') return Promise.resolve(undefined)
  const { uid, workspace } = snapshot.session
  if (memo?.uid !== uid)
    memo = { uid, resolution: resolveFeatures(readWithToken(workspace.id)) }
  return memo.resolution
}

async function awaitFlag<T>(
  key: string,
  parse: (value: unknown) => T | undefined,
  failClosed: T
): Promise<T> {
  const override = readDevOverride(key, parse)
  if (override !== undefined) return override
  const features = await awaitCloudFeatures()
  return parse(features?.[key]) ?? failClosed
}

/** Never rejects. An anonymous visitor is answered without memoizing, so a later signed-in mount still asks. */
export function awaitCheckoutUiVariant(): Promise<CheckoutUiVariant> {
  return awaitFlag(FLAG_KEY, parseCheckoutUiVariant, FAIL_CLOSED)
}

/** Never rejects; `false` unless Cloud serves `unified_billing_settings: true`. */
export function awaitUnifiedBillingSettings(): Promise<boolean> {
  return awaitFlag('unified_billing_settings', parseBoolean, false)
}
