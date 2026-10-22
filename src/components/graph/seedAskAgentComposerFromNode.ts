import { fromPartial } from '@total-typescript/shoehorn'

import { fillNodeAskAgentPrompt } from '@/components/graph/askAgentFromNode'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function seedAskAgentComposerFromNode(options: {
  id: number
  title: string
  text: string
  workflowPath?: string
  instanceId?: string
}): boolean {
  const graph = new LGraph()
  const node = new LGraphNode(options.title)
  node.id = toNodeId(options.id)
  graph.add(node)
  useCanvasStore().currentGraph = graph
  useWorkflowStore().activeWorkflow = fromPartial<LoadedComfyWorkflow>({
    path: options.workflowPath ?? 'workflows/portrait.json',
    instanceId: options.instanceId ?? 'story-workflow'
  })
  const panel = useAgentPanelStore()
  panel.enabled = true
  panel.isOpen = true
  return fillNodeAskAgentPrompt(node.id, options.text)
}
