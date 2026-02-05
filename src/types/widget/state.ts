/**
 * Widget state types for stores and DOM overlays.
 *
 * @module widget/state
 */

import type { WidgetIdentity } from './identity'

export interface WidgetRuntimeState extends WidgetIdentity {
  value: unknown
  hidden: boolean
  disabled: boolean
  label?: string
  advanced?: boolean
  promoted?: boolean
}

export interface WidgetLayoutState extends WidgetIdentity {
  visible: boolean
  x: number
  y: number
  w: number
  h: number
  hideOnZoom?: boolean
}
