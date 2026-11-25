const awaiting = new WeakSet<object>()

/** Marks a node a load added before its saved state; `LGraphNode.configure` ends the mark as it applies that state. */
export function markAwaitingSavedState(node: object): void {
  awaiting.add(node)
}

export function savedStateApplied(node: object): void {
  awaiting.delete(node)
}

export function isAwaitingSavedState(node: object): boolean {
  return awaiting.has(node)
}
