import type { SerialisedLLinkArray } from '@/lib/litegraph/src/LLink'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

/** Serialized node data within a group node workflow, with group-specific index */
export interface GroupNodeSerializedNode extends Partial<ISerialisedNode> {
  /** Position of this node within the group */
  index?: number
}

export interface GroupNodeWorkflowData {
  external: (number | string)[][]
  links: SerialisedLLinkArray[]
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
 * Contains only the properties needed for group node execution context.
 */
export interface PartialLinkInfo {
  origin_id: string | number
  origin_slot: number | string
  target_id: string | number
  target_slot: number
}
