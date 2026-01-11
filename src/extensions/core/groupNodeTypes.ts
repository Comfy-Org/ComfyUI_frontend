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
 * Partial link info used internally by group node getInputLink override.
 * Extends ILinkRouting to be compatible with the base getInputLink return type.
 */
export interface PartialLinkInfo extends ILinkRouting {}
