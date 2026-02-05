/**
 * Widget state types for stores and DOM overlays.
 *
 * @module widget/state
 */

import type { MutableWidgetIdentity, WidgetIdentity } from './identity'

/**
 * Runtime state for widgets, with mutable identity for late binding.
 * Use this in stores where nodeId may be set after construction.
 */
export interface WidgetRuntimeState extends MutableWidgetIdentity {
  value: unknown
  hidden: boolean
  disabled: boolean
  label?: string
  advanced?: boolean
  promoted?: boolean
}

/**
 * Layout state for DOM widgets positioned on the canvas.
 *
 * Note: Currently not used by domWidgetStore, which uses its own DomWidgetState
 * interface that extends PositionConfig (pos/size arrays) plus BaseDOMWidget ref.
 * This interface is provided for future use or alternative implementations.
 */
export interface WidgetLayoutState extends WidgetIdentity {
  visible: boolean
  x: number
  y: number
  w: number
  h: number
  zIndex: number
  active: boolean
}
