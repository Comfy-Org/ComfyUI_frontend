import { v4 as uuidv4 } from 'uuid'

import type {
  AgentComposerDropReason,
  AgentInputMethod
} from '@comfyorg/telemetry/types'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import type { UserAttachment } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import type { WorkflowReference } from '@/workbench/extensions/agent/types/workflowReference'
import type { AgentStarterPromptSource } from '@/workbench/extensions/agent/utils/starterPrompts'
import type { SelectedNode, useCanvasSelection } from './useCanvasSelection'
import { selectedNodeKey } from './useCanvasSelection'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'

export type DraftSendOutcome = 'sent' | 'withdrawn' | 'failed'

interface UseAgentDraftSubmissionOptions {
  canSubmit: () => boolean
  onSubmit: () => void
  onRejected?: (reason: AgentComposerDropReason) => void
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
    meta: SubmissionMeta,
    releaseGate: () => void
  ) => Promise<DraftSendOutcome>
}

export interface SubmissionMeta {
  clientMessageId: string
  inputMethod: AgentInputMethod
  starterPrompt: AgentStarterPromptSource | null
}

function toUserAttachments(
  attachments: readonly ComposerAttachment[]
): UserAttachment[] {
  return attachments.map(({ name, previewUrl, mediaUrl, ref, mediaKind }) => ({
    name,
    previewUrl,
    mediaUrl,
    ref,
    ...(mediaKind === 'image' || mediaKind === 'video' || mediaKind === 'audio'
      ? { kind: mediaKind }
      : {})
  }))
}

export function useAgentDraftSubmission(
  options: UseAgentDraftSubmissionOptions
) {
  const composer = useAgentComposerStore()
  const conversation = useAgentConversationStore()
  const { selection } = options

  function withdrawSubmission(
    clientMessageId: string,
    expectedRevision?: number
  ): void {
    const pending = conversation.takePendingSend(clientMessageId)
    if (!pending) return
    if (
      (expectedRevision !== undefined &&
        composer.draftRevision !== expectedRevision) ||
      selection.staged.value.length > 0
    ) {
      composer.releaseUnusedAssets()
      return
    }
    composer.restorePrompt(
      {
        text: pending.prompt.text,
        references: pending.prompt.references.filter((reference) => {
          if (reference.kind === 'workflow')
            return reference.id !== options.editableWorkflowId()
          if (reference.kind === 'node')
            return (
              options.target() === pending.target &&
              pending.composerNodes.some(
                (node) =>
                  selectedNodeKey(node) === selectedNodeKey(reference.node)
              )
            )
          return true
        })
      },
      pending.composerAttachments
    )
    composer.restoreSubmissionMeta(pending.promptOrigin, pending.starterPrompt)
    if (options.target() === pending.target)
      selection.replace(pending.composerNodes)
    composer.markRejectedDraft()
  }

  async function submit(
    text: string,
    attachments: ComposerAttachment[],
    references: WorkflowReference[] = []
  ): Promise<boolean> {
    const target = options.target()
    const reject = (reason: AgentComposerDropReason): false => {
      options.onRejected?.(reason)
      return false
    }
    if (!options.canSubmit()) return reject('cannot_submit')
    if (composer.gateHold !== null) return reject('submission_pending')
    if (target === null) return reject('no_target')
    if (!text.trim() && attachments.length === 0) return reject('empty')
    if (attachments.some((attachment) => attachment.uploading))
      return reject('attachment_uploading')

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
    const clientMessageId = uuidv4()
    conversation.startPendingSend({
      clientMessageId,
      text,
      attachments: toUserAttachments(sentAttachments),
      tags: nodes.map((tag) => `${tag.title} #${tag.id}`),
      workflowReferences: sentReferences,
      prompt,
      composerAttachments: sentAttachments,
      composerNodes: nodes,
      target,
      promptOrigin: inputMethod,
      starterPrompt
    })
    const gateId = composer.startGateHold(clientMessageId)
    const gateRevision = composer.draftRevision

    let outcome: DraftSendOutcome = 'failed'
    try {
      outcome = await options.send(
        text,
        sentAttachments,
        nodes,
        sentReferences,
        { clientMessageId, inputMethod, starterPrompt },
        () => composer.releaseGateHold(gateId)
      )
    } finally {
      composer.releaseGateHold(gateId)
      if (outcome === 'withdrawn')
        withdrawSubmission(clientMessageId, gateRevision)
      else composer.releaseUnusedAssets()
    }
    return outcome === 'sent'
  }

  return { submit, withdrawSubmission }
}
