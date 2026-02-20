import type { ComponentProps } from 'vue-component-type-helpers'

import type { OverlayIconProps } from '@/components/common/OverlayIcon.vue'
import type BadgePill from '@/components/common/BadgePill.vue'

type BadgePillProps = ComponentProps<typeof BadgePill>

export type WorkflowMenuItem = WorkflowMenuSeparator | WorkflowMenuAction

interface WorkflowMenuSeparator {
  separator: true
}

export interface WorkflowMenuAction {
  separator?: false
  label: string
  icon?: string
  command?: () => void
  disabled?: boolean
  badge?: BadgePillProps
  overlayIcon?: OverlayIconProps
}
