/**
 * A monotonic owner for work that outlives an await: each `capture()` snapshots
 * the current generation and returns a handle whose `live()` stays true until
 * `abandon()` bumps the generation. A flag flip, a reset, or teardown calls
 * `abandon()`; the in-flight work re-checks `live()` after every await and drops
 * its result once superseded, so a stale sign-in, mint, or fetch can never
 * publish for an attempt that no longer owns the outcome.
 */
export interface OperationHandle {
  live: () => boolean
}

export interface BoundedOperation {
  capture: () => OperationHandle
  abandon: () => void
}

export function createBoundedOperation(): BoundedOperation {
  let generation = 0
  return {
    capture() {
      const captured = generation
      return { live: () => captured === generation }
    },
    abandon() {
      generation += 1
    }
  }
}
