import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@comfyorg/graph-model/slots'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import type {
  InputSlotHandle,
  OutputSlotHandle,
  SlotSide
} from '@/platform/nodeApi/v4/types'

export interface SlotPlace {
  readonly graph: LGraph
  readonly node: LGraphNode
  readonly index: number
}

/** A slot as it is now: its graph, its node, its side and where it sits. */
export type LiveSlot = SlotPlace &
  (
    | { readonly side: 'input'; readonly slot: INodeInputSlot }
    | { readonly side: 'output'; readonly slot: INodeOutputSlot }
  )

/** Finds a handle's slot in its own node, graph and document while it is there. */
interface SlotLocator {
  readonly side: SlotSide
  locate(): LiveSlot | undefined
}

export interface SlotHandles {
  /** The one handle for an input of `node` in `graph`. */
  inputHandle(
    graph: LGraph,
    node: LGraphNode,
    slot: INodeInputSlot
  ): InputSlotHandle
  /** The one handle for an output of `node` in `graph`. */
  outputHandle(
    graph: LGraph,
    node: LGraphNode,
    slot: INodeOutputSlot
  ): OutputSlotHandle
  /** For a slot handle made here, its locator; `undefined` for anything else. */
  locator(value: unknown): SlotLocator | undefined
}
