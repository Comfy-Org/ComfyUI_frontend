import type { OverlayIconProps } from '@/components/common/OverlayIcon.vue'

export type WorkflowMenuItem = WorkflowMenuSeparator | WorkflowMenuAction

interface WorkflowMenuSeparator {
  separator: true
}

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
