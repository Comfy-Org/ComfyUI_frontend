export interface MenuOption {
  label?: string
  icon?: string
  shortcut?: string
  hasSubmenu?: boolean
  type?: 'divider' | 'category'
  action?: () => void
  submenu?: SubMenuItem[]
  badge?: BadgeVariant
  disabled?: boolean
  source?: 'litegraph' | 'vue'
  isColorPicker?: boolean
  isShapePicker?: boolean
}

export interface SubMenuOption {
  label: string
  icon?: string
  action: () => void
  color?: string
  disabled?: boolean
}

interface SubMenuDivider {
  type: 'divider'
}

type SubMenuItem = SubMenuOption | SubMenuDivider

export const isSubMenuOption = (item: SubMenuItem): item is SubMenuOption =>
  !('type' in item)

export enum BadgeVariant {
  NEW = 'new'
}
