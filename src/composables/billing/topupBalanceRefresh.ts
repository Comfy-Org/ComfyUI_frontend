import { useAuthStore } from '@/stores/authStore'

/**
 * A Stripe credit top-up completes in a separate tab, and the balance only
 * changes once Stripe's webhook reaches comfy-api. Nothing re-reads the balance
 * when the user comes back, so the app keeps showing the pre-purchase amount
 * until a manual reload.
 *
 * Re-fetch when the app tab becomes visible again, retrying on a short schedule
 * because the webhook usually lands a beat after the redirect. Gaps between
 * attempts, so the run spans ~37s.
 */
const RETRY_GAPS_MS = [0, 2_000, 5_000, 10_000, 20_000]

/** Drop the watch if the user never returns, rather than leaking listeners. */
const WATCH_LIFETIME_MS = 15 * 60_000

/** Bounds the polling a tab-switching user can trigger by re-arming. */
const MAX_RUNS = 5

let stopActiveWatch: (() => void) | null = null

/**
 * Watch for the user returning from a Stripe top-up and refresh the balance.
 * Safe to call repeatedly: a new call replaces any watch still pending.
 */
export function watchForTopupBalanceUpdate(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  stopActiveWatch?.()

  const authStore = useAuthStore()

  // Null until a balance is known: treating "not loaded yet" as 0 would let the
  // first read of the *pre-purchase* balance count as the increase we are
  // waiting for, stopping the watch on the stale amount.
  let baselineMicros: number | null = authStore.balance?.amount_micros ?? null

  const timeouts = new Set<ReturnType<typeof setTimeout>>()
  let stopped = false
  let running = false
  let runs = 0

  const stop = () => {
    stopped = true
    document.removeEventListener('visibilitychange', handleReturn)
    window.removeEventListener('focus', handleReturn)
    for (const timeout of timeouts) clearTimeout(timeout)
    timeouts.clear()
    if (stopActiveWatch === stop) stopActiveWatch = null
  }

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        timeouts.delete(timeout)
        resolve()
      }, ms)
      timeouts.add(timeout)
    })

  /** Fetch the balance; true once it has risen above the arming baseline. */
  const refresh = async (): Promise<boolean> => {
    try {
      const balance = await authStore.fetchBalance()
      const amountMicros = balance?.amount_micros ?? 0
      if (baselineMicros === null) {
        baselineMicros = amountMicros
        return false
      }
      return amountMicros > baselineMicros
    } catch (error) {
      // A failed poll is not actionable: the next attempt (or the panel's own
      // fetch) covers it, and the purchase itself already succeeded.
      console.warn('[Billing] Top-up balance refresh failed', error)
      return false
    }
  }

  async function onReturn() {
    if (running || stopped || document.visibilityState !== 'visible') return
    if (runs >= MAX_RUNS) {
      stop()
      return
    }
    running = true
    runs += 1

    for (const gap of RETRY_GAPS_MS) {
      await wait(gap)
      if (stopped) return
      if (await refresh()) {
        stop()
        return
      }
      if (stopped) return
    }

    // The schedule can be spent on a bounce back to the app *before* paying.
    // Stay armed for the return that follows the actual payment; the watch
    // lifetime is what bounds this, not the number of returns.
    running = false
  }

  function handleReturn() {
    void onReturn()
  }

  document.addEventListener('visibilitychange', handleReturn)
  window.addEventListener('focus', handleReturn)
  timeouts.add(setTimeout(stop, WATCH_LIFETIME_MS))

  stopActiveWatch = stop
}
