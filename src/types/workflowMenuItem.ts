import type { OverlayIconProps } from '@/components/common/OverlayIcon.vue'
import type { BadgeVariants } from '@/components/common/badge.variants'

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
  badgeSeverity?: BadgeVariants['severity']
  isNew?: boolean
  overlayIcon?: OverlayIconProps
}
