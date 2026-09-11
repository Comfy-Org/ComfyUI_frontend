/**
 * Joining a caller to a shared in-flight read without letting either one
 * decide the other's fate.
 *
 * Deduplication and cancellation pull in opposite directions: if the request
 * carries the first caller's signal, that caller aborting fails every reader
 * that joined it, and a joiner aborting does nothing at all. So the shared
 * request carries no caller signal — it is bounded by its own timeout — and
 * each caller's signal releases only that caller's wait.
 *
 * This is the semantic `SessionClient.ensureFresh` already documents for its
 * shared mint: concurrent callers share one request, and a later caller's
 * signal releases that caller with a transient failure without cancelling the
 * work the others are still waiting on.
 */
import type { BillingResult } from './billingContracts.js'

/**
 * An abandoned wait is transient, the same bucket the transport reports an
 * abort under: the caller stopped waiting, which says nothing about whether
 * the read would have succeeded.
 */
const ABANDONED = {
  status: 'error',
  code: 'REQUEST_FAILED'
} as const satisfies BillingResult<never>

export function releaseOnAbort<T>(
  shared: Promise<BillingResult<T>>,
  signal: AbortSignal | undefined
): Promise<BillingResult<T>> {
  if (signal === undefined) return shared
  // An 'abort' listener never fires for a signal that is already aborted, so
  // a caller who cancelled before joining would otherwise wait for the full
  // shared read.
  if (signal.aborted) {
    void shared.catch(() => {})
    return Promise.resolve(ABANDONED)
  }

  return new Promise<BillingResult<T>>((resolve) => {
    const onAbort = () => resolve(ABANDONED)
    signal.addEventListener('abort', onAbort, { once: true })
    shared.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      () => {
        signal.removeEventListener('abort', onAbort)
        resolve(ABANDONED)
      }
    )
  })
}
