/**
 * Admits every human operation to the sender synchronously, then defers only
 * delivery until the end of the tick. Admission pins workflow, actor, version,
 * and operation identity before a reactive retarget can change them, while the
 * deferred flush still lets the sender combine an N-node edit into one batch.
 */
import type { GraphOperation } from './graphOperations'

interface OpCoalescer {
  enqueue(operations: GraphOperation[]): void
  detach(): void
}

export function createOpCoalescer(
  admit: (operations: GraphOperation[]) => void,
  flush: () => void
): OpCoalescer {
  let flushScheduled = false
  let detached = false

  function flushAdmitted(): void {
    flushScheduled = false
    if (!detached) flush()
  }

  return {
    enqueue(operations) {
      if (detached || operations.length === 0) return
      admit(operations)
      if (flushScheduled) return
      flushScheduled = true
      void Promise.resolve().then(flushAdmitted)
    },
    detach() {
      detached = true
    }
  }
}
