/**
 * The fallback for a top-up whose `billing_op_id` this tab never observed:
 * with nothing to poll, the balance itself is the only evidence that the
 * purchase landed. Ported from the cloud app's `topupBalanceRefresh` minus
 * its document listeners — a host calls `wake` from its own focus and
 * visibility signals, the same way it wakes the lifecycle.
 *
 * A watch has no operation id at all; the SDK never fabricates one to poll
 * instead. The top-up command reads the balance right before its POST, so
 * `credits.getSnapshot()` after a malformed response is the baseline to arm
 * this with.
 */
import type { CreditsReader } from './credits.js'

/** Gaps between reads in one run: the webhook usually lands a beat after the return. */
export const BALANCE_WATCH_RETRY_GAPS_MS = [
  0, 2_000, 5_000, 10_000, 20_000
] as const

/** A host that never comes back must not keep a watch alive forever. */
export const BALANCE_WATCH_LIFETIME_MS = 15 * 60_000

/** Full retry schedules a returning host can trigger; later wakes read once. */
export const BALANCE_WATCH_MAX_SCHEDULED_RUNS = 5

export type BalanceWatchOutcome = 'reconciled' | 'expired' | 'stopped'

export interface BalanceWatchOptions {
  readonly credits: Pick<CreditsReader, 'read'>
  /**
   * The pre-purchase balance in micros. Absent, it is learned from the first
   * successful read, which therefore can never count as the increase.
   */
  readonly baselineMicros?: number
}

export interface BalanceWatch {
  /** The host regained focus or visibility: run the read schedule. */
  wake: () => void
  stop: () => void
  readonly outcome: Promise<BalanceWatchOutcome>
}

export function createBalanceWatch(options: BalanceWatchOptions): BalanceWatch {
  const { credits } = options
  let baselineMicros = options.baselineMicros
  let runs = 0
  let running = false
  let finished: BalanceWatchOutcome | undefined
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let resolveOutcome: (outcome: BalanceWatchOutcome) => void = () => {}
  const outcome = new Promise<BalanceWatchOutcome>((resolve) => {
    resolveOutcome = resolve
  })

  function finish(result: BalanceWatchOutcome) {
    if (finished !== undefined) return
    finished = result
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    resolveOutcome(result)
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        resolve()
      }, ms)
      timers.add(timer)
    })
  }

  // A failed read is not a verdict: the next attempt covers it, and the
  // purchase itself already went through.
  async function balanceRose(): Promise<boolean> {
    const read = await credits.read()
    if (read.status === 'error') return false
    const amountMicros = read.value.balance.amount_micros
    if (baselineMicros === undefined) {
      baselineMicros = amountMicros
      return false
    }
    return amountMicros > baselineMicros
  }

  // Past the run cap a wake still reads once — the return after the actual
  // payment must read no matter how often the host glanced back beforehand.
  const isFinished = () => finished !== undefined

  async function run() {
    running = true
    runs += 1
    const gaps =
      runs > BALANCE_WATCH_MAX_SCHEDULED_RUNS
        ? [0]
        : BALANCE_WATCH_RETRY_GAPS_MS
    for (const gap of gaps) {
      await wait(gap)
      if (isFinished()) return
      if (await balanceRose()) {
        finish('reconciled')
        return
      }
      if (isFinished()) return
    }
    running = false
  }

  timers.add(setTimeout(() => finish('expired'), BALANCE_WATCH_LIFETIME_MS))

  return {
    wake: () => {
      if (running || finished !== undefined) return
      void run()
    },
    stop: () => finish('stopped'),
    outcome
  }
}
