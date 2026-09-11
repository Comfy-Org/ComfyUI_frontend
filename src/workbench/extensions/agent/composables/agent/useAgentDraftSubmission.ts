import { watch } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import type { WorkflowReference } from '../../types/workflowReference'
import type { SelectedNode, useCanvasSelection } from './useCanvasSelection'
import type { ComposerAttachment } from './useComposer'

interface UseAgentDraftSubmissionOptions {
  canSubmit: () => boolean
  contextGeneration: () => number
  target: () => ComfyWorkflow | null
  editableWorkflowId: () => string | undefined
  selection: Pick<
    ReturnType<typeof useCanvasSelection>,
    'staged' | 'consume' | 'replace'
  > & {
    workflow: () => ComfyWorkflow | null
    exit: () => void
  }
  send: (
    text: string,
    attachments: ComposerAttachment[],
    nodes: SelectedNode[],
    references: WorkflowReference[]
  ) => Promise<boolean>
}

export function useAgentDraftSubmission(
  options: UseAgentDraftSubmissionOptions
) {
  const composer = useAgentComposerStore()
  const { selection } = options
  let revision = 0
  watch(
    () =>
      JSON.stringify([
        composer.draft,
        composer.attachments,
        composer.workflowReferences,
        selection.staged.value
      ]),
    () => {
      ++revision
    },
    { flush: 'sync' }
  )

  async function submit(
    text: string,
    attachments: ComposerAttachment[],
    references: WorkflowReference[] = []
  ): Promise<void> {
    const target = options.target()
    if (
      !options.canSubmit() ||
      target === null ||
      (!text.trim() && attachments.length === 0) ||
      attachments.some((attachment) => attachment.uploading)
    )
      return

    const generation = options.contextGeneration()
    const draft = composer.draft
    const draftReferences = [...composer.workflowReferences]
    const sentAttachments = [...attachments]
    const sentReferences = [...references]
    selection.exit()
    const nodes =
      selection.workflow() === target ? [...selection.staged.value] : []

    selection.consume()
    composer.draft = ''
    composer.attachments = []
    composer.workflowReferences = []
    const submittedRevision = revision

    const sent = await options.send(
      text,
      sentAttachments,
      nodes,
      sentReferences
    )
    if (
      sent ||
      generation !== options.contextGeneration() ||
      submittedRevision !== revision ||
      composer.draft.length > 0 ||
      composer.attachments.length > 0 ||
      composer.workflowReferences.length > 0 ||
      selection.staged.value.length > 0
    )
      return

    composer.draft = draft
    composer.attachments = sentAttachments
    composer.workflowReferences = draftReferences.filter(
      ({ id }) => id !== options.editableWorkflowId()
    )
    if (options.target() === target) selection.replace(nodes)
  }

  return { submit }
}
