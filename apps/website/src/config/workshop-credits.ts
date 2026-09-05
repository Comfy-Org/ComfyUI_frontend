/**
 * The credits balance behind the header chip.
 *
 * Conversion goes through the shared creditsUtil rounding so this chip never
 * disagrees with what platform.comfy.org renders for the same balance.
 * Refresh triggers: the session appearing or changing (sign-in, re-mint)
 * and window refocus. Refocus also picks up a balance changed in another tab.
 */
import type { BillingBalanceResponse } from '@comfyorg/ingest-types'
import { computed, effectScope, ref, watch } from 'vue'

import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import { useWorkshopAuthFlag } from '../scripts/posthog'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'
import { useWorkshopSession } from './workshop-session-state'

/** Despite the field names, this endpoint returns cents. */
export function balanceToCredits(cents: number): number {
  return centsToCredits(cents)
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
  const cents = readBalanceCents(body)
  if (cents === undefined) return { status: 'error' }
  return { status: 'ok', credits: balanceToCredits(cents) }
}

function readBalanceCents(
  body: unknown
): BillingBalanceResponse['amount_micros'] | undefined {
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

const identityKey = (uid: string, token: string) => `${uid}|${token}`

/**
 * Refresh the chip balance for the live session.
 *
 * Session-change and refocus can fire together; without
 * dedupe they race and the last fetch to resolve wins, so a slow earlier read
 * can overwrite a fresh later one. Concurrent callers for the same identity
 * therefore share one in-flight refresh; a caller for a different identity
 * (a user or token switch) starts its own rather than reusing a read
 * that is fetching for whoever came before.
 */
export function refreshWorkshopCredits(
  fetchImpl: typeof fetch = globalThis.fetch,
  options: { readonly force?: boolean } = {}
): Promise<void> {
  const { session } = useWorkshopSession()
  const active = session.value
  const identity = active ? identityKey(active.uid, active.token) : undefined

  if (inFlight !== undefined && inFlightIdentity === identity) {
    return options.force
      ? inFlight.then(() => refreshWorkshopCredits(fetchImpl))
      : inFlight
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
  let token = active.token
  let result = await fetchBalance(token, fetchImpl)
  // One re-mint on a stale token, mirroring the run path's single retry.
  // Other failures are not the token's fault, so no mint is spent on them.
  if (result.status === 'error' && result.unauthorized) {
    const reminted = await remint()
    if (reminted?.status === 'ok') {
      token = reminted.session.token
      result = await fetchBalance(token, fetchImpl)
    }
  }
  // Publish only if the same user and token are still live. A sign-out, user
  // switch, or re-mint must not publish an older read.
  const live = session.value
  if (live?.uid === uid && live.token === token) {
    balance.value = result
  }
}

let stopActive: (() => void) | undefined

function begin(): void {
  const { session } = useWorkshopSession()
  const activeScope = effectScope(true)
  activeScope.run(() => {
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
  })
  const onFocus = () => {
    if (session.value !== undefined) {
      void refreshWorkshopCredits(globalThis.fetch, { force: true })
    }
  }
  window.addEventListener('focus', onFocus)
  stopActive = () => {
    activeScope.stop()
    window.removeEventListener('focus', onFocus)
  }
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  // This detached scope gives the module singleton its own lifetime instead
  // of binding its watchers to whichever component calls this first.
  const lifecycle = effectScope(true)
  const enabled = useWorkshopAuthFlag()
  lifecycle.run(() => {
    watch(
      enabled,
      (on) => {
        stopActive?.()
        stopActive = undefined
        if (on) begin()
        else balance.value = { status: 'unknown' }
      },
      { immediate: true }
    )
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
