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

/**
 * Mirrors the host's `getDevOverride`: JSON, so a bare `full_page` is
 * rejected and `"full_page"` honoured. An unrecognised variant falls through
 * to the server so a typo cannot silently pin a developer to `embedded`.
 */
function readDevOverride(): CheckoutUiVariant | undefined {
  if (!import.meta.env.DEV || typeof localStorage === 'undefined')
    return undefined
  let raw: string | null
  try {
    raw = localStorage.getItem(`ff:${FLAG_KEY}`)
  } catch {
    return undefined
  }
  if (raw === null) return undefined
  try {
    return parseCheckoutUiVariant(JSON.parse(raw))
  } catch {
    console.warn(`[ff] Invalid JSON for override "${FLAG_KEY}":`, raw)
    return undefined
  }
}

const FEATURES_URL = `${CLOUD_BASE_URL}/api/features`

async function variantOf(
  response: Response | undefined
): Promise<CheckoutUiVariant> {
  if (!response?.ok) return FAIL_CLOSED
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !(FLAG_KEY in body))
    return FAIL_CLOSED
  return parseCheckoutUiVariant(body[FLAG_KEY]) ?? FAIL_CLOSED
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

async function resolveVariant(
  read: (signal: AbortSignal) => Promise<Response | undefined>
): Promise<CheckoutUiVariant> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FLAG_FETCH_TIMEOUT_MS)
  try {
    return await variantOf(await read(controller.signal))
  } catch {
    return FAIL_CLOSED
  } finally {
    clearTimeout(timer)
  }
}

let memo:
  | { readonly uid: string; readonly resolution: Promise<CheckoutUiVariant> }
  | undefined

/** Never rejects. An anonymous visitor is answered without memoizing, so a later signed-in mount still asks. */
export function awaitCheckoutUiVariant(): Promise<CheckoutUiVariant> {
  const override = readDevOverride()
  if (override !== undefined) return Promise.resolve(override)
  const onSession = webSessionCloudRead()
  if (onSession) {
    const { uid, read } = onSession
    if (memo?.uid !== uid)
      memo = {
        uid,
        resolution: resolveVariant((signal) =>
          read(FEATURES_URL, { cache: 'no-store', signal })
        )
      }
    return memo.resolution
  }
  const snapshot = billingWebSessionClient().getSnapshot()
  if (snapshot.phase !== 'authenticated') return Promise.resolve(FAIL_CLOSED)
  const { uid, workspace } = snapshot.session
  if (memo?.uid !== uid)
    memo = { uid, resolution: resolveVariant(readWithToken(workspace.id)) }
  return memo.resolution
}
