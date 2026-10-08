import type { ContextMenu } from '../ContextMenu'
import type { LGraphNode } from '../LGraphNode'
import type { IFoundSlot } from './slots'

interface IContextMenuBase {
  title?: string
  className?: string
}

export interface IContextMenuOptions<
  TValue = unknown,
  TExtra = unknown
> extends IContextMenuBase {
  ignore_item_callbacks?: boolean
  parentMenu?: ContextMenu<TValue>
  event?: MouseEvent
  extra?: TExtra
  /** @deprecated Context menu scrolling is now controlled by the browser */
  scroll_speed?: number
  left?: number
  top?: number
  /** @deprecated Context menus no longer scale using transform */
  scale?: number
  node?: LGraphNode
  autoopen?: boolean
  callback?(
    value?: string | IContextMenuValue<TValue>,
    options?: unknown,
    event?: MouseEvent,
    previous_menu?: ContextMenu<TValue>,
    extra?: unknown
  ): void | boolean | Promise<void | boolean>
}

export interface IContextMenuValue<
  TValue = unknown,
  TExtra = unknown,
  TCallbackValue = unknown
> extends IContextMenuBase {
  value?: TValue
  content: string | undefined
  has_submenu?: boolean
  disabled?: boolean
  submenu?: IContextMenuSubmenu<TValue>
  property?: string
  type?: string
  slot?: IFoundSlot
  callback?(
    this: ContextMenuDivElement<TValue>,
    value?: TCallbackValue,
    options?: unknown,
    event?: MouseEvent,
    previous_menu?: ContextMenu<TValue>,
    extra?: TExtra
  ): void | boolean | Promise<void | boolean>
}

interface IContextMenuSubmenu<
  TValue = unknown
> extends IContextMenuOptions<TValue> {
  options: ConstructorParameters<typeof ContextMenu<TValue>>[0]
}

export interface ContextMenuDivElement<
  TValue = unknown
> extends HTMLDivElement {
  value?: string | IContextMenuValue<TValue>
  onclick_callback?: never
}
