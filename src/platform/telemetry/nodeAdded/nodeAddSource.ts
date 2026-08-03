import type { NodeAddSource } from '../types'

let currentSource: NodeAddSource = 'unknown'

export function getCurrentNodeAddSource(): NodeAddSource {
  return currentSource
}

/**
 * Set the node-add source for the duration of `fn`. Synchronous only —
 * the source is read by the synchronous LGraph.onNodeAdded callback that
 * fires inside `graph.add()`. Nesting restores the previous value on exit.
 */
export function withNodeAddSource<T>(source: NodeAddSource, fn: () => T): T {
  const previous = currentSource
  currentSource = source
  try {
    return fn()
  } finally {
    currentSource = previous
  }
}
