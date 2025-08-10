/**
 * Event interfaces for event extension
 */
import type { LGraphGroup } from '../LGraphGroup'
import type { LGraphNode } from '../LGraphNode'
import type { LinkReleaseContextExtended } from '../litegraph'

/** For Canvas*Event - adds graph space co-ordinates (property names are shipped) */
export interface ICanvasPosition {
  /** X co-ordinate of the event, in graph space (NOT canvas space) */
  canvasX: number
  /** Y co-ordinate of the event, in graph space (NOT canvas space) */
  canvasY: number
}

/** For Canvas*Event */
export interface IDeltaPosition {
  deltaX: number
  deltaY: number
}

/**
 * Workaround for Firefox returning 0 on offsetX/Y props
 * See https://github.com/Comfy-Org/litegraph.js/issues/403 for details
 */
export interface IOffsetWorkaround {
  /** See {@link MouseEvent.offsetX}.  This workaround is required (2024-12-31) to support Firefox, which always returns 0 */
  safeOffsetX: number
  /** See {@link MouseEvent.offsetY}.  This workaround is required (2024-12-31) to support Firefox, which always returns 0 */
  safeOffsetY: number
}

/** All properties added when converting a pointer event to a CanvasPointerEvent (via {@link LGraphCanvas.adjustMouseEvent}). */
export type CanvasPointerExtensions = ICanvasPosition &
  IDeltaPosition &
  IOffsetWorkaround

interface LegacyMouseEvent {
  /** @deprecated Part of DragAndScale mouse API - incomplete / not maintained */
  dragging?: boolean
  click_time?: number
}

/** PointerEvent with canvasX/Y and deltaX/Y properties */
export interface CanvasPointerEvent extends PointerEvent, CanvasMouseEvent {}

/** MouseEvent with canvasX/Y and deltaX/Y properties */
export interface CanvasMouseEvent
  extends MouseEvent,
    Readonly<CanvasPointerExtensions>,
    LegacyMouseEvent {}

/** DragEvent with canvasX/Y and deltaX/Y properties */
export interface CanvasDragEvent extends DragEvent, CanvasPointerExtensions {}

export type CanvasEventDetail =
  | GenericEventDetail
  | GroupDoubleClickEventDetail
  | NodeDoubleClickEventDetail
  | EmptyDoubleClickEventDetail
  | EmptyReleaseEventDetail

export interface GenericEventDetail {
  subType: 'before-change' | 'after-change'
}

export interface OriginalEvent {
  originalEvent: CanvasPointerEvent
}

export interface EmptyReleaseEventDetail extends OriginalEvent {
  subType: 'empty-release'
  linkReleaseContext: LinkReleaseContextExtended
}

export interface EmptyDoubleClickEventDetail extends OriginalEvent {
  subType: 'empty-double-click'
}

export interface GroupDoubleClickEventDetail extends OriginalEvent {
  subType: 'group-double-click'
  group: LGraphGroup
}

export interface NodeDoubleClickEventDetail extends OriginalEvent {
  subType: 'node-double-click'
  node: LGraphNode
}
