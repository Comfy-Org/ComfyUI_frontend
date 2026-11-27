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
import { promptSkillCount } from '@/workbench/extensions/agent/utils/composerPrompt'
import type { AgentStarterPromptSource } from '@/workbench/extensions/agent/utils/starterPrompts'
import type { SelectedNode, useCanvasSelection } from './useCanvasSelection'
import { selectedNodeKey } from './useCanvasSelection'
import { draftKeyForOrigin } from './useAgentChatDrafts'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'

export type DraftSendOutcome = 'sent' | 'withdrawn' | 'failed'

interface UseAgentDraftSubmissionOptions {
  canSubmit: () => boolean
  onSubmit: () => void
  onRejected?: (reason: AgentComposerDropReason) => void
  target: () => ComfyWorkflow | null
  activeTabPath?: () => string | null
  editableWorkflowId: () => string | undefined
  workspaceId?: () => string | null
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
    releaseGate: () => void,
    target: ComfyWorkflow
  ) => Promise<DraftSendOutcome>
}

export interface SubmissionMeta {
  clientMessageId: string
  inputMethod: AgentInputMethod
  starterPrompt: AgentStarterPromptSource | null
  skillCount: 0 | 1
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

export interface DirectSubmissionInput {
  text: string
  nodes: SelectedNode[]
  inputMethod: AgentInputMethod
}

export type DirectSubmissionOutcome =
  | 'sent'
  | 'rejected'
  | 'withdrawn'
  | 'withdrawn_unrestored'
  | 'failed'

export function useAgentDraftSubmission(
  options: UseAgentDraftSubmissionOptions
) {
  const composer = useAgentComposerStore()
  const conversation = useAgentConversationStore()
  const { selection } = options

  function keepWithdrawnReference(
    reference: GateHoldSnapshot['prompt']['references'][number],
    targetInstanceId: string | null,
    snapshot: GateHoldSnapshot
  ): boolean {
    if (reference.kind === 'workflow')
      return reference.id !== options.editableWorkflowId()
    if (reference.kind === 'node')
      return (
        targetInstanceId === snapshot.targetInstanceId &&
        snapshot.nodes.some(
          (node) => selectedNodeKey(node) === selectedNodeKey(reference.node)
        )
      )
    return true
  }

  function canRestoreOnScreen(
    expectedRevision: number | undefined,
    external = false
  ): boolean {
    if (external && composer.hasDraft) return false
    const revisionMatches =
      expectedRevision === undefined ||
      composer.draftRevision === expectedRevision
    return revisionMatches && selection.staged.value.length === 0
  }

  function withdrawSubmission(
    clientMessageId: string,
    snapshot?: GateHoldSnapshot,
    expectedRevision?: number
  ): boolean {
    const pending = conversation.takePendingSend(clientMessageId)
    composer.clearPendingSendDraft(clientMessageId)
    if (!pending || !snapshot) {
      composer.releaseRetainedAssets(pendingAssetOwnerKey(clientMessageId))
      return false
    }
    if (!conversation.isOriginOnScreen(pending.origin)) {
      composer.restoreKeptDraftSnapshot(
        draftKeyForOrigin(pending.origin),
        snapshot
      )
      composer.releaseRetainedAssets(pendingAssetOwnerKey(clientMessageId))
      return true
    }
    if (!canRestoreOnScreen(expectedRevision, snapshot.external)) {
      composer.releaseRetainedAssets(pendingAssetOwnerKey(clientMessageId))
      return false
    }
    const targetInstanceId = options.target()?.instanceId ?? null
    composer.restorePrompt(
      {
        text: snapshot.prompt.text,
        references: snapshot.prompt.references.filter((reference) =>
          keepWithdrawnReference(reference, targetInstanceId, snapshot)
        )
      },
      snapshot.attachments
    )
    composer.restoreSubmissionMeta(
      snapshot.promptOrigin,
      snapshot.starterPrompt
    )
    if (targetInstanceId === snapshot.targetInstanceId) {
      if (
        snapshot.nodes.length > 0 &&
        !snapshot.prompt.references.some((item) => item.kind === 'node')
      )
        composer.setInsertionPoint({ textOffset: 0, referenceIndex: 0 })
      selection.replace(snapshot.nodes)
    }
    composer.markRejectedDraft()
    composer.releaseRetainedAssets(pendingAssetOwnerKey(clientMessageId))
    return true
  }

  function validateSubmissionTarget(
    text: string,
    attachments: ComposerAttachment[]
  ): ComfyWorkflow | null {
    const target = options.target()
    const reject = (reason: AgentComposerDropReason) => {
      options.onRejected?.(reason)
      return null
    }
    if (!options.canSubmit()) return reject('cannot_submit')
    if (composer.gateHold !== null) return reject('submission_pending')
    if (target === null) return reject('no_target')
    if (!text.trim() && attachments.length === 0) return reject('empty')
    if (attachments.some((attachment) => attachment.uploading))
      return reject('attachment_uploading')
    return target
  }

  function stageSubmission(
    text: string,
    attachments: ComposerAttachment[],
    references: WorkflowReference[],
    target: ComfyWorkflow
  ) {
    options.onSubmit()
    const prompt = composer.prompt
    const inputMethod = composer.promptOrigin
    const starterPrompt = composer.starterPrompt
    const skillCount = promptSkillCount(prompt)
    const sentAttachments = [...attachments]
    const sentReferences = [...references]
    selection.exit()
    const nodes =
      selection.workflow() === target ? [...selection.staged.value] : []
    selection.consume()

    const clientMessageId = uuidv4()
    const assetIds = sentAttachments.map(({ id }) => id)
    composer.retainAssets(pendingAssetOwnerKey(clientMessageId), assetIds)
    const pending = conversation.startPendingSend({
      clientMessageId,
      workspaceId: options.workspaceId?.() ?? null,
      rawText: text,
      text,
      attachments: toUserAttachments(sentAttachments),
      sentAttachments: toSentAttachments(sentAttachments),
      sentTags: nodes,
      tags: nodes.map((tag) => `${tag.title} #${tag.id}`),
      workflowReferences: sentReferences,
      assetIds,
      targetTabPath: target.path,
      targetTabInstanceId: target.instanceId,
      tab: { status: 'known', workflowInstanceId: target.instanceId },
      inputMethod,
      starterPrompt
    })
    const snapshot: GateHoldSnapshot = {
      prompt,
      attachments: sentAttachments,
      nodes,
      targetInstanceId: target.instanceId,
      promptOrigin: inputMethod,
      starterPrompt
    }
    const gateId = composer.startGateHold(clientMessageId, snapshot, {
      tabPath: options.activeTabPath?.() ?? target.path,
      expectedText: pending.text,
      expectedSkillName: pending.skillReference?.name,
      knownTurnIds: conversation.knownUserTurnIds()
    })
    return {
      clientMessageId,
      gateId,
      gateRevision: composer.draftRevision,
      snapshot,
      target,
      sentAttachments,
      sentReferences,
      nodes,
      inputMethod,
      starterPrompt,
      skillCount
    }
  }

  function stageDirectSubmission(
    input: DirectSubmissionInput,
    target: ComfyWorkflow
  ): ReturnType<typeof stageSubmission> {
    options.onSubmit()
    selection.exit()
    const nodes = [...input.nodes]
    const clientMessageId = uuidv4()
    const pending = conversation.startPendingSend({
      clientMessageId,
      workspaceId: options.workspaceId?.() ?? null,
      rawText: input.text,
      text: input.text,
      attachments: [],
      sentAttachments: [],
      sentTags: nodes,
      tags: nodes.map((tag) => `${tag.title} #${tag.id}`),
      workflowReferences: [],
      assetIds: [],
      targetTabPath: target.path,
      targetTabInstanceId: target.instanceId,
      tab: { status: 'known', workflowInstanceId: target.instanceId },
      inputMethod: input.inputMethod,
      starterPrompt: null
    })
    const snapshot: GateHoldSnapshot = {
      prompt: { text: input.text, references: [] },
      attachments: [],
      nodes,
      targetInstanceId: target.instanceId,
      promptOrigin: input.inputMethod,
      starterPrompt: null,
      external: true
    }
    const gateId = composer.startExternalGateHold(clientMessageId, snapshot, {
      tabPath: options.activeTabPath?.() ?? target.path,
      text: input.text,
      workflowReferences: [],
      expectedText: pending.text,
      knownTurnIds: conversation.knownUserTurnIds()
    })
    return {
      clientMessageId,
      gateId,
      gateRevision: composer.draftRevision,
      snapshot,
      target,
      sentAttachments: [],
      sentReferences: [],
      nodes,
      inputMethod: input.inputMethod,
      starterPrompt: null,
      skillCount: 0
    }
  }

  function settleSubmissionOutcome(
    outcome: DraftSendOutcome,
    staged: ReturnType<typeof stageSubmission>
  ): DirectSubmissionOutcome {
    composer.releaseGateHold(staged.gateId)
    if (outcome === 'withdrawn') {
      const restored = withdrawSubmission(
        staged.clientMessageId,
        staged.snapshot,
        staged.gateRevision
      )
      return restored ? 'withdrawn' : 'withdrawn_unrestored'
    }
    if (!conversation.getPendingSend(staged.clientMessageId)) {
      composer.clearPendingSendDraft(staged.clientMessageId)
      composer.releaseRetainedAssets(
        pendingAssetOwnerKey(staged.clientMessageId)
      )
      return outcome
    }
    composer.releaseUnusedAssets()
    return outcome
  }

  async function runStagedSubmission(
    text: string,
    staged: ReturnType<typeof stageSubmission>
  ): Promise<DirectSubmissionOutcome> {
    let outcome: DraftSendOutcome = 'failed'
    let settled: DirectSubmissionOutcome
    let threw = false
    try {
      outcome = await options.send(
        text,
        staged.sentAttachments,
        staged.nodes,
        staged.sentReferences,
        {
          clientMessageId: staged.clientMessageId,
          inputMethod: staged.inputMethod,
          starterPrompt: staged.starterPrompt,
          skillCount: staged.skillCount
        },
        () => composer.releaseGateHold(staged.gateId),
        staged.target
      )
    } catch (error) {
      threw = true
      throw error
    } finally {
      const effectiveOutcome =
        threw &&
        conversation.getPendingSend(staged.clientMessageId)?.status ===
          'sending'
          ? 'withdrawn'
          : outcome
      settled = settleSubmissionOutcome(effectiveOutcome, staged)
    }
    return settled
  }

  async function submit(
    text: string,
    attachments: ComposerAttachment[],
    references: WorkflowReference[] = []
  ): Promise<boolean> {
    const target = validateSubmissionTarget(text, attachments)
    if (target === null) return false
    const staged = stageSubmission(text, attachments, references, target)
    return (await runStagedSubmission(text, staged)) === 'sent'
  }

  async function submitDirect(
    input: DirectSubmissionInput
  ): Promise<DirectSubmissionOutcome> {
    const target = validateSubmissionTarget(input.text, [])
    if (target === null) return 'rejected'
    const staged = stageDirectSubmission(input, target)
    return runStagedSubmission(input.text, staged)
  }

  return { submit, submitDirect, withdrawSubmission }
}
