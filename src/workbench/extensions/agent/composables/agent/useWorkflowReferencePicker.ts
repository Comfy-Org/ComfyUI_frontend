import { computed } from 'vue'

import type { PromptEditor } from '../../types/promptEditor'
import type {
  WorkflowReference,
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '../../types/workflowReference'

interface WorkflowReferencePickerOptions {
  editor: () => PromptEditor | null
  references: () => WorkflowReference[]
  workflows: () => WorkflowReferenceOption[]
  editableWorkflowId: () => string | undefined
  selecting: () => boolean
  resolve: (
    workflow: WorkflowReferenceOption
  ) => Promise<WorkflowReferenceMetadata | undefined>
}

export function useWorkflowReferencePicker(
  options: WorkflowReferencePickerOptions
) {
  const eligibleWorkflows = computed(() => {
    const selectedIds = new Set(options.references().map(({ id }) => id))
    return options
      .workflows()
      .filter(
        ({ id }) =>
          id === undefined ||
          (id !== options.editableWorkflowId() && !selectedIds.has(id))
      )
  })

  async function selectWorkflow(
    workflow: WorkflowReferenceOption,
    from?: number,
    to?: number
  ): Promise<boolean> {
    if (options.selecting()) return false
    const insertion = options.editor()?.captureInsertion(from, to)
    if (!insertion) return false
    try {
      const reference = await options.resolve(workflow)
      if (!reference) return false
      insertion.insert(reference)
      return true
    } finally {
      insertion.cancel()
    }
  }

  return { eligibleWorkflows, selectWorkflow }
}
