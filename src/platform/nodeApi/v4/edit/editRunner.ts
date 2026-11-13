import type { LGraph } from '@/lib/litegraph/src/LGraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'

/** The open document's undo history: the change tracker's capture. */
export interface EditHistory {
  beforeChange(): void
  afterChange(): void
}

export interface EditRunner {
  /**
   * Applies a validated change to `graph` as one undo step, then advances the
   * graph's version and redraws it.
   */
  apply<T>(graph: LGraph, change: () => T): T
  /** Runs a pack's edits as one undo step. */
  batch<T>(edits: () => T): T
}

export function createEditRunner(
  history: () => EditHistory | undefined
): EditRunner {
  function asOneStep<T>(change: () => T): T {
    const tracker = history()
    tracker?.beforeChange()
    try {
      return change()
    } finally {
      tracker?.afterChange()
    }
  }

  return {
    apply(graph, change) {
      return asOneStep(() => {
        const result = change()
        graph.incrementVersion()
        graph.setDirtyCanvas(true, true)
        return result
      })
    },

    batch(edits) {
      if (typeof edits !== 'function' || isAsync(edits)) {
        throw invalidArgument('batch', 'a synchronous function', edits)
      }
      return asOneStep(edits)
    }
  }
}

function isAsync(edits: () => unknown): boolean {
  return Object.prototype.toString.call(edits) === '[object AsyncFunction]'
}
