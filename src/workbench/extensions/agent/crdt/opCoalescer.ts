/**
 * Folds every human operation minted in one tick into a single delivery to
 * the sender. The layout store flushes an N-node edit as N changes in one
 * microtask, and the mint ports call `enqueue` once per change; without this
 * seam each call became its own serialized wire batch, so a clear made
 * while bound needed N round trips to reach the document and lost its tail
 * when the chat unbound mid-way. The microtask flush keeps mint order and
 * hands the sender one batch it chunks at the wire cap as usual.
 */
import type { GraphOperation } from './graphOperations'

export interface OpCoalescer {
  enqueue(operations: GraphOperation[]): void
  detach(): void
}

export function createOpCoalescer(
  deliver: (operations: GraphOperation[]) => void
): OpCoalescer {
  let buffer: GraphOperation[] = []
  let flushScheduled = false
  let detached = false

  function flush(): void {
    flushScheduled = false
    if (detached || buffer.length === 0) return
    const batch = buffer
    buffer = []
    deliver(batch)
  }

  return {
    enqueue(operations) {
      if (detached || operations.length === 0) return
      buffer.push(...operations)
      if (flushScheduled) return
      flushScheduled = true
      queueMicrotask(flush)
    },
    detach() {
      detached = true
      buffer = []
    }
  }
}
