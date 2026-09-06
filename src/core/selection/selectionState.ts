export type SelectableKind = 'node' | 'group' | 'reroute' | 'io'

/** `kind:id` identity of one selectable canvas item within a graph scope. */
export type SelectableKey = string & { readonly __brand: 'SelectableKey' }

export function toSelectableKey(
  kind: SelectableKind,
  id: string | number
): SelectableKey {
  return `${kind}:${id}` as SelectableKey
}

export function parseSelectableKey(key: SelectableKey): {
  kind: SelectableKind
  id: string
} {
  const separator = key.indexOf(':')
  return {
    kind: key.slice(0, separator) as SelectableKind,
    id: key.slice(separator + 1)
  }
}

/** Insertion-ordered selection of one graph scope. */
export interface SelectionState {
  readonly order: readonly SelectableKey[]
  /** The same keys as {@link order}, for O(1) membership checks. */
  readonly members: ReadonlySet<SelectableKey>
}

export const EMPTY_SELECTION: SelectionState = {
  order: [],
  members: new Set()
}

export type SelectionCommand =
  | {
      readonly type: 'selection.replace'
      readonly keys: readonly SelectableKey[]
    }
  | { readonly type: 'selection.add'; readonly keys: readonly SelectableKey[] }
  | {
      readonly type: 'selection.remove'
      readonly keys: readonly SelectableKey[]
    }
  | { readonly type: 'selection.clear' }

export interface SelectionTransition {
  readonly state: SelectionState
  readonly status: 'applied' | 'no-op'
}

export function reduceSelection(
  state: SelectionState,
  command: SelectionCommand
): SelectionTransition {
  const order = nextOrder(state, command)
  return sameOrder(state.order, order)
    ? { state, status: 'no-op' }
    : { state: { order, members: new Set(order) }, status: 'applied' }
}

function nextOrder(
  { order, members }: SelectionState,
  command: SelectionCommand
): readonly SelectableKey[] {
  switch (command.type) {
    case 'selection.clear':
      return []
    case 'selection.replace':
      return unique(command.keys)
    case 'selection.add':
      return [...order, ...unique(command.keys, new Set(members))]
    case 'selection.remove': {
      const removed = new Set(command.keys)
      return order.filter((key) => !removed.has(key))
    }
  }
}

function unique(
  keys: readonly SelectableKey[],
  seen = new Set<SelectableKey>()
): SelectableKey[] {
  const result: SelectableKey[] = []
  for (const key of keys) {
    if (seen.has(key)) continue
    seen.add(key)
    result.push(key)
  }
  return result
}

function sameOrder(
  a: readonly SelectableKey[],
  b: readonly SelectableKey[]
): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index])
}
