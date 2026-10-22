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

/** Full retry schedules a returning user can trigger; later returns get a single fetch. */
const MAX_SCHEDULED_RUNS = 5

let stopActiveWatch: (() => void) | null = null

interface TopupBalanceSource {
  current: () => number | null
  fetch: () => Promise<number | null>
}

const customerBalanceSource: TopupBalanceSource = {
  current: () => useAuthStore().balance?.amount_micros ?? null,
  fetch: async () =>
    (await useAuthStore().fetchBalance())?.amount_micros ?? null
}

/**
 * Watch for the user returning from a Stripe top-up and refresh the balance.
 * Safe to call repeatedly: a new call replaces any watch still pending.
 */
export function watchForTopupBalanceUpdate({
  source = customerBalanceSource,
  onBalanceIncreased
}: {
  source?: TopupBalanceSource
  onBalanceIncreased?: () => Promise<unknown>
} = {}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  stopActiveWatch?.()

  let baselineMicros: number | null = source.current()

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

  const refresh = async (): Promise<boolean> => {
    try {
      const amountMicros = (await source.fetch()) ?? 0
      if (baselineMicros === null) {
        baselineMicros = amountMicros
        return false
      }
      return amountMicros > baselineMicros
    } catch (error) {
      console.warn('[Billing] Top-up balance refresh failed', error)
      return false
    }
  }

  const refreshDependents = async () => {
    try {
      await onBalanceIncreased?.()
    } catch (error) {
      console.warn('[Billing] Top-up dependent refresh failed', error)
    }
  }

  async function onReturn() {
    if (running || stopped || document.visibilityState !== 'visible') return
    running = true
    runs += 1

    const gaps = runs > MAX_SCHEDULED_RUNS ? [0] : RETRY_GAPS_MS
    const isStopped = () => stopped

    for (const gap of gaps) {
      await wait(gap)
      if (isStopped()) return
      if (await refresh()) {
        await refreshDependents()
        stop()
        return
      }
      if (isStopped()) return
    }

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
