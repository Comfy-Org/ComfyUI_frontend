import type { NodeMenuItemId } from '@/lib/litegraph/src/types/nodeMenu'

export interface MenuOption {
  id?: NodeMenuItemId
  label?: string
  icon?: string
  shortcut?: string
  hasSubmenu?: boolean
  type?: 'divider' | 'category'
  action?: () => void
  submenu?: SubMenuOption[]
  badge?: BadgeVariant
  disabled?: boolean
  isColorPicker?: boolean
  isShapePicker?: boolean
}

interface SubMenuOption {
  label: string
  icon?: string
  action: () => void
  color?: string
  disabled?: boolean
}

export enum BadgeVariant {
  NEW = 'new'
}
