/**
 * Event interfaces for event extension
 */

/** For Canvas*Event - adds graph space co-ordinates (property names are shipped) */
export interface ICanvasPosition {
    /** X co-ordinate of the event, in graph space (NOT canvas space) */
    canvasX?: number
    /** Y co-ordinate of the event, in graph space (NOT canvas space) */
    canvasY?: number
}

/** For Canvas*Event */
export interface IDeltaPosition {
    deltaX?: number
    deltaY?: number
}

/** PointerEvent with canvasX/Y and deltaX/Y properties */
export interface CanvasPointerEvent extends PointerEvent, CanvasMouseEvent { }

/** MouseEvent with canvasX/Y and deltaX/Y properties */
export interface CanvasMouseEvent extends MouseEvent, ICanvasPosition, IDeltaPosition {
    dragging?: boolean
    click_time?: number
    dataTransfer?: unknown
}

/** WheelEvent with canvasX/Y properties */
export interface CanvasWheelEvent extends WheelEvent, ICanvasPosition {
    dragging?: boolean
    click_time?: number
    dataTransfer?: unknown
}

/** DragEvent with canvasX/Y and deltaX/Y properties */
export interface CanvasDragEvent extends DragEvent, ICanvasPosition, IDeltaPosition { }

/** TouchEvent with canvasX/Y and deltaX/Y properties */
export interface CanvasTouchEvent extends TouchEvent, ICanvasPosition, IDeltaPosition { }
