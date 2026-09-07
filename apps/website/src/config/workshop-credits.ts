/**
 * The credits balance behind the header chip.
 *
 * The authorized read (dedupe, the single 401 re-mint, superseded-identity
 * publish guards) lives in @comfyorg/account's billing client; this module
 * owns presentation and page lifecycle. Conversion goes through the shared
 * creditsUtil rounding so this chip never disagrees with what
 * platform.comfy.org renders for the same balance. Refresh triggers: the
 * session appearing or changing (sign-in, re-mint) and window refocus,
 * which also picks up a balance changed in another tab.
 */
import { computed, effectScope, ref, watch } from 'vue'

import type { CreditsState } from '@comfyorg/account/core'
import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import { useWorkshopAuthFlag } from '../scripts/posthog'
import { workshopBillingClient } from './workshop-account'
import { useWorkshopSession } from './workshop-session-state'

/** Despite the field names, the balance endpoint returns cents. */
export function balanceToCredits(cents: number): number {
  return centsToCredits(cents)
}

type BalanceState =
  | { readonly status: 'unknown' }
  | { readonly status: 'ok'; readonly credits: number }
  | { readonly status: 'error'; readonly unauthorized?: boolean }

const balance = ref<BalanceState>({ status: 'unknown' })
let started = false

function toBalanceState(state: CreditsState): BalanceState {
  return state.status === 'ok'
    ? { status: 'ok', credits: balanceToCredits(state.cents) }
    : state
}

export function refreshWorkshopCredits(
  options: { readonly force?: boolean } = {}
): Promise<void> {
  return workshopBillingClient.refresh(options)
}

let stopActive: (() => void) | undefined

function begin(): void {
  const { session } = useWorkshopSession()
  const stopClient = workshopBillingClient.subscribe((state) => {
    balance.value = toBalanceState(state)
  })
  const activeScope = effectScope(true)
  activeScope.run(() => {
    watch(
      () => session.value?.token,
      (token) => {
        if (!token) {
          workshopBillingClient.reset()
          return
        }
        void refreshWorkshopCredits()
      },
      { immediate: true }
    )
  })
  const onFocus = () => {
    if (session.value !== undefined) {
      void refreshWorkshopCredits({ force: true })
    }
  }
  window.addEventListener('focus', onFocus)
  stopActive = () => {
    stopClient()
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
        else workshopBillingClient.reset()
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
