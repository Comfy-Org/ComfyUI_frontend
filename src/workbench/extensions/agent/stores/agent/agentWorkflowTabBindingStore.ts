import { defineStore } from 'pinia'
import { reactive } from 'vue'

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
