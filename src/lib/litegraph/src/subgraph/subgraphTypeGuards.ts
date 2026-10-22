import type {
  Subgraph,
  SubgraphInput,
  SubgraphOutput
} from '@/lib/litegraph/src/types/entityRegistry'

import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/types/slots'

export let isSubgraph: (value: unknown) => value is Subgraph
export let isSubgraphInput: (slot: unknown) => slot is SubgraphInput
export let isSubgraphOutput: (slot: unknown) => slot is SubgraphOutput

export function provideSubgraphGuard(guard: typeof isSubgraph): void {
  isSubgraph = guard
}

export function provideSubgraphInputGuard(guard: typeof isSubgraphInput): void {
  isSubgraphInput = guard
}

export function provideSubgraphOutputGuard(
  guard: typeof isSubgraphOutput
): void {
  isSubgraphOutput = guard
}

export function isNodeSlot(
  slot: unknown
): slot is INodeInputSlot | INodeOutputSlot {
  return (
    slot != null &&
    typeof slot === 'object' &&
    ('link' in slot || 'links' in slot)
  )
}
