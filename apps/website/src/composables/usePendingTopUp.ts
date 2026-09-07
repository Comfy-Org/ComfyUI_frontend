import { ref } from 'vue'

import type { ReturnStep } from '../lib/workshop/buy-credits'
import { SETTLE_DELAY_MS, returnStepFor } from '../lib/workshop/buy-credits'
import { useMockSession } from './useMockSession'
import type { TopUpOutcome } from './usePrototypeTweaks'

interface PendingTopUp {
  readonly credits: number
  readonly previousCredits: number
}

// A purchase in flight outlives the dialog. Dismissing the card cannot cancel
// anything — the checkout is open in another tab and resolves on its own — so
// the page keeps watching and the balance updates underneath. Owning this here
// rather than in the dialog is what makes closing safe.
const pending = ref<PendingTopUp | null>(null)
const outcome = ref<ReturnStep>('waiting')
let timer: ReturnType<typeof setTimeout> | undefined

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = undefined
}

export function usePendingTopUp() {
  const { session, addCredits } = useMockSession()

  const currentCredits = () =>
    session.value.status === 'signedIn' ? session.value.account.credits : 0

  // They have left for Stripe. Nothing has been paid yet and nothing is
  // scheduled: the page simply starts waiting.
  function begin(credits: number) {
    clearTimer()
    pending.value = { credits, previousCredits: currentCredits() }
    outcome.value = 'waiting'
  }

  // Stripe took the card. The grant follows on a webhook, so the page keeps
  // waiting until it lands — or, when it never does, until the timeout.
  function settle(resolveTo: TopUpOutcome) {
    const target = returnStepFor(resolveTo)
    if (!pending.value || target === 'waiting') return
    clearTimer()
    timer = setTimeout(() => {
      if (target === 'landed' && pending.value)
        addCredits(pending.value.credits)
      outcome.value = target
    }, SETTLE_DELAY_MS)
  }

  // Only for review links, which drop straight onto a resolved state.
  function place(step: ReturnStep, credits: number) {
    clearTimer()
    pending.value = { credits, previousCredits: currentCredits() }
    outcome.value = step
    if (step === 'landed') addCredits(credits)
  }

  function clear() {
    clearTimer()
    pending.value = null
    outcome.value = 'waiting'
  }

  return { pending, outcome, begin, settle, place, clear }
}
