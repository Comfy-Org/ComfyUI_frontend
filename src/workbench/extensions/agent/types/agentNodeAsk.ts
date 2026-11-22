import type { SelectedNode } from '@/workbench/extensions/agent/composables/agent/useCanvasSelection'

/** A question asked from the selection toolbox, waiting for the panel to send it to the current chat. */
export interface AgentNodeAsk {
  text: string
  nodes: SelectedNode[]
  workflowPath?: string
}
