import type { OverlayIconProps } from '@/components/common/OverlayIcon.vue'

export interface MenuItemCommandEvent {
  originalEvent: Event
  item: MenuItem
}

interface MenuItemMetadata {
  label?: string | (() => string)
  description?: string | (() => string)
  icon?: string
  disabled?: boolean | (() => boolean)
  visible?: boolean | (() => boolean)
  key?: string
  class?: string | (() => string)
  tooltip?: string
  new?: boolean
  shortcut?: string | (() => string | undefined)
  badge?: string
  overlayIcon?: OverlayIconProps
  trailingIcon?: string
  presentation?: 'switch'
}

export interface MenuItemSeparator extends MenuItemMetadata {
  separator: true
  command?: never
  items?: never
  checked?: never
  radioGroup?: never
}

export interface MenuItemSubmenu extends MenuItemMetadata {
  separator?: false
  items: MenuItem[]
  command?: never
  checked?: never
  radioGroup?: never
}

export interface MenuItemRadioGroup extends MenuItemMetadata {
  separator?: false
  items?: never
  command?: never
  checked?: never
  radioGroup: {
    value: string | (() => string)
    options: {
      value: string
      label: string
      icon?: string
      command: () => unknown
    }[]
  }
}

export interface MenuItemAction extends MenuItemMetadata {
  separator?: false
  items?: never
  radioGroup?: never
  command?: (event: MenuItemCommandEvent) => unknown
  checked?: boolean | (() => boolean)
  pressAndHoldInterval?: number
  variant?: 'destructive'
}

export type MenuItem =
  | MenuItemSeparator
  | MenuItemSubmenu
  | MenuItemRadioGroup
  | MenuItemAction
