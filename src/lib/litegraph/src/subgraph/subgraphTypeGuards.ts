import type { Subgraph } from '../LGraph'
import type { INodeInputSlot, INodeOutputSlot } from '../types/slots'
import type { SubgraphInput } from './SubgraphInput'
import type { SubgraphOutput } from './SubgraphOutput'

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
