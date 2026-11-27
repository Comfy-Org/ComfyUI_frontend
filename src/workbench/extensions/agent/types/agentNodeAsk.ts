import type { SelectedNode } from '@/workbench/extensions/agent/composables/agent/useCanvasSelection'

export type NodeAskInputMethod =
  | 'selection_toolbox'
  | 'selection_toolbox_suggestion'

/** A question asked from the selection toolbox, waiting for the panel to send it to the current chat. */
export interface AgentNodeAsk {
  text: string
  nodes: SelectedNode[]
  workflowPath?: string
  workflowInstanceId?: string
  inputMethod: NodeAskInputMethod
}
