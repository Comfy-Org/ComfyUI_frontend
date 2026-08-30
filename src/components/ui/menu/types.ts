import type { ComfyCommandImpl } from '@/stores/commandStore'

export interface MenuItemCommandEvent {
  originalEvent: Event
  item: MenuItem
}

export interface MenuItem {
  label?: string | (() => string)
  icon?: string
  command?: (event: MenuItemCommandEvent) => unknown
  items?: MenuItem[]
  separator?: boolean
  disabled?: boolean | (() => boolean)
  visible?: boolean | (() => boolean)
  key?: string
  url?: string
  target?: string
  class?: string | (() => string)
  tooltip?: string
  checked?: boolean
  new?: boolean
  comfyCommand?: Partial<ComfyCommandImpl>
  parentPath?: string
  isAsync?: boolean
  updateTitle?: (title: string) => void
  isBlueprint?: boolean
  shortcut?: string
  isColorSubmenu?: boolean
  isShapeSubmenu?: boolean
}
