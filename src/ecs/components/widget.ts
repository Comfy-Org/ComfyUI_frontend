/**
 * Widget components.
 *
 * Widget value extraction is already complete (WidgetValueStore).
 * These interfaces formalize the target shape and add the layout
 * component that remains on the BaseWidget class.
 *
 * The 23+ widget subclasses (NumberWidget, ComboWidget, etc.) become
 * configuration data here. Widget-type-specific rendering behavior
 * will live in the RenderSystem.
 */

import type {
  IWidgetOptions,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'

import type { NodeEntityId } from '../entityId'

/** Immutable identity of a widget within its parent node. */
export interface WidgetIdentity {
  /** Widget name (unique within a node). */
  name: string
  /**
   * Widget type string (e.g., 'number', 'combo', 'toggle', 'text').
   * Determines which system handles rendering and interaction.
   */
  widgetType: string
  /** The node that owns this widget. */
  parentNodeId: NodeEntityId
}

/**
 * Widget value and configuration.
 *
 * Structurally equivalent to the existing WidgetState in
 * WidgetValueStore — the bridge layer can share the same objects.
 */
export interface WidgetValue {
  /** Current value (type depends on widgetType). */
  value: TWidgetValue
  /** Configuration options (min, max, step, values, etc.). */
  options: IWidgetOptions
  /** Display label override. */
  label?: string
  /** Whether the widget is disabled. */
  disabled?: boolean
  /** Whether to include this widget's value in serialized workflow JSON. */
  serialize?: boolean
}

/**
 * Layout metrics computed during the arrange phase.
 *
 * Currently lives as mutable properties on BaseWidget (y,
 * computedHeight, width). The LayoutSystem will own these writes;
 * the RenderSystem reads them.
 */
export interface WidgetLayout {
  /** Vertical position relative to the node body. */
  y: number
  /** Computed height after layout distribution. */
  computedHeight: number
  /** Width override (undefined = use node width). */
  width?: number
  /** Layout size constraints from computeLayoutSize(). */
  constraints?: WidgetLayoutConstraints
}

export interface WidgetLayoutConstraints {
  minHeight: number
  maxHeight?: number
  minWidth?: number
  maxWidth?: number
}
