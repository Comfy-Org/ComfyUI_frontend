import type { ILinkRouting } from '@/lib/litegraph/src/interfaces'
import type { ISlotType } from '@/lib/litegraph/src/interfaces'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

/**
 * Group node internal link format.
 * This differs from standard SerialisedLLinkArray - indices represent node/slot positions within the group.
 * Format: [sourceNodeIndex, sourceSlot, targetNodeIndex, targetSlot, ...optionalData]
 * The type (ISlotType) may be at index 5 if present.
 */
export type GroupNodeInternalLink = [
  sourceNodeIndex: number | null,
  sourceSlot: number | null,
  targetNodeIndex: number | null,
  targetSlot: number | null,
  ...rest: (number | string | ISlotType | null | undefined)[]
]

/** Serialized node data within a group node workflow, with group-specific index */
interface GroupNodeSerializedNode extends Partial<ISerialisedNode> {
  /** Position of this node within the group */
  index?: number
}

export interface GroupNodeWorkflowData {
  external: (number | string)[][]
  links: GroupNodeInternalLink[]
  nodes: GroupNodeSerializedNode[]
  config?: Record<number, unknown>
}

/**
 * Input config tuple type for group nodes.
 * First element is the input type name (e.g. 'INT', 'FLOAT', 'MODEL', etc.)
 * Second element (optional) is the input options object.
 */
export type GroupNodeInputConfig = [string, Record<string, unknown>?]

/**
 * Mutable inputs specification for group nodes that are built dynamically.
 * Uses a more permissive type than ComfyInputsSpec to allow dynamic assignment.
 */
export interface GroupNodeInputsSpec {
  required: Record<string, GroupNodeInputConfig>
  optional?: Record<string, GroupNodeInputConfig>
}

/**
 * Output type for group nodes - can be a type string or an array of combo options.
 */
export type GroupNodeOutputType = string | (string | number)[]

/**
 * Represents a partial or synthetic link used internally by group node's
 * `getInputLink` override when resolving connections through collapsed group nodes.
 *
 * Unlike a full `ILinkRouting`, this represents a computed/virtual link that may not
 * correspond to an actual link in the graph's link registry. It's constructed on-the-fly
 * to represent the logical connection path through group node boundaries.
 *
 * This type aliases `ILinkRouting` (rather than narrowing it) because the consuming code
 * expects the same shape for both real and synthetic links. The distinction is purely
 * semantic: callers should be aware that these links are transient and may not have
 * valid `link_id` references in the global link map.
 */
export interface PartialLinkInfo extends ILinkRouting {}
