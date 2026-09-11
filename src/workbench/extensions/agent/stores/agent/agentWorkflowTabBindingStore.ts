import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { toRaw, watch } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const STORAGE_KEY = 'Comfy.Agent.WorkflowTabBindings'

export const useAgentWorkflowTabBindingStore = defineStore(
  'agentWorkflowTabBinding',
  () => {
    const tabByWorkflow = useLocalStorage<Record<string, string>>(
      STORAGE_KEY,
      {}
    )

    const workflows = useWorkflowStore()
    const boundInstances = new Map<string, ComfyWorkflow>()

    function unbind(tabPath: string): void {
      for (const [id, path] of Object.entries(tabByWorkflow.value)) {
        if (path === tabPath) {
          delete tabByWorkflow.value[id]
          boundInstances.delete(id)
        }
      }
    }

    watch(
      () => workflows.openWorkflows.map((tab) => ({ tab, path: tab.path })),
      (open, previous = []) => {
        for (const { tab, path } of previous) {
          if (!open.some((entry) => entry.tab === tab)) {
            const id = workflowIdFor(path)
            if (
              id !== undefined &&
              (!boundInstances.has(id) || boundInstances.get(id) === toRaw(tab))
            )
              unbind(path)
          }
        }
        for (const { tab, path } of open) {
          const id = workflowIdFor(path)
          if (id !== undefined && !boundInstances.has(id))
            boundInstances.set(id, toRaw(tab))
        }
      },
      { immediate: true }
    )

    function matchesWorkflow(
      workflowId: string,
      workflow: ComfyWorkflow
    ): boolean {
      return (
        !workflow.isTemporary ||
        boundInstances.get(workflowId) === toRaw(workflow)
      )
    }

    function bind(workflowId: string, tabPath: string): void {
      unbind(tabPath)
      const workflow = workflows.getWorkflowByPath(tabPath)
      if (workflow) boundInstances.set(workflowId, toRaw(workflow))
      else boundInstances.delete(workflowId)
      const next = { ...tabByWorkflow.value, [workflowId]: tabPath }
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

    return { bind, unbind, matchesWorkflow, tabPathFor, workflowIdFor }
  }
)
