import type { ComfyCommandImpl } from '@/stores/commandStore'

export interface MenuItemCommandEvent {
  originalEvent: Event
  item: MenuItem
}

interface MenuItemMetadata {
  label?: string | (() => string)
  icon?: string
  disabled?: boolean | (() => boolean)
  visible?: boolean | (() => boolean)
  key?: string
  url?: string
  target?: string
  class?: string | (() => string)
  tooltip?: string
  new?: boolean
  comfyCommand?: Partial<ComfyCommandImpl>
  parentPath?: string
  isAsync?: boolean
  updateTitle?: (title: string) => void
  isBlueprint?: boolean
  shortcut?: string
  color?: string
  isShapeSubmenuItem?: boolean
}

interface MenuItemSeparator extends MenuItemMetadata {
  separator: true
  command?: never
  items?: never
  checked?: never
}

interface MenuItemSubmenu extends MenuItemMetadata {
  separator?: false
  items: MenuItem[]
  command?: never
  checked?: never
}

export interface MenuItemAction extends MenuItemMetadata {
  separator?: false
  items?: never
  command?: (event: MenuItemCommandEvent) => unknown
  checked?: boolean
}

export type MenuItem = MenuItemSeparator | MenuItemSubmenu | MenuItemAction
