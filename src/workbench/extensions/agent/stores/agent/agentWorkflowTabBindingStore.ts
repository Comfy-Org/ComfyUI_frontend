import { defineStore } from 'pinia'
import { reactive } from 'vue'

/**
 * 1:1 association between a server-minted agent workflow_id and the canvas tab
 * (ComfyWorkflow.path) it renders into. Sends resolve the active tab to its
 * workflow_id; draft patches resolve their workflow_id back to the tab so
 * sequential agent edits land in ONE tab instead of minting a new tab per patch.
 */
export const useAgentWorkflowTabBindingStore = defineStore(
  'agentWorkflowTabBinding',
  () => {
    const tabByWorkflow = reactive(new Map<string, string>())

    function bind(workflowId: string, tabPath: string): void {
      for (const [boundId, boundPath] of tabByWorkflow) {
        if (boundPath === tabPath) tabByWorkflow.delete(boundId)
      }
      tabByWorkflow.set(workflowId, tabPath)
    }

    function tabPathFor(workflowId: string): string | undefined {
      return tabByWorkflow.get(workflowId)
    }

    function workflowIdFor(tabPath: string): string | undefined {
      for (const [workflowId, boundPath] of tabByWorkflow) {
        if (boundPath === tabPath) return workflowId
      }
      return undefined
    }

    return { bind, tabPathFor, workflowIdFor }
  }
)
