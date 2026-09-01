import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'Comfy.Agent.WorkflowTabBindings'

export const useAgentWorkflowTabBindingStore = defineStore(
  'agentWorkflowTabBinding',
  () => {
    const tabByWorkflow = useLocalStorage<Record<string, string>>(
      STORAGE_KEY,
      {}
    )

    function bind(workflowId: string, tabPath: string): void {
      const next = Object.fromEntries(
        Object.entries(tabByWorkflow.value).filter(
          ([, boundPath]) => boundPath !== tabPath
        )
      )
      next[workflowId] = tabPath
      tabByWorkflow.value = next
    }

    function tabPathFor(workflowId: string): string | undefined {
      return Object.hasOwn(tabByWorkflow.value, workflowId)
        ? tabByWorkflow.value[workflowId]
        : undefined
    }

    function workflowIdFor(tabPath: string): string | undefined {
      for (const [workflowId, boundPath] of Object.entries(
        tabByWorkflow.value
      )) {
        if (boundPath === tabPath) return workflowId
      }
      return undefined
    }

    return { bind, tabPathFor, workflowIdFor }
  }
)
