import type { OverlayIconProps } from '@/components/common/OverlayIcon.vue'

interface WorkflowMenuSeparator {
  separator: true
}

export type WorkflowMenuItem = WorkflowMenuSeparator | WorkflowMenuAction

export interface WorkflowMenuAction {
  separator?: false
  visible?: boolean
  id: string
  label: string
  icon?: string
  command?: () => void
  disabled?: boolean
  badge?: string
  isNew?: boolean
  overlayIcon?: OverlayIconProps
}
