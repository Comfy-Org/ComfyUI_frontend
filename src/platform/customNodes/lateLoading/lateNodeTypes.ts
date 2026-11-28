import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export const graphsAwaitingNodeTypes = new WeakSet<LGraph>()

/** Flag every open workflow's graph, except `except`, for reconfiguration on its next activation so newly registered node types reach it. */
export function markOpenGraphsAwaitingNodeTypes({
  except
}: { except?: LGraph } = {}): void {
  for (const workflow of useWorkflowStore().openWorkflows) {
    if (workflow.graph && workflow.graph !== except)
      graphsAwaitingNodeTypes.add(workflow.graph)
  }
}

/** Whether late custom node packs may still register node types, so a type missing now is not missing yet. */
export function nodeTypesMayStillArrive(): boolean {
  return useExtensionStore().areLateCustomNodesPending
}
