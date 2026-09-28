export interface MenuOption {
  label?: string
  icon?: string
  shortcut?: string
  hasSubmenu?: boolean
  type?: 'divider' | 'category'
  action?: () => void
  submenu?: SubMenuOption[]
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

export enum BadgeVariant {
  NEW = 'new'
}
