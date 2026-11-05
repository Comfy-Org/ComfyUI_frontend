import { z } from 'zod'

import type { GroupId } from '@comfyorg/graph-model/groupId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { RerouteId } from '@comfyorg/graph-model/rerouteId'

const selectableKindSchema = z.enum(['node', 'group', 'reroute', 'io'])
export type SelectableKind = z.infer<typeof selectableKindSchema>

/** `kind:id` identity of one selectable canvas item within a graph scope. */
export type SelectableKey = `${SelectableKind}:${string}` & {
  readonly __brand: 'SelectableKey'
}

export function toSelectableKey(
  ...[kind, id]:
    | [kind: 'node' | 'io', id: NodeId]
    | [kind: 'group', id: GroupId]
    | [kind: 'reroute', id: RerouteId]
): SelectableKey {
  return `${kind}:${id}` as SelectableKey
}

export function parseSelectableKey(key: SelectableKey): {
  kind: SelectableKind
  id: string
} {
  const [kind, id] = key.split(/:(.*)/s, 2)
  return { kind: selectableKindSchema.parse(kind), id }
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
