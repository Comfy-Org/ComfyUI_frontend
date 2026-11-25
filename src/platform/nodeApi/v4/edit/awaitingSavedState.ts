import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

const awaiting = new WeakSet<LGraphNode>()

/** Marks a node a load added before its saved state, until it takes that state or the current task ends. */
export function awaitSavedState(node: LGraphNode): void {
  awaiting.add(node)
  queueMicrotask(() => awaiting.delete(node))
}

export function savedStateTaken(node: LGraphNode): void {
  awaiting.delete(node)
}

export function isAwaitingSavedState(node: LGraphNode): boolean {
  return awaiting.has(node)
}
