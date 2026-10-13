import type { LGraphNode } from '../LGraphNode'
import type { IContextMenuValue } from './contextMenu'
import type { TWidgetValue } from './widgets'

/**
 * Callback for panel widget value changes.
 */
export type PanelWidgetCallback = (
  name: string | undefined,
  value: TWidgetValue,
  options: PanelWidgetOptions
) => void

/**
 * Options for panel widgets.
 */
export interface PanelWidgetOptions {
  label?: string
  type?: string
  widget?: string
  values?:
    | Array<string | IContextMenuValue | null>
    | Record<string, TWidgetValue>
  callback?: PanelWidgetCallback
}

/**
 * A button element with optional options property.
 */
export interface PanelButton extends HTMLButtonElement {
  options?: unknown
}

/**
 * A widget element with options and value properties.
 */
export interface PanelWidget extends HTMLDivElement {
  options?: PanelWidgetOptions
  value?: TWidgetValue
}

/**
 * A dialog panel created by LGraphCanvas.createPanel().
 * Extends HTMLDivElement with additional properties and methods for panel management.
 */
export interface Panel extends HTMLDivElement {
  header: HTMLElement
  title_element: HTMLSpanElement
  content: HTMLDivElement
  alt_content: HTMLDivElement
  footer: HTMLDivElement
  node?: LGraphNode
  onOpen?: () => void
  onClose?: () => void
  close(): void
  toggleAltContent(force?: boolean): void
  toggleFooterVisibility(force?: boolean): void
  clear(): void
  addHTML(code: string, classname?: string, on_footer?: boolean): HTMLDivElement
  addButton(name: string, callback: () => void, options?: unknown): PanelButton
  addSeparator(): void
  addWidget(
    type: string,
    name: string,
    value: TWidgetValue,
    options?: PanelWidgetOptions,
    callback?: PanelWidgetCallback
  ): PanelWidget
  inner_showCodePad?(property: string): void
}
