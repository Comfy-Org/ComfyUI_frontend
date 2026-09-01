declare const graphLoadTokenBrand: unique symbol

export type GraphLoadToken = symbol & {
  readonly [graphLoadTokenBrand]: true
}

export type GraphLoadLifecycleEvent =
  | { type: 'started'; token: GraphLoadToken }
  | { type: 'settled'; token: GraphLoadToken }

const listeners = new Set<(event: GraphLoadLifecycleEvent) => void>()

export function beginGraphLoad(): GraphLoadToken {
  const token = Symbol('graph-load') as GraphLoadToken
  for (const listener of listeners) listener({ type: 'started', token })
  return token
}

export function settleGraphLoad(token: GraphLoadToken): void {
  for (const listener of listeners) listener({ type: 'settled', token })
}

/**
 * Begins a graph load and returns a disposable that settles it exactly once.
 * Bind with `using` so throws and early returns settle the load; call
 * `[Symbol.dispose]()` explicitly at the point the graph is fully configured.
 */
export function beginGraphLoadScope(): Disposable {
  const token = beginGraphLoad()
  let settled = false
  return {
    [Symbol.dispose]() {
      if (settled) return
      settled = true
      settleGraphLoad(token)
    }
  }
}

export function onGraphLoadLifecycle(
  listener: (event: GraphLoadLifecycleEvent) => void
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
