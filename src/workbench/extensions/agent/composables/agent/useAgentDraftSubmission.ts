import { v4 as uuidv4 } from 'uuid'

import type {
  AgentComposerDropReason,
  AgentInputMethod
} from '@comfyorg/telemetry/types'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import type { GateHoldSnapshot } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import type {
  PendingSentAttachment,
  UserAttachment
} from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
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

export function pendingAssetOwnerKey(clientMessageId: string): string {
  return `pending:${clientMessageId}`
}

function toSentAttachments(
  attachments: readonly ComposerAttachment[]
): PendingSentAttachment[] {
  return attachments.map(({ ref, name, previewUrl, mediaUrl, mediaKind }) => ({
    ref,
    name,
    previewUrl,
    mediaUrl,
    mediaKind
  }))
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
    snapshot?: GateHoldSnapshot,
    expectedRevision?: number
  ): void {
    const pending = conversation.takePendingSend(clientMessageId)
    if (!pending) {
      composer.releaseRetainedAssets(pendingAssetOwnerKey(clientMessageId))
      return
    }
    if (
      !snapshot ||
      (expectedRevision !== undefined &&
        composer.draftRevision !== expectedRevision) ||
      selection.staged.value.length > 0
    ) {
      composer.releaseRetainedAssets(pendingAssetOwnerKey(clientMessageId))
      return
    }
    const targetPath = options.target()?.path ?? null
    composer.restorePrompt(
      {
        text: snapshot.prompt.text,
        references: snapshot.prompt.references.filter((reference) => {
          if (reference.kind === 'workflow')
            return reference.id !== options.editableWorkflowId()
          if (reference.kind === 'node')
            return (
              targetPath === snapshot.targetPath &&
              snapshot.nodes.some(
                (node) =>
                  selectedNodeKey(node) === selectedNodeKey(reference.node)
              )
            )
          return true
        })
      },
      snapshot.attachments
    )
    composer.restoreSubmissionMeta(
      snapshot.promptOrigin,
      snapshot.starterPrompt
    )
    if (targetPath === snapshot.targetPath) selection.replace(snapshot.nodes)
    composer.markRejectedDraft()
    composer.releaseRetainedAssets(pendingAssetOwnerKey(clientMessageId))
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
    const assetIds = sentAttachments.map(({ id }) => id)
    composer.retainAssets(pendingAssetOwnerKey(clientMessageId), assetIds)
    conversation.startPendingSend({
      clientMessageId,
      rawText: text,
      text,
      attachments: toUserAttachments(sentAttachments),
      sentAttachments: toSentAttachments(sentAttachments),
      sentTags: nodes,
      tags: nodes.map((tag) => `${tag.title} #${tag.id}`),
      workflowReferences: sentReferences,
      assetIds,
      targetTabPath: target.path,
      inputMethod,
      starterPrompt
    })
    const snapshot: GateHoldSnapshot = {
      prompt,
      attachments: sentAttachments,
      nodes,
      targetPath: target.path,
      promptOrigin: inputMethod,
      starterPrompt
    }
    const gateId = composer.startGateHold(clientMessageId, snapshot)
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
        withdrawSubmission(clientMessageId, snapshot, gateRevision)
      else if (!conversation.getPendingSend(clientMessageId))
        composer.releaseRetainedAssets(pendingAssetOwnerKey(clientMessageId))
      else composer.releaseUnusedAssets()
    }
    return outcome === 'sent'
  }

  return { submit, withdrawSubmission }
}
