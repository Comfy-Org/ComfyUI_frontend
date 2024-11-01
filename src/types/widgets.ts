import { CanvasColour, Point, Size } from "@/interfaces"
import type { LGraphCanvas, LGraphNode } from "@/litegraph"
import type { CanvasMouseEvent } from "./events"

export interface IWidgetOptions<TValue = unknown> extends Record<string, unknown> {
    on?: string
    off?: string
    max?: number
    min?: number
    slider_color?: CanvasColour
    marker_color?: CanvasColour
    precision?: number
    read_only?: boolean
    step?: number
    y?: number
    multiline?: boolean
    // TODO: Confirm this
    property?: string

    hasOwnProperty?(arg0: string): any
    // values?(widget?: IWidget, node?: LGraphNode): any
    values?: TValue[]
    callback?: IWidget["callback"]

    onHide?(widget: IWidget): void
}

/**
 * A widget for a node.
 * @typescript
 * All types are based on IBaseWidget - additions can be made there or directly on individual types.
 *
 * Implemented as a discriminative union of widget types, so this type itself cannot be extended.
 * Recommend declaration merging any properties that use IWidget (e.g. {@link LGraphNode.widgets}) with a new type alias.
 * @see ICustomWidget
 */
export type IWidget = IBooleanWidget | INumericWidget | IStringWidget | IMultilineStringWidget | IComboWidget | ICustomWidget

export interface IBooleanWidget extends IBaseWidget {
    type?: "toggle"
    value: boolean
}

/** Any widget that uses a numeric backing */
export interface INumericWidget extends IBaseWidget {
    type?: "slider" | "number"
    value: number
}

/** A combo-box widget (dropdown, select, etc) */
export interface IComboWidget extends IBaseWidget {
    type?: "combo"
    value: string | number
    options: IWidgetOptions<string>
}

export type IStringWidgetType = IStringWidget["type"] | IMultilineStringWidget["type"]

/** A widget with a string value */
export interface IStringWidget extends IBaseWidget {
    type?: "string" | "text" | "button"
    value: string
}

/** A widget with a string value and a multiline text input */
export interface IMultilineStringWidget<TElement extends HTMLElement = HTMLTextAreaElement> extends IBaseWidget {
    type?: "multiline"
    value: string

    /** HTML textarea element  */
    element?: TElement
}

/** A custom widget - accepts any value and has no built-in special handling */
export interface ICustomWidget<TElement extends HTMLElement = HTMLElement> extends IBaseWidget<TElement> {
    type?: "custom"
    value: string | object

    element?: TElement
}


/**
 * Valid widget types.  TS cannot provide easily extensible type safety for this at present.
 * Override linkedWidgets[]
 * Values not in this list will not result in litegraph errors, however they will be treated the same as "custom".
 */
export type TWidgetType = IWidget["type"]
export type TWidgetValue = IWidget["value"]

/**
 * The base type for all widgets.  Should not be implemented directly.
 * @see IWidget
 */
export interface IBaseWidget<TElement extends HTMLElement = HTMLElement> {
    linkedWidgets?: IWidget[]

    options: IWidgetOptions
    marker?: number
    label?: string
    clicked?: boolean
    name?: string
    /** Widget type (see {@link TWidgetType}) */
    type?: TWidgetType
    value?: TWidgetValue
    y?: number
    last_y?: number
    width?: number
    disabled?: boolean
    
    hidden?: boolean
    advanced?: boolean

    tooltip?: string

    /** HTML widget element  */
    element?: TElement

    // TODO: Confirm this format
    callback?(value: any, canvas?: LGraphCanvas, node?: LGraphNode, pos?: Point, e?: CanvasMouseEvent): void
    onRemove?(): void
    beforeQueued?(): void

    mouse?(event: CanvasMouseEvent, arg1: number[], node: LGraphNode): boolean
    draw?(ctx: CanvasRenderingContext2D, node: LGraphNode, widget_width: number, y: number, H: number): void
    computeSize?(width: number): Size
}
