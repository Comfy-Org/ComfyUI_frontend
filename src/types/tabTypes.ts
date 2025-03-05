import { ComfyWorkflow } from '@/stores/workflowStore'

export interface BaseTabItem {
  /** Unique identifier for the tab */
  id: string
  /** Display label for the tab */
  label: string
  /** Icon to display (for menu panes) */
  icon?: string
  /** Type of tab */
  type: 'workflow' | 'menuPane'
}

export interface WorkflowTabItem extends BaseTabItem {
  type: 'workflow'
  /** Reference to the workflow object */
  workflow: ComfyWorkflow
}

export interface MenuPaneTabItem extends BaseTabItem {
  type: 'menuPane'
  /** Reference to the menu pane ID */
  menuPaneId: string
}

export function isWorkflowTab(tab: BaseTabItem): tab is WorkflowTabItem {
  return tab.type === 'workflow'
}

export function isMenuPaneTab(tab: BaseTabItem): tab is MenuPaneTabItem {
  return tab.type === 'menuPane'
}
