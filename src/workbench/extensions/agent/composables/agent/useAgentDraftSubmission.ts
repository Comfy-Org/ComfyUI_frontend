import { watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'

import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import type { AgentInputMethod } from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { isReportableSendFault } from './useAgentSession'
import type { WorkflowReference } from '../../types/workflowReference'
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
}

export function useAgentDraftSubmission(
  options: UseAgentDraftSubmissionOptions
) {
  const composer = useAgentComposerStore()
  const toast = useToastStore()
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

  function isSendable(
    text: string,
    attachments: ComposerAttachment[]
  ): boolean {
    if (!options.canSubmit()) return false
    if (composer.submission?.phase === 'pending') return false
    if (!text.trim() && attachments.length === 0) return false
    return !attachments.some((attachment) => attachment.uploading)
  }

  async function submit(
    text: string,
    attachments: ComposerAttachment[],
    references: WorkflowReference[] = []
  ): Promise<void> {
    const target = options.target()
    if (target === null || !isSendable(text, attachments)) return

    options.onSubmit()
    const prompt = composer.prompt
    const inputMethod = composer.promptOrigin
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

    // A send that rejects rather than returning false would leave the
    // submission 'pending' for the page's lifetime, and AgentPanelRoot reads
    // that phase into isSending, which gates canSubmit — so the composer
    // would refuse every later message until a reload. Reported rather than
    // rethrown: the only caller is a template handler typed `=> void`
    // (useComposer's onSend), so a rethrow lands as an untagged unhandled
    // rejection that reaches neither error console.
    let sent = false
    try {
      sent = await options.send(text, sentAttachments, nodes, sentReferences, {
        clientMessageId: uuidv4(),
        inputMethod
      })
    } catch (error) {
      // The draft is gone by now (startSubmission cleared it) and
      // takeFailedSubmission only restores it while the revision still
      // matches, so without a toast the user loses their text to silence.
      if (isReportableSendFault(error))
        reportError(error, { errorType: 'agent_submit_failed' })
      toast.add({
        severity: 'error',
        detail: i18n.global.t('agent.sendFailed')
      })
    }
    composer.settleSubmission(submissionId, sent)
  }

  return { submit }
}
