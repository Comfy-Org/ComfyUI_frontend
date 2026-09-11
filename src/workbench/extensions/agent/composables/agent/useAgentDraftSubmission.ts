import { watch } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import type { WorkflowReference } from '../../types/workflowReference'
import type { SelectedNode, useCanvasSelection } from './useCanvasSelection'
import type { ComposerAttachment } from './useComposer'

interface UseAgentDraftSubmissionOptions {
  canSubmit: () => boolean
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
  stop: () => Promise<void>
}

export function useAgentDraftSubmission(
  options: UseAgentDraftSubmissionOptions
) {
  const composer = useAgentComposerStore()
  const { selection } = options
  watch(
    selection.staged,
    (nodes, previous) => {
      if (nodes.length > 0 || previous.length > 0) composer.markEdited()
    },
    { deep: true, flush: 'sync' }
  )

  function recoverFailedSubmission(): void {
    const snapshot = composer.takeFailedSubmission()
    if (!snapshot || selection.staged.value.length > 0) return

    composer.replaceDraft({
      text: snapshot.draft,
      attachments: snapshot.attachments,
      workflowReferences: snapshot.references.filter(
        ({ id }) => id !== options.editableWorkflowId()
      )
    })
    if (options.target() === snapshot.target) selection.replace(snapshot.nodes)
  }

  watch(() => composer.submission, recoverFailedSubmission, {
    immediate: true,
    flush: 'sync'
  })

  async function submit(
    text: string,
    attachments: ComposerAttachment[],
    references: WorkflowReference[] = []
  ): Promise<void> {
    const target = options.target()
    if (
      !options.canSubmit() ||
      composer.submission?.phase === 'pending' ||
      target === null ||
      (!text.trim() && attachments.length === 0) ||
      attachments.some((attachment) => attachment.uploading)
    )
      return

    const draft = composer.draft
    const draftReferences = [...composer.workflowReferences]
    const sentAttachments = [...attachments]
    const sentReferences = [...references]
    selection.exit()
    const nodes =
      selection.workflow() === target ? [...selection.staged.value] : []

    selection.consume()
    const submissionId = composer.startSubmission({
      draft,
      references: draftReferences,
      attachments: sentAttachments,
      nodes,
      target
    })

    const sent = await options.send(
      text,
      sentAttachments,
      nodes,
      sentReferences
    )
    const stopRequested =
      composer.submission?.id === submissionId &&
      composer.submission.stopRequested
    composer.settleSubmission(submissionId, sent)
    if (sent && stopRequested) await options.stop()
  }

  return { submit }
}
