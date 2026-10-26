/**
 * Node-specific components.
 *
 * These decompose the ~4,300-line LGraphNode class into focused data
 * objects. Each component captures one concern; systems provide behavior.
 *
 * Reuses existing types from litegraph where possible to ease migration.
 */

import type { Dictionary, INodeFlags } from '@/lib/litegraph/src/interfaces'
import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import type {
  LGraphEventMode,
  RenderShape
} from '@/lib/litegraph/src/types/globalEnums'

import type { SlotEntityId, WidgetEntityId } from '../entityId'

/** Static identity and classification of a node. */
export interface NodeType {
  /** Registered node type string (e.g., 'KSampler', 'CLIPTextEncode'). */
  type: string
  /** Display title. */
  title: string
  /** Category path for the node menu (e.g., 'sampling'). */
  category?: string
  /** Backend node definition data, if resolved. */
  nodeData?: unknown
  /** Optional description shown in tooltips/docs. */
  description?: string
}

/** Visual / rendering properties of a node. */
export interface NodeVisual {
  color?: string
  bgcolor?: string
  boxcolor?: string
  shape?: RenderShape
}

/**
 * Connectivity — references to this node's slot entities.
 *
 * Replaces the `inputs[]` and `outputs[]` arrays on LGraphNode.
 * Actual slot data lives on SlotIdentity / SlotConnection components
 * keyed by SlotEntityId.
 */
export interface Connectivity {
  inputSlotIds: readonly SlotEntityId[]
  outputSlotIds: readonly SlotEntityId[]
}

/** Execution scheduling state. */
export interface Execution {
  /** Computed execution order (topological sort index). */
  order: number
  /** How this node participates in execution. */
  mode: LGraphEventMode
  /** Behavioral flags (pinned, collapsed, ghost, etc.). */
  flags: INodeFlags
}

/** User-defined key-value properties on a node. */
export interface Properties {
  properties: Dictionary<NodeProperty | undefined>
  propertiesInfo: readonly PropertyInfo[]
}

export interface PropertyInfo {
  name?: string
  type?: string
  default_value?: NodeProperty
  widget?: string
  label?: string
  values?: unknown[]
}

/**
 * Container for widget entities owned by this node.
 *
 * Replaces the `widgets[]` array on LGraphNode.
 * Actual widget data lives on WidgetIdentity / WidgetValue components
 * keyed by WidgetEntityId.
 */
export interface WidgetContainer {
  widgetIds: readonly WidgetEntityId[]
}
