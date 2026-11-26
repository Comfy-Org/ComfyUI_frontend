import {
  isAwaitingSavedState,
  markAwaitingSavedState,
  savedStateApplied
} from '@/lib/litegraph/src/awaitingSavedState'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

/** Marks a node a load added outside a graph's configure, as an import does, until it is configured or the current task ends. */
export function awaitSavedState(node: LGraphNode): void {
  if (isAwaitingSavedState(node)) return
  markAwaitingSavedState(node)
  queueMicrotask(() => savedStateApplied(node))
}
