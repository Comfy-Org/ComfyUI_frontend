/**
 * The credits balance behind the header chip.
 *
 * Conversion goes through the shared creditsUtil rounding so this chip never
 * disagrees with what platform.comfy.org renders for the same balance.
 * Refresh triggers: the session appearing or changing (sign-in, re-mint),
 * window refocus, and run completion — refocus is what closes the purchase
 * round trip without platform.comfy.org having to honor a return URL.
 */
import { computed, ref, watch } from 'vue'

import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import { useWorkshopAuthFlag } from '../scripts/posthog'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import { useWorkshopSession } from './workshop-session-state'

export function microsToCredits(micros: number): number {
  return centsToCredits(micros / 10_000)
}

/** Where credits are bought (decision: platform, Sep 2). */
export function workshopPurchaseUrl(returnTo: string): string {
  const url = new URL('https://platform.comfy.org/')
  url.searchParams.set('utm_source', 'comfy_workshop')
  url.searchParams.set('returnTo', returnTo)
  return url.toString()
}

type BalanceState =
  | { readonly status: 'unknown' }
  | { readonly status: 'ok'; readonly credits: number }
  | { readonly status: 'error'; readonly unauthorized?: boolean }

/** Ceiling on a balance read; a hung fetch must not pin the chip stale. */
const BALANCE_TIMEOUT_MS = 15_000

const balance = ref<BalanceState>({ status: 'unknown' })
let started = false

async function fetchBalance(
  token: string,
  fetchImpl: typeof fetch
): Promise<BalanceState> {
  let response: Response
  try {
    response = await fetchImpl(
      `${WORKSHOP_CLOUD_BASE_URL}/api/billing/balance`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(BALANCE_TIMEOUT_MS)
      }
    )
  } catch {
    return { status: 'error' }
  }
  if (!response.ok) {
    return { status: 'error', unauthorized: response.status === 401 }
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { status: 'error' }
  }
  const micros = readMicros(body)
  if (micros === undefined) return { status: 'error' }
  return { status: 'ok', credits: microsToCredits(micros) }
}

function readMicros(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  if (
    'effective_balance_micros' in body &&
    typeof body.effective_balance_micros === 'number'
  ) {
    return body.effective_balance_micros
  }
  // Older responses carry only amount_micros.
  if ('amount_micros' in body && typeof body.amount_micros === 'number') {
    return body.amount_micros
  }
  return undefined
}

let inFlight: Promise<void> | undefined
let inFlightIdentity: string | undefined

const identityKey = (uid: string, workspaceId: string | undefined) =>
  `${uid}|${workspaceId ?? ''}`

/**
 * Refresh the chip balance for the live session.
 *
 * Session-change, refocus and run-completion can all fire together; without
 * dedupe they race and the last fetch to resolve wins, so a slow earlier read
 * can overwrite a fresh later one. Concurrent callers for the same identity
 * therefore share one in-flight refresh; a caller for a different identity
 * (a user or workspace switch) starts its own rather than reusing a read
 * that is fetching for whoever came before.
 */
export function refreshWorkshopCredits(
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<void> {
  const { session } = useWorkshopSession()
  const active = session.value
  const identity = active
    ? identityKey(active.uid, active.workspace?.id)
    : undefined

  if (inFlight !== undefined && inFlightIdentity === identity) {
    return inFlight
  }

  inFlightIdentity = identity
  const refresh = runRefresh(fetchImpl).finally(() => {
    if (inFlight === refresh) {
      inFlight = undefined
      inFlightIdentity = undefined
    }
  })
  inFlight = refresh
  return refresh
}

async function runRefresh(fetchImpl: typeof fetch): Promise<void> {
  const { session, remint } = useWorkshopSession()
  const active = session.value
  if (!active) {
    balance.value = { status: 'unknown' }
    return
  }
  const uid = active.uid
  const workspaceId = active.workspace?.id
  let result = await fetchBalance(active.token, fetchImpl)
  // One re-mint on a stale token, mirroring the run path's single retry.
  // Other failures are not the token's fault, so no mint is spent on them.
  if (result.status === 'error' && result.unauthorized) {
    const reminted = await remint()
    if (reminted?.status === 'ok') {
      result = await fetchBalance(reminted.session.token, fetchImpl)
    }
  }
  // Publish only if the same user AND workspace is still signed in: a
  // sign-out, a user switch, or a workspace switch mid-fetch must not show a
  // balance that belongs to the identity we started with.
  const live = session.value
  if (live?.uid === uid && live?.workspace?.id === workspaceId) {
    balance.value = result
  }
}

function begin(): void {
  const { session } = useWorkshopSession()
  watch(
    () => session.value?.token,
    (token) => {
      if (!token) {
        balance.value = { status: 'unknown' }
        return
      }
      void refreshWorkshopCredits()
    },
    { immediate: true }
  )
  window.addEventListener('focus', () => {
    if (session.value !== undefined) void refreshWorkshopCredits()
  })
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  // No listeners until the flag is on, so a flag-off page installs nothing
  // and stays byte-identical to the site before sign-in existed.
  const enabled = useWorkshopAuthFlag()
  if (enabled.value) {
    begin()
    return
  }
  const stop = watch(enabled, (on) => {
    if (!on) return
    stop()
    begin()
  })
}

export function useWorkshopCredits() {
  start()
  const { session } = useWorkshopSession()
  return {
    balance: computed(() => balance.value),
    session
  }
}
