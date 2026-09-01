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

export function onGraphLoadLifecycle(
  listener: (event: GraphLoadLifecycleEvent) => void
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
