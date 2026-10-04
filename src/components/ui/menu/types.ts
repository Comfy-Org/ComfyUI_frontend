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
  url?: string
  target?: string
  class?: string | (() => string)
  tooltip?: string
  new?: boolean
  shortcut?: string | (() => string | undefined)
}

export interface MenuItemSeparator extends MenuItemMetadata {
  separator: true
  command?: never
  items?: never
  checked?: never
}

export interface MenuItemSubmenu extends MenuItemMetadata {
  separator?: false
  items: MenuItem[]
  command?: never
  checked?: never
}

export interface MenuItemAction extends MenuItemMetadata {
  separator?: false
  items?: never
  command?: (event: MenuItemCommandEvent) => unknown
  checked?: boolean | (() => boolean)
  variant?: 'destructive'
}

export type MenuItem = MenuItemSeparator | MenuItemSubmenu | MenuItemAction
