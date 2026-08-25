import { useAuthStore } from '@/stores/authStore'

/**
 * A Stripe credit top-up completes in a separate tab, and the balance only
 * changes once Stripe's webhook reaches comfy-api. Nothing re-reads the balance
 * when the user comes back, so the app keeps showing the pre-purchase amount
 * until a manual reload.
 *
 * Re-fetch when the app tab becomes visible again, retrying on a short schedule
 * because the webhook usually lands a beat after the redirect. Retries stop as
 * soon as the balance moves.
 */
const RETRY_DELAYS_MS = [0, 2_000, 5_000, 10_000, 20_000]

/** Drop the watch if the user never returns, rather than leaking listeners. */
const WATCH_LIFETIME_MS = 15 * 60_000

let stopActiveWatch: (() => void) | null = null

/**
 * Watch for the user returning from a Stripe top-up and refresh the balance.
 * Safe to call repeatedly: a new call replaces any watch still pending.
 */
export function watchForTopupBalanceUpdate(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  stopActiveWatch?.()

  const authStore = useAuthStore()
  const baselineMicros = authStore.balance?.amount_micros ?? 0

  const timeouts: ReturnType<typeof setTimeout>[] = []
  let started = false

  const stop = () => {
    document.removeEventListener('visibilitychange', onReturn)
    window.removeEventListener('focus', onReturn)
    for (const timeout of timeouts) clearTimeout(timeout)
    timeouts.length = 0
    if (stopActiveWatch === stop) stopActiveWatch = null
  }

  const refresh = async () => {
    try {
      const balance = await authStore.fetchBalance()
      if ((balance?.amount_micros ?? 0) > baselineMicros) stop()
    } catch (error) {
      // A failed poll is not actionable: the next attempt (or the panel's own
      // fetch) covers it, and the purchase itself already succeeded.
      console.warn('[Billing] Top-up balance refresh failed', error)
    }
  }

  function onReturn() {
    if (started || document.visibilityState !== 'visible') return
    started = true
    document.removeEventListener('visibilitychange', onReturn)
    window.removeEventListener('focus', onReturn)

    for (const delay of RETRY_DELAYS_MS) {
      timeouts.push(setTimeout(() => void refresh(), delay))
    }
  }

  document.addEventListener('visibilitychange', onReturn)
  window.addEventListener('focus', onReturn)
  timeouts.push(setTimeout(stop, WATCH_LIFETIME_MS))

  stopActiveWatch = stop
}
