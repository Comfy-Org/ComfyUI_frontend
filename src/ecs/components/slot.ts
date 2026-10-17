/**
 * Slot components.
 *
 * Slots currently lack independent IDs — they're identified by their
 * index on a parent node's inputs/outputs array. The ECS assigns each
 * slot a synthetic SlotEntityId, making them first-class entities.
 *
 * Decomposes SlotBase / INodeInputSlot / INodeOutputSlot into identity,
 * connection topology, and visual state.
 */

import type {
  CanvasColour,
  ISlotType,
  Point
} from '@/lib/litegraph/src/interfaces'
import type {
  LinkDirection,
  RenderShape
} from '@/lib/litegraph/src/types/globalEnums'

import type { LinkEntityId, NodeEntityId } from '../entityId'

/** Immutable identity of a slot. */
export interface SlotIdentity {
  /** Display name (e.g., 'model', 'positive'). */
  name: string
  /** Localized display name, if available. */
  localizedName?: string
  /** Optional label override. */
  label?: string
  /** Data type accepted/produced by this slot. */
  type: ISlotType
  /** Whether this is an input or output slot. */
  direction: 'input' | 'output'
  /** The node that owns this slot. */
  parentNodeId: NodeEntityId
  /** Position index on the parent node (0-based). */
  index: number
}

/**
 * Connection state of a slot.
 *
 * Input slots have at most one link. Output slots can have many.
 */
export interface SlotConnection {
  /**
   * For input slots: the single connected link, or null.
   * For output slots: all connected links.
   */
  linkIds: readonly LinkEntityId[]
  /** Widget locator, if this slot backs a promoted widget. */
  widgetLocator?: SlotWidgetLocator
}

export interface SlotWidgetLocator {
  name: string
  nodeId: NodeEntityId
}

/** Visual / rendering properties of a slot. */
export interface SlotVisual {
  /** Computed position relative to the node. */
  pos?: Point
  /** Bounding rectangle for hit testing. */
  boundingRect: readonly [x: number, y: number, w: number, h: number]
  /** Color when connected. */
  colorOn?: CanvasColour
  /** Color when disconnected. */
  colorOff?: CanvasColour
  /** Render shape (circle, arrow, grid, etc.). */
  shape?: RenderShape
  /** Flow direction for link rendering. */
  dir?: LinkDirection
}
