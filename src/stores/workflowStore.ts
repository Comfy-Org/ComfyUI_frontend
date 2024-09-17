import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ComfyWorkflow } from '@/scripts/workflows'
import { getStorageValue } from '@/scripts/utils'
import { buildTree } from '@/utils/treeUtil'

export const useWorkflowStore = defineStore('workflow', () => {
  const activeWorkflow = ref<ComfyWorkflow | null>(null)
  const previousWorkflowUnsaved = ref<boolean>(
    Boolean(getStorageValue('Comfy.PreviousWorkflowUnsaved'))
  )

  const workflowLookup = ref<Record<string, ComfyWorkflow>>({})
  const workflows = computed(() => Object.values(workflowLookup.value))
  const openWorkflows = ref<ComfyWorkflow[]>([])

  const buildWorkflowTree = (workflows: ComfyWorkflow[]) => {
    return buildTree(workflows, (workflow: ComfyWorkflow) =>
      workflow.key.split('/')
    )
  }
  const workflowsTree = computed(() => buildWorkflowTree(workflows.value))
  const openWorkflowsTree = computed(() =>
    buildWorkflowTree(openWorkflows.value as ComfyWorkflow[])
  )

  return {
    activeWorkflow,
    previousWorkflowUnsaved,
    workflows,
    openWorkflows,
    workflowLookup,
    workflowsTree,
    openWorkflowsTree,
    buildWorkflowTree
  }
})
