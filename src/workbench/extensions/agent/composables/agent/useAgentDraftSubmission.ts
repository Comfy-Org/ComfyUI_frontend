import { watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'

import type { AgentInputMethod } from '@/platform/telemetry/types'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import type { WorkflowReference } from '../../types/workflowReference'
import type { AgentStarterPromptSource } from '../../utils/starterPrompts'
import type { SelectedNode, useCanvasSelection } from './useCanvasSelection'
import { selectedNodeKey } from './useCanvasSelection'
import type { ComposerAttachment } from './useComposer'

interface UseAgentDraftSubmissionOptions {
  canSubmit: () => boolean
  onSubmit: () => void
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
    references: WorkflowReference[],
    meta: SubmissionMeta
  ) => Promise<boolean>
}

/**
 * Identity of this send attempt, for the telemetry the caller emits. Carried
 * through `send` because `startSubmission` clears the draft it is derived from
 * before the send runs.
 */
export interface SubmissionMeta {
  clientMessageId: string
  inputMethod: AgentInputMethod
  /**
   * The starter prompt this draft came from, `null` when none did. Read here
   * rather than at report time for the same reason `inputMethod` is:
   * `startSubmission` clears it, and a failed send restores it for the retry.
   */
  starterPrompt: AgentStarterPromptSource | null
}

export function useAgentDraftSubmission(
  options: UseAgentDraftSubmissionOptions
) {
  const composer = useAgentComposerStore()
  const { selection } = options

  function recoverFailedSubmission(): void {
    const snapshot = composer.takeFailedSubmission()
    if (!snapshot || selection.staged.value.length > 0) return

    composer.restorePrompt({
      text: snapshot.prompt.text,
      references: snapshot.prompt.references.filter((reference) => {
        if (reference.kind === 'workflow')
          return reference.id !== options.editableWorkflowId()
        if (reference.kind === 'node')
          return (
            options.target() === snapshot.target &&
            snapshot.nodes.some(
              (node) =>
                selectedNodeKey(node) === selectedNodeKey(reference.node)
            )
          )
        return true
      })
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

    options.onSubmit()
    const prompt = composer.prompt
    const inputMethod = composer.promptOrigin
    const starterPrompt = composer.starterPrompt
    const sentAttachments = [...attachments]
    const sentReferences = [...references]
    selection.exit()
    const nodes =
      selection.workflow() === target ? [...selection.staged.value] : []

    selection.consume()
    const submissionId = composer.startSubmission({
      prompt,
      attachments: sentAttachments,
      nodes,
      target
    })

    const sent = await options.send(
      text,
      sentAttachments,
      nodes,
      sentReferences,
      { clientMessageId: uuidv4(), inputMethod, starterPrompt }
    )
    composer.settleSubmission(submissionId, sent)
  }

  return { submit }
}
