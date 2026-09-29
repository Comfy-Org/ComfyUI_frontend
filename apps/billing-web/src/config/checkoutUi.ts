/**
 * One answer per user per tab, failures included: a checkout view captures
 * it once, and a remount (a workspace switch) must settle to the same answer
 * rather than risk showing the customer the other checkout.
 */
import type { SessionSnapshot } from '@comfyorg/account-core/session'

import { CLOUD_BASE_URL } from '@/config/env'
import { billingWebSessionClient } from '@/session/billingWebSession'

export type CheckoutUiVariant = 'embedded' | 'full_page'

export type CheckoutUiState =
  | { readonly phase: 'resolving' }
  | { readonly phase: 'settled'; readonly variant: CheckoutUiVariant }

const FLAG_KEY = 'billing_web_checkout_ui'
const FAIL_CLOSED: CheckoutUiVariant = 'embedded'
const FLAG_FETCH_TIMEOUT_MS = 4000

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

async function fetchVariant(
  token: string,
  signal: AbortSignal
): Promise<CheckoutUiVariant> {
  const response = await fetch(`${CLOUD_BASE_URL}/api/features`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal
  })
  if (!response.ok) return FAIL_CLOSED
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
async function resolveVariant(workspaceId: string): Promise<CheckoutUiVariant> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FLAG_FETCH_TIMEOUT_MS)
  try {
    const minted = await billingWebSessionClient().ensureFresh(undefined, {
      workspaceId,
      signal: controller.signal,
      timeoutMs: FLAG_FETCH_TIMEOUT_MS
    })
    if (minted?.status !== 'ok') return FAIL_CLOSED
    return await fetchVariant(minted.session.token, controller.signal)
  } catch {
    return FAIL_CLOSED
  } finally {
    clearTimeout(timer)
  }
}

let memo:
  | { readonly uid: string; readonly resolution: Promise<CheckoutUiVariant> }
  | undefined

/**
 * Where a checkout link that names no plan goes: back to its host to choose
 * one, or to the full page, which explains it. Only a signed-in customer's
 * flag can keep it here. A visitor with no identity, or one whose sign-in
 * failed, goes back as the embedded checkout always sent them; one whose
 * identity has not minted yet signs in first, and the route guard asks again
 * on the way back.
 */
export type PlanlessCheckoutRoute = 'host' | 'sign_in' | 'full_page'

export async function planlessCheckoutRoute(
  settledPhase: () => Promise<SessionSnapshot['phase']>
): Promise<PlanlessCheckoutRoute> {
  const phase = await settledPhase()
  if (phase === 'minting') return 'sign_in'
  if (phase !== 'authenticated') return 'host'
  return (await awaitCheckoutUiVariant()) === 'full_page' ? 'full_page' : 'host'
}

/** Never rejects. An anonymous visitor is answered without memoizing, so a later signed-in mount still asks. */
export function awaitCheckoutUiVariant(): Promise<CheckoutUiVariant> {
  const override = readDevOverride()
  if (override !== undefined) return Promise.resolve(override)
  const snapshot = billingWebSessionClient().getSnapshot()
  if (snapshot.phase !== 'authenticated') return Promise.resolve(FAIL_CLOSED)
  const { uid, workspace } = snapshot.session
  if (memo?.uid !== uid)
    memo = { uid, resolution: resolveVariant(workspace.id) }
  return memo.resolution
}
