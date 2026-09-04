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
        headers: { Authorization: `Bearer ${token}` }
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

export async function refreshWorkshopCredits(
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<void> {
  const { session, remint } = useWorkshopSession()
  const token = session.value?.token
  if (!token) {
    balance.value = { status: 'unknown' }
    return
  }
  let result = await fetchBalance(token, fetchImpl)
  // One re-mint on a stale token, mirroring the run path's single retry.
  // Other failures are not the token's fault, so no mint is spent on them.
  if (result.status === 'error' && result.unauthorized) {
    const reminted = await remint()
    if (reminted?.status === 'ok') {
      result = await fetchBalance(reminted.session.token, fetchImpl)
    }
  }
  // The session may have signed out while the fetch was in flight.
  if (session.value !== undefined) balance.value = result
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
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

export function useWorkshopCredits() {
  start()
  const { session } = useWorkshopSession()
  return {
    balance: computed(() => balance.value),
    session
  }
}
