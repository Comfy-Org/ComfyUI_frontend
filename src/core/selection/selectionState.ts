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

export type SelectionCommand =
  | {
      readonly type: 'selection.replace'
      readonly keys: readonly SelectableKey[]
    }
  | { readonly type: 'selection.add'; readonly key: SelectableKey }
  | {
      readonly type: 'selection.remove'
      readonly key: SelectableKey
    }
  | { readonly type: 'selection.clear' }
