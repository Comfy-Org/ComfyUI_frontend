/**
 * Event interfaces for event extension
 */

import type { ConnectingLink, LinkReleaseContextExtended } from "../litegraph"
import type { IWidget } from "./widgets"
import type { LGraphNode } from "../LGraphNode"
import type { LGraphGroup } from "../LGraphGroup"

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

interface LegacyMouseEvent {
  /** @deprecated Part of DragAndScale mouse API - incomplete / not maintained */
  dragging?: boolean
  click_time?: number
}

/** PointerEvent with canvasX/Y and deltaX/Y properties */
export interface CanvasPointerEvent extends PointerEvent, CanvasMouseEvent {}

/** MouseEvent with canvasX/Y and deltaX/Y properties */
export interface CanvasMouseEvent extends
  MouseEvent,
  Readonly<ICanvasPosition>,
  Readonly<IDeltaPosition>,
  LegacyMouseEvent {}

/** DragEvent with canvasX/Y and deltaX/Y properties */
export interface CanvasDragEvent extends
  DragEvent,
  ICanvasPosition,
  IDeltaPosition {}

export type CanvasEventDetail =
  | GenericEventDetail
  | DragggingCanvasEventDetail
  | ReadOnlyEventDetail
  | GroupDoubleClickEventDetail
  | EmptyDoubleClickEventDetail
  | ConnectingWidgetLinkEventDetail
  | EmptyReleaseEventDetail

export interface GenericEventDetail {
  subType: "before-change" | "after-change"
}

export interface OriginalEvent {
  originalEvent: CanvasPointerEvent
}

export interface EmptyReleaseEventDetail extends OriginalEvent {
  subType: "empty-release"
  linkReleaseContext: LinkReleaseContextExtended
}

export interface ConnectingWidgetLinkEventDetail {
  subType: "connectingWidgetLink"
  link: ConnectingLink
  node: LGraphNode
  widget: IWidget
}

export interface EmptyDoubleClickEventDetail extends OriginalEvent {
  subType: "empty-double-click"
}

export interface GroupDoubleClickEventDetail extends OriginalEvent {
  subType: "group-double-click"
  group: LGraphGroup
}

export interface DragggingCanvasEventDetail {
  subType: "dragging-canvas"
  draggingCanvas: boolean
}

export interface ReadOnlyEventDetail {
  subType: "read-only"
  readOnly: boolean
}
