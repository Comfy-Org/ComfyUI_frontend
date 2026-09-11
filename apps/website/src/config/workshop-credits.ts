/**
 * The credits balance behind the header chip.
 *
 * The authorized read (dedupe, the single 401 re-mint, superseded-identity
 * publish guards) lives in the site's own balance reader, since billing
 * stays outside @comfyorg/account in V1; this module owns presentation and
 * page lifecycle. Conversion goes through the shared
 * creditsUtil rounding so this chip never disagrees with what
 * platform.comfy.org renders for the same balance. Refresh triggers: the
 * session appearing or changing (sign-in, re-mint) and window refocus,
 * which also picks up a balance changed in another tab.
 */
import { computed, effectScope, ref, watch } from 'vue'

import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import { workshopBalanceReader } from './workshop-account'
import type { BalanceState as ReadState } from './workshop-balance'
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

function toBalanceState(state: ReadState): BalanceState {
  return state.status === 'ok'
    ? { status: 'ok', credits: balanceToCredits(state.cents) }
    : state
}

export function refreshWorkshopCredits(
  options: { readonly force?: boolean } = {}
): Promise<void> {
  return workshopBalanceReader.refresh(options)
}

let stopActive: (() => void) | undefined

function begin(): void {
  const { session } = useWorkshopSession()
  const stopClient = workshopBalanceReader.subscribe((state) => {
    balance.value = toBalanceState(state)
  })
  const activeScope = effectScope(true)
  activeScope.run(() => {
    watch(
      () => session.value?.token,
      (token) => {
        if (!token) {
          workshopBalanceReader.reset()
          return
        }
        // A rotated token means any read in flight is about to be discarded
        // by the publish guard; joining it would skip this refresh cycle.
        void refreshWorkshopCredits({ force: true })
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
  const { settled } = useWorkshopSession()
  lifecycle.run(() => {
    watch(
      settled,
      (isSettled) => {
        stopActive?.()
        stopActive = undefined
        if (isSettled) begin()
        else workshopBalanceReader.reset()
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
