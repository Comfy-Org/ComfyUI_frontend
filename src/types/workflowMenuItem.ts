import type { MenuItemAction } from '@/components/ui/menu/types'

export type WorkflowMenuItem = WorkflowMenuSeparator | WorkflowMenuAction

interface WorkflowMenuSeparator {
  separator: true
}

export interface WorkflowMenuAction extends Omit<
  MenuItemAction,
  'command' | 'key'
> {
  separator?: false
  visible?: boolean
  id: string
  command?: () => void
  isNew?: boolean
}
