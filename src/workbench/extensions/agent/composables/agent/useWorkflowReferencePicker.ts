import { computed } from 'vue'

import type { PromptEditor } from '@/workbench/extensions/agent/types/promptEditor'
import type {
  WorkflowReference,
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '@/workbench/extensions/agent/types/workflowReference'

interface WorkflowReferencePickerOptions<TCapture = unknown> {
  editor: () => PromptEditor | null
  references: () => WorkflowReference[]
  workflows: () => WorkflowReferenceOption[]
  editableWorkflowId: () => string | undefined
  selecting: () => boolean
  resolve: (
    workflow: WorkflowReferenceOption
  ) => Promise<WorkflowReferenceMetadata | undefined>
  captureInsertion?: (from?: number, to?: number) => TCapture
  isInsertionLive?: (captured: TCapture) => boolean
  insertInBackground?: (
    captured: TCapture,
    reference: WorkflowReferenceMetadata
  ) => void
}

export function useWorkflowReferencePicker<TCapture = unknown>(
  options: WorkflowReferencePickerOptions<TCapture>
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
    const captured = options.captureInsertion?.(from, to)
    try {
      const reference = await options.resolve(workflow)
      if (!reference) return false
      if (
        captured !== undefined &&
        options.isInsertionLive?.(captured) === false
      ) {
        options.insertInBackground?.(captured, reference)
        return true
      }
      insertion.insert(reference)
      return true
    } finally {
      insertion.cancel()
    }
  }

  return { eligibleWorkflows, selectWorkflow }
}
