import { StorageSerializers, createEventHook } from '@vueuse/core'
import { defineStore } from 'pinia'
import {
  computed,
  onScopeDispose,
  ref,
  shallowReactive,
  shallowRef,
  watch
} from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

import { useSafeLocalStorage } from '@/platform/storage/useSafeStorage'
import {
  getWorkspaceId,
  StorageKeys
} from '@/platform/workflow/persistence/base/storageKeys'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

import type { AgentInputMethod } from '@comfyorg/telemetry/types'

import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'
import type { SelectedNode } from '@/workbench/extensions/agent/composables/agent/useCanvasSelection'
import { selectedNodeKey } from '@/workbench/extensions/agent/composables/agent/useCanvasSelection'
import type {
  ComposerInsertionPoint,
  ComposerPrompt,
  ComposerReference
} from '@/workbench/extensions/agent/types/composerPrompt'
import { composerReferenceKey } from '@/workbench/extensions/agent/types/composerPrompt'
import type {
  PromptSnapshot,
  WorkflowReference,
  WorkflowReferenceMetadata
} from '@/workbench/extensions/agent/types/workflowReference'
import {
  composerPromptForSubmission,
  insertComposerReference
} from '@/workbench/extensions/agent/utils/composerPrompt'
import { promptReferenceParts } from '@/workbench/extensions/agent/utils/promptReferenceParts'
import { createVideoThumbnail } from '@/workbench/extensions/agent/utils/videoThumbnail'
import type { AgentStarterPromptSource } from '@/workbench/extensions/agent/utils/starterPrompts'
import type { HydratedUserTurn } from '@/workbench/extensions/agent/utils/workflowReferenceText'
import { matchesHydratedUserTurn } from '@/workbench/extensions/agent/utils/workflowReferenceText'

interface ComposerDraft extends PromptSnapshot {
  attachments: ComposerAttachment[]
}

/**
 * `insertComposerReference` (composerPrompt.ts) pads an empty `text` with a
 * literal space on first insert. Once the last reference is removed, that
 * padding is meaningless whitespace rather than real content, so it is
 * cleared along with the reference that caused it.
 */
function resetTextWhenReferencesCleared(
  text: string,
  references: ComposerReference[]
): string {
  return references.length === 0 && text.trim() === '' ? '' : text
}

function composerReferencePosition(reference: ComposerReference): string {
  return `${composerReferenceKey(reference)}@${reference.textOffset}`
}

const zSavedWorkflowReference = z.object({
  id: z.string(),
  name: z.string(),
  unavailable: z.boolean().optional(),
  textOffset: z.number()
})

const zSavedDraft = z.object({
  threadId: z.string().nullable(),
  tabPath: z.string().optional(),
  text: z.string(),
  workflowReferences: z.array(zSavedWorkflowReference)
})

type SavedDraft = z.infer<typeof zSavedDraft>

const zPendingSendBackup = z.object({
  clientMessageId: z.string(),
  threadId: z.string().nullable(),
  tabPath: z.string().optional(),
  text: z.string(),
  workflowReferences: z.array(zSavedWorkflowReference),
  expectedText: z.string(),
  expectedSkillName: z.string().optional(),
  knownTurnIds: z.array(z.string())
})

const zPendingSendBackups = z.array(zPendingSendBackup)

type PendingSendBackup = z.infer<typeof zPendingSendBackup>

interface PendingSendBackupInput {
  tabPath?: string
  text?: string
  workflowReferences?: WorkflowReference[]
  expectedText?: string
  expectedSkillName?: string
  knownTurnIds?: readonly string[]
}

export interface GateHoldSnapshot {
  prompt: ComposerPrompt
  attachments: ComposerAttachment[]
  nodes: SelectedNode[]
  targetInstanceId: string | null
  promptOrigin: AgentInputMethod
  starterPrompt: AgentStarterPromptSource | null
}

interface GateHold {
  id: number
  clientMessageId: string
  revision: number
  snapshot: GateHoldSnapshot
}

interface KeptDraft {
  prompt: ComposerPrompt
  attachmentIds: string[]
  origin: AgentInputMethod
  starterPrompt: AgentStarterPromptSource | null
}

interface CapturedReferenceInsertion {
  draftKey: string | null
  activationCount: number
  from?: number
  to?: number
  expectedTrigger?: string
  insertionPoint: ComposerInsertionPoint
}

function applyWorkflowReferenceToPrompt(
  current: ComposerPrompt,
  reference: WorkflowReferenceMetadata,
  captured: Pick<
    CapturedReferenceInsertion,
    'from' | 'to' | 'expectedTrigger' | 'insertionPoint'
  >
): ComposerPrompt {
  if (captured.from !== undefined && captured.to !== undefined) {
    const start = Math.min(current.text.length, Math.max(0, captured.from))
    const end = Math.min(current.text.length, Math.max(start, captured.to))
    const matchesTrigger =
      captured.expectedTrigger === undefined ||
      current.text.slice(start, end) === captured.expectedTrigger
    if (matchesTrigger) {
      const removed = end - start
      const text = current.text.slice(0, start) + current.text.slice(end)
      const references = current.references.map((item) => ({
        ...item,
        textOffset:
          item.textOffset >= end
            ? item.textOffset - removed
            : item.textOffset > start
              ? start
              : item.textOffset
      }))
      const referenceIndex = references.filter(
        (item) => item.textOffset <= start
      ).length
      return insertComposerReference(
        { text, references },
        { kind: 'workflow', ...reference, textOffset: start },
        { textOffset: start, referenceIndex }
      ).prompt
    }
  }
  return insertComposerReference(
    current,
    {
      kind: 'workflow',
      ...reference,
      textOffset: captured.insertionPoint.textOffset
    },
    captured.insertionPoint
  ).prompt
}

const MAX_KEPT_DRAFTS = 20
const MAX_ACTIVE_CAPTURES = 32
const MAX_PENDING_SEND_BACKUPS = 32

function emptyKeptDraft(): KeptDraft {
  return {
    prompt: { text: '', references: [] },
    attachmentIds: [],
    origin: 'typed',
    starterPrompt: null
  }
}

export const useAgentComposerStore = defineStore('agentComposer', () => {
  const keptDrafts = new Map<string, KeptDraft>()
  const activeCaptures = new Set<CapturedReferenceInsertion>()
  let activeDraftKey: string | null = null
  let draftActivationCount = 0
  const draftState = shallowRef<ComposerPrompt>({ text: '', references: [] })
  const prompt = computed(() => draftState.value)
  const draft = computed(() => prompt.value.text)
  const attachmentIds = ref<string[]>([])
  const assetsById = shallowReactive(new Map<string, ComposerAttachment>())
  const attachments = computed(() =>
    attachmentIds.value.flatMap((id) => {
      const attachment = assetsById.get(id)
      return attachment ? [attachment] : []
    })
  )
  const workflowReferences = computed(() =>
    prompt.value.references.flatMap((item) => {
      if (item.kind !== 'workflow') return []
      const { kind: _kind, ...reference } = item
      return [reference]
    })
  )
  const nodes = computed(() =>
    prompt.value.references.flatMap((item) =>
      item.kind === 'node' ? [item.node] : []
    )
  )
  const selectionModeNodeKeys = ref<Set<string>>(new Set())
  const hasDraft = computed(
    () =>
      draft.value.trim() !== '' ||
      attachments.value.length > 0 ||
      prompt.value.references.length > 0
  )
  const nodeScope = ref<string | null>(null)
  let skillScope: string | null = null
  const promptEpoch = ref(0)
  const errorContext = computed<AgentErrorContext | null>(() => {
    const reference = prompt.value.references.find(
      (item) => item.kind === 'error'
    )
    return reference?.kind === 'error' ? reference.context : null
  })
  // Set by the affordance that supplied the text; read once at submission and
  // reset there, so it describes the message being sent rather than the panel.
  const promptOrigin = ref<AgentInputMethod>('typed')
  // Which starter prompt supplied the text, when one did. Lives and dies with
  // `promptOrigin` — same submission lifecycle, same retry restore — so the two
  // can never disagree about whether this draft came from a chip.
  const starterPrompt = ref<AgentStarterPromptSource | null>(null)
  const insertionPoint = shallowRef<ComposerInsertionPoint>({
    textOffset: 0,
    referenceIndex: 0
  })
  const pendingCaret = shallowRef<ComposerInsertionPoint | null>(null)
  const retiredAssets = new Set<string>()
  const thumbnailJobs = new Map<
    string,
    { source: string; controller: AbortController }
  >()
  onScopeDispose(() => {
    for (const job of thumbnailJobs.values()) job.controller.abort()
    thumbnailJobs.clear()
    for (const attachment of assetsById.values()) revokePreview(attachment)
  })

  function cancelThumbnail(id: string): void {
    thumbnailJobs.get(id)?.controller.abort()
    thumbnailJobs.delete(id)
  }

  function ensureThumbnail(attachment: ComposerAttachment): void {
    const { id, mediaUrl, previewUrl } = attachment
    const kind =
      attachment.mediaKind ?? getMediaTypeFromFilename(attachment.name)
    if (kind !== 'video' || !mediaUrl || previewUrl) {
      cancelThumbnail(id)
      return
    }
    if (thumbnailJobs.get(id)?.source === mediaUrl) return
    cancelThumbnail(id)
    const job = { source: mediaUrl, controller: new AbortController() }
    thumbnailJobs.set(id, job)
    void createVideoThumbnail(mediaUrl, job.controller.signal).then((url) => {
      if (!url) return
      const current = assetsById.get(id)
      if (
        thumbnailJobs.get(id) !== job ||
        !current ||
        current.previewUrl ||
        current.mediaUrl !== mediaUrl
      ) {
        URL.revokeObjectURL(url)
        return
      }
      updateAttachment(id, { previewUrl: url })
    })
  }
  const gateHold = shallowRef<GateHold | null>(null)
  const retainedByOwner = new Map<string, Set<string>>()
  const assetPreviewUpdated = createEventHook<{
    id: string
    previewUrl: string
  }>()
  const rejectedDraft = shallowRef<{
    prompt: ComposerPrompt
    attachmentIds: string[]
  } | null>(null)
  const rejectedDraftUnchanged = computed(() => {
    const rejected = rejectedDraft.value
    if (!rejected) return false
    const ids = attachmentIds.value
    if (rejected.attachmentIds.length !== ids.length) return false
    if (!rejected.attachmentIds.every((id, index) => id === ids[index]))
      return false
    const current = draftState.value
    return (
      rejected.prompt.text === current.text &&
      rejected.prompt.references.length === current.references.length &&
      rejected.prompt.references.every(
        (reference, index) =>
          composerReferencePosition(reference) ===
          composerReferencePosition(current.references[index])
      )
    )
  })
  const revision = ref(0)
  let nextGateHoldId = 0

  function updateDraft(next: ComposerPrompt): void {
    ++revision.value
    draftState.value = next
  }

  function prefillGreeting(text: string): (() => void) | undefined {
    if (draft.value !== '' || hasDraft.value || gateHold.value) return
    setText(text)
    markSuggestedPrompt()
    const ownedRevision = revision.value
    return () => {
      if (revision.value !== ownedRevision) return
      setText('')
      promptOrigin.value = 'typed'
      starterPrompt.value = null
      resetPromptHistory()
    }
  }

  function setInsertionPoint(point: ComposerInsertionPoint): void {
    insertionPoint.value = point
  }

  function resetPromptHistory(): void {
    ++promptEpoch.value
  }

  function setText(text: string): void {
    if (text === draft.value) return
    updateDraft({
      text,
      references: prompt.value.references.map((item) => ({
        ...item,
        textOffset: Math.min(text.length, item.textOffset)
      }))
    })
    insertionPoint.value = {
      textOffset: text.length,
      referenceIndex: prompt.value.references.length
    }
  }

  function resolveEditorReference(
    item: ComposerReference
  ): ComposerReference[] {
    if (item.kind === 'node' && item.scope !== nodeScope.value) return []
    if (item.kind !== 'asset') return [item]
    if (!attachmentIds.value.includes(item.attachment.id)) return []
    const attachment = assetsById.get(item.attachment.id)
    if (!attachment) return []
    return [{ ...item, attachment }]
  }

  function applyEditorPrompt(next: ComposerPrompt, metadataOnly = false): void {
    const seen = new Set<string>()
    let hasSkill = false
    const references = next.references.flatMap((item): ComposerReference[] => {
      if (item.kind === 'skill') {
        if (item.scope !== skillScope || hasSkill) return []
        hasSkill = true
      }
      const key = composerReferenceKey(item)
      if (item.kind !== 'asset' && seen.has(key)) return []
      seen.add(key)
      return resolveEditorReference(item)
    })
    if (
      !next.text.trim() &&
      references.length === 0 &&
      promptOrigin.value === 'suggestion'
    ) {
      promptOrigin.value = 'typed'
      starterPrompt.value = null
    }
    if (
      promptOrigin.value === 'error_context' &&
      !references.some((item) => item.kind === 'error')
    )
      promptOrigin.value = 'typed'
    if (metadataOnly) draftState.value = { text: next.text, references }
    else updateDraft({ text: next.text, references })
  }

  function resolveSkillMetadata(next: ComposerPrompt): void {
    if (next.text !== prompt.value.text) return
    const previous = prompt.value.references.find(
      (item) => item.kind === 'skill'
    )
    const resolved = next.references.find((item) => item.kind === 'skill')
    if (
      !previous?.resolvePastedName ||
      !resolved ||
      resolved.resolvePastedName ||
      previous.name !== resolved.name ||
      previous.scope !== resolved.scope
    )
      return
    applyEditorPrompt(next, true)
  }

  function markSuggestedPrompt(source?: AgentStarterPromptSource): void {
    promptOrigin.value = 'suggestion'
    // Cleared, not left stale, when the affordance did not identify itself: an
    // unattributed insert is not the previous chip's click.
    starterPrompt.value = source ?? null
  }

  function setErrorContext(context: AgentErrorContext): void {
    const references = prompt.value.references.filter(
      (item) => item.kind !== 'error'
    )
    const inserted = insertComposerReference(
      { text: draft.value, references },
      { kind: 'error', id: uuidv4(), context, textOffset: 0 },
      {
        textOffset: insertionPoint.value.textOffset,
        referenceIndex: prompt.value.references
          .slice(0, insertionPoint.value.referenceIndex)
          .filter((item) => item.kind !== 'error').length
      }
    )
    insertionPoint.value = inserted.insertion
    promptOrigin.value = 'error_context'
    starterPrompt.value = null
    resetPromptHistory()
    pendingCaret.value = inserted.insertion
    updateDraft(inserted.prompt)
  }

  function clearPendingCaret(): void {
    pendingCaret.value = null
  }

  function clearErrorContext(): void {
    const references = prompt.value.references.filter(
      (item) => item.kind !== 'error'
    )
    if (references.length === prompt.value.references.length) return
    if (promptOrigin.value === 'error_context') promptOrigin.value = 'typed'
    resetPromptHistory()
    updateDraft({
      text: resetTextWhenReferencesCleared(draft.value, references),
      references
    })
  }

  function snapshotReferences(next: PromptSnapshot): ComposerReference[] {
    return promptReferenceParts(
      next.text,
      next.workflowReferences,
      next.skillReference
    ).flatMap((part): ComposerReference[] => {
      if (part.type === 'text') return []
      if (part.type === 'workflow')
        return [{ ...part.reference, kind: 'workflow' }]
      return [{ ...part.reference, kind: 'skill', scope: skillScope ?? '' }]
    })
  }

  function replacePrompt(next: PromptSnapshot): void {
    promptOrigin.value = 'edited'
    starterPrompt.value = null
    resetPromptHistory()
    updateDraft({
      text: next.text,
      references: [
        ...snapshotReferences(next),
        ...prompt.value.references
          .filter((item) => item.kind !== 'workflow' && item.kind !== 'skill')
          .map((item) => ({
            ...item,
            textOffset: Math.min(item.textOffset, next.text.length)
          }))
      ].sort((a, b) => a.textOffset - b.textOffset)
    })
  }

  function restorePrompt(
    next: ComposerPrompt,
    included: ComposerAttachment[] = attachments.value
  ): void {
    for (const attachment of included) {
      const current = assetsById.get(attachment.id)
      const restored = {
        ...attachment,
        ...(current?.mediaUrl === attachment.mediaUrl &&
        current?.previewUrl &&
        !attachment.previewUrl
          ? { previewUrl: current.previewUrl }
          : {})
      }
      if (current) revokePreview(current, restored)
      assetsById.set(attachment.id, restored)
      retiredAssets.delete(attachment.id)
      ensureThumbnail(restored)
    }
    attachmentIds.value = included.map(({ id }) => id)
    resetPromptHistory()
    applyEditorPrompt(next)
    releaseUnusedAssets()
  }

  function replaceDraft(next: ComposerDraft): void {
    restorePrompt(
      {
        text: next.text,
        references: snapshotReferences(next)
      },
      next.attachments
    )
  }

  function setWorkflowReferences(references: WorkflowReference[]): void {
    updateDraft({
      text: draft.value,
      references: [
        ...references.map((item): ComposerReference => ({
          ...item,
          kind: 'workflow'
        })),
        ...prompt.value.references.filter((item) => item.kind !== 'workflow')
      ].sort((a, b) => a.textOffset - b.textOffset)
    })
  }

  function removeReference(key: string): void {
    const references = prompt.value.references.filter(
      (item) => composerReferenceKey(item) !== key
    )
    if (references.length !== prompt.value.references.length)
      updateDraft({
        text: resetTextWhenReferencesCleared(draft.value, references),
        references
      })
  }

  function removeWorkflowReference(id: string): void {
    removeReference(`workflow:${id}`)
  }

  function setNodeScope(scope: string | null): void {
    if (scope === nodeScope.value) return
    nodeScope.value = scope
    selectionModeNodeKeys.value = new Set()
    if (nodes.value.length === 0) return
    resetPromptHistory()
    const references = prompt.value.references.filter(
      (item) => item.kind !== 'node'
    )
    updateDraft({
      text: resetTextWhenReferencesCleared(draft.value, references),
      references
    })
  }

  function setNodes(next: SelectedNode[]): void {
    if (
      next.length === nodes.value.length &&
      next.every((node, index) => {
        const previous = nodes.value[index]
        return (
          node.id === previous.id &&
          node.locatorId === previous.locatorId &&
          node.title === previous.title
        )
      })
    )
      return
    const byKey = new Map(next.map((node) => [selectedNodeKey(node), node]))
    let result: ComposerPrompt = {
      text: draft.value,
      references: prompt.value.references.flatMap(
        (item): ComposerReference[] => {
          if (item.kind !== 'node') return [item]
          const node = byKey.get(selectedNodeKey(item.node))
          return node ? [{ ...item, node }] : []
        }
      )
    }
    if (nodeScope.value !== null) {
      for (const node of next) {
        if (
          result.references.some(
            (item) =>
              item.kind === 'node' &&
              selectedNodeKey(item.node) === selectedNodeKey(node)
          )
        )
          continue
        const inserted = insertComposerReference(
          result,
          {
            kind: 'node',
            node: { ...node },
            scope: nodeScope.value,
            textOffset: 0
          },
          insertionPoint.value
        )
        result = inserted.prompt
        insertionPoint.value = inserted.insertion
      }
    }
    updateDraft({
      ...result,
      text: resetTextWhenReferencesCleared(result.text, result.references)
    })
  }

  function setSelectionModeNodeKeys(keys: ReadonlySet<string>): void {
    const stagedKeys = new Set(nodes.value.map(selectedNodeKey))
    selectionModeNodeKeys.value = new Set(
      [...keys].filter((key) => stagedKeys.has(key))
    )
  }

  function setSkillScope(scope: string | null): void {
    if (scope === skillScope) return
    skillScope = scope
    if (!prompt.value.references.some((item) => item.kind === 'skill')) return
    resetPromptHistory()
    const references = prompt.value.references.filter(
      (item) => item.kind !== 'skill'
    )
    updateDraft({
      text: resetTextWhenReferencesCleared(draft.value, references),
      references
    })
  }

  function addAttachment(attachment: ComposerAttachment): boolean {
    if (assetsById.has(attachment.id) || retiredAssets.has(attachment.id))
      return false
    if (
      attachment.sourceKey &&
      attachments.value.some((item) => item.sourceKey === attachment.sourceKey)
    )
      return false
    assetsById.set(attachment.id, { ...attachment })
    attachmentIds.value = [...attachmentIds.value, attachment.id]
    ++revision.value
    ensureThumbnail(attachment)
    return true
  }

  function attachmentsOwning(
    sourceId: string
  ): readonly ComposerAttachment[] | undefined {
    if (attachmentIds.value.includes(sourceId)) return attachments.value
    for (const kept of keptDrafts.values()) {
      if (kept.attachmentIds.includes(sourceId))
        return kept.attachmentIds.flatMap((id) => assetsById.get(id) ?? [])
    }
    return undefined
  }

  function addAttachmentForSource(
    sourceId: string,
    attachment: ComposerAttachment
  ): boolean {
    if (attachmentIds.value.includes(sourceId)) return addAttachment(attachment)
    if (assetsById.has(attachment.id) || retiredAssets.has(attachment.id))
      return false
    for (const [key, kept] of keptDrafts) {
      if (!kept.attachmentIds.includes(sourceId)) continue
      const existing = kept.attachmentIds.flatMap(
        (id) => assetsById.get(id) ?? []
      )
      if (
        attachment.sourceKey &&
        existing.some((item) => item.sourceKey === attachment.sourceKey)
      )
        return false
      assetsById.set(attachment.id, { ...attachment })
      keptDrafts.set(key, {
        ...kept,
        attachmentIds: [...kept.attachmentIds, attachment.id]
      })
      ensureThumbnail(attachment)
      return true
    }
    return false
  }

  function referenceAttachment(id: string): boolean {
    const attachment = assetsById.get(id)
    if (!attachment || !attachmentIds.value.includes(id)) return false
    const inserted = insertComposerReference(
      prompt.value,
      { kind: 'asset', attachment: { ...attachment }, textOffset: 0 },
      insertionPoint.value
    )
    insertionPoint.value = inserted.insertion
    updateDraft(inserted.prompt)
    return true
  }

  function revokePreview(
    attachment: Pick<ComposerAttachment, 'previewUrl' | 'mediaUrl'>,
    retained?: ComposerAttachment
  ): void {
    const retainedUrls = new Set([retained?.previewUrl, retained?.mediaUrl])
    for (const url of new Set([attachment.previewUrl, attachment.mediaUrl]))
      if (url?.startsWith('blob:') && !retainedUrls.has(url))
        URL.revokeObjectURL(url)
  }

  function updateAttachment(
    id: string,
    patch: Partial<ComposerAttachment>
  ): void {
    const previous = assetsById.get(id)
    if (!previous) {
      revokePreview(patch)
      return
    }
    const attachment = { ...previous, ...patch, id }
    if (attachment.mediaUrl !== previous.mediaUrl) cancelThumbnail(id)
    revokePreview(previous, attachment)
    assetsById.set(id, attachment)
    if (patch.previewUrl)
      void assetPreviewUpdated.trigger({ id, previewUrl: patch.previewUrl })
    ensureThumbnail(attachment)
    if (
      prompt.value.references.some(
        (item) => item.kind === 'asset' && item.attachment.id === id
      )
    )
      updateDraft({
        text: draft.value,
        references: prompt.value.references.map((item) =>
          item.kind === 'asset' && item.attachment.id === id
            ? { ...item, attachment }
            : item
        )
      })
  }

  function removeAttachment(id: string): void {
    if (!isAssetRetained(id)) {
      cancelThumbnail(id)
      const attachment = assetsById.get(id)
      if (attachment) revokePreview(attachment)
      assetsById.delete(id)
      retiredAssets.add(id)
    }
    if (attachmentIds.value.includes(id)) {
      attachmentIds.value = attachmentIds.value.filter((item) => item !== id)
      ++revision.value
    }
    for (const [key, kept] of keptDrafts) {
      if (!kept.attachmentIds.includes(id)) continue
      keptDrafts.set(key, {
        ...kept,
        attachmentIds: kept.attachmentIds.filter((item) => item !== id)
      })
    }
    removeReference(`asset:${id}`)
  }

  function isAssetRetained(id: string): boolean {
    for (const ownerIds of retainedByOwner.values())
      if (ownerIds.has(id)) return true
    return false
  }

  function holdAssets(ids: readonly string[]): void {
    retainAssets('promptQueue', ids)
  }

  function retainAssets(ownerKey: string, ids: readonly string[]): void {
    if (ids.length === 0) retainedByOwner.delete(ownerKey)
    else retainedByOwner.set(ownerKey, new Set(ids))
  }

  function transferRetainedAssets(
    fromOwnerKey: string,
    toOwnerKey: string
  ): void {
    const ids = retainedByOwner.get(fromOwnerKey)
    retainedByOwner.delete(fromOwnerKey)
    if (ids && ids.size > 0) retainedByOwner.set(toOwnerKey, ids)
  }

  function releaseRetainedAssets(ownerKey: string): void {
    if (!retainedByOwner.delete(ownerKey)) return
    releaseUnusedAssets()
  }

  function releaseUnusedAssets(preserveAssetIds?: readonly string[]): void {
    const retained = new Set(attachments.value.map(({ id }) => id))
    for (const id of preserveAssetIds ?? []) retained.add(id)
    for (const ownerIds of retainedByOwner.values())
      for (const id of ownerIds) retained.add(id)
    for (const kept of keptDrafts.values())
      for (const id of kept.attachmentIds) retained.add(id)
    for (const [id, attachment] of assetsById)
      if (!retained.has(id)) {
        cancelThumbnail(id)
        revokePreview(attachment)
        assetsById.delete(id)
        retiredAssets.add(id)
      }
  }

  function startGateHold(
    clientMessageId: string,
    snapshot: GateHoldSnapshot = {
      prompt: prompt.value,
      attachments: [...attachments.value],
      nodes: [...nodes.value],
      targetInstanceId: null,
      promptOrigin: promptOrigin.value,
      starterPrompt: starterPrompt.value
    },
    backup: PendingSendBackupInput = {}
  ): number {
    holdPendingSendDraft(clientMessageId, backup)
    clearDraft()
    const id = ++nextGateHoldId
    gateHold.value = { id, clientMessageId, revision: revision.value, snapshot }
    return id
  }

  function releaseGateHold(id: number): void {
    if (gateHold.value?.id !== id) return
    gateHold.value = null
    releaseUnusedAssets()
  }

  function cancelGateHold(): GateHold | null {
    const held = gateHold.value
    if (!held) return null
    gateHold.value = null
    return held
  }

  function restoreSubmissionMeta(
    origin: AgentInputMethod,
    chip: AgentStarterPromptSource | null
  ): void {
    promptOrigin.value = origin
    starterPrompt.value = chip
  }

  function markRejectedDraft(): void {
    if (!draftState.value.text && attachmentIds.value.length === 0) return
    rejectedDraft.value = {
      prompt: {
        text: draftState.value.text,
        references: [...draftState.value.references]
      },
      attachmentIds: [...attachmentIds.value]
    }
  }

  function clearDraft(): void {
    resetPromptHistory()
    rejectedDraft.value = null
    promptOrigin.value = 'typed'
    starterPrompt.value = null
    attachmentIds.value = []
    updateDraft({ text: '', references: [] })
    insertionPoint.value = { textOffset: 0, referenceIndex: 0 }
    releaseUnusedAssets()
  }

  function toKeptPrompt(source: ComposerPrompt): ComposerPrompt {
    const references = source.references.filter((item) => item.kind !== 'node')
    return {
      text: resetTextWhenReferencesCleared(source.text, references),
      references
    }
  }

  function trimKeptDrafts(preserveAssetIds?: readonly string[]): void {
    let evicted = false
    for (const key of keptDrafts.keys()) {
      if (keptDrafts.size <= MAX_KEPT_DRAFTS) break
      keptDrafts.delete(key)
      evicted = true
    }
    if (evicted) releaseUnusedAssets(preserveAssetIds)
  }

  function keepActiveDraft(preserveAssetIds?: readonly string[]): void {
    if (activeDraftKey === null) return
    keptDrafts.delete(activeDraftKey)
    const keptPrompt = toKeptPrompt(prompt.value)
    const ids = attachments.value.map(({ id }) => id)
    if (
      keptPrompt.text.trim() === '' &&
      keptPrompt.references.length === 0 &&
      ids.length === 0
    )
      return
    keptDrafts.set(activeDraftKey, {
      prompt: keptPrompt,
      attachmentIds: ids,
      origin: promptOrigin.value,
      starterPrompt: starterPrompt.value
    })
    trimKeptDrafts(preserveAssetIds)
  }

  function restoreKeptDraft(kept: KeptDraft): void {
    rejectedDraft.value = null
    restorePrompt(
      kept.prompt,
      kept.attachmentIds.flatMap((id) => assetsById.get(id) ?? [])
    )
    promptOrigin.value = kept.origin
    starterPrompt.value = kept.starterPrompt
    insertionPoint.value = {
      textOffset: prompt.value.text.length,
      referenceIndex: prompt.value.references.length
    }
  }

  function activateDraft(key: string): void {
    if (key === activeDraftKey) return
    draftActivationCount += 1
    const adoptsCurrentContent = activeDraftKey === null
    const kept = adoptsCurrentContent ? undefined : keptDrafts.get(key)
    if (kept !== undefined) keptDrafts.delete(key)
    keepActiveDraft(kept?.attachmentIds)
    activeDraftKey = key
    if (adoptsCurrentContent) return
    restoreKeptDraft(kept ?? emptyKeptDraft())
  }

  function rekeyDraft(from: string, to: string): void {
    if (from === to) return
    for (const captured of activeCaptures) {
      if (captured.draftKey === from) captured.draftKey = to
    }
    if (activeDraftKey === from) {
      activeDraftKey = to
      return
    }
    const kept = keptDrafts.get(from)
    if (!kept) return
    keptDrafts.delete(from)
    keptDrafts.set(to, kept)
  }

  function restoreKeptDraftSnapshot(
    key: string,
    snapshot: GateHoldSnapshot
  ): void {
    if (key === activeDraftKey || keptDrafts.has(key)) return
    keptDrafts.set(key, {
      prompt: toKeptPrompt(snapshot.prompt),
      attachmentIds: snapshot.attachments.map(({ id }) => id),
      origin: snapshot.promptOrigin,
      starterPrompt: snapshot.starterPrompt
    })
    trimKeptDrafts()
  }

  function captureReferenceInsertion(
    from?: number,
    to?: number,
    point?: ComposerInsertionPoint
  ): CapturedReferenceInsertion {
    const expectedTrigger =
      from !== undefined && to !== undefined
        ? prompt.value.text.slice(
            Math.max(0, from),
            Math.max(Math.max(0, from), to)
          )
        : undefined
    const captured: CapturedReferenceInsertion = {
      draftKey: activeDraftKey,
      activationCount: draftActivationCount,
      from,
      to,
      expectedTrigger,
      insertionPoint: point ?? { ...insertionPoint.value }
    }
    activeCaptures.add(captured)
    for (const entry of activeCaptures) {
      if (activeCaptures.size <= MAX_ACTIVE_CAPTURES) break
      activeCaptures.delete(entry)
    }
    return captured
  }

  function isCapturedInsertionLive(
    captured: CapturedReferenceInsertion
  ): boolean {
    return (
      captured.draftKey === activeDraftKey &&
      captured.activationCount === draftActivationCount
    )
  }

  function insertWorkflowReferenceInDraft(
    captured: CapturedReferenceInsertion,
    reference: WorkflowReferenceMetadata
  ): void {
    if (!activeCaptures.delete(captured)) return
    const key = captured.draftKey
    if (key === activeDraftKey) {
      updateDraft(
        applyWorkflowReferenceToPrompt(prompt.value, reference, captured)
      )
      return
    }
    if (key === null) return
    const kept = keptDrafts.get(key) ?? emptyKeptDraft()
    keptDrafts.delete(key)
    keptDrafts.set(key, {
      ...kept,
      prompt: applyWorkflowReferenceToPrompt(kept.prompt, reference, captured)
    })
    trimKeptDrafts()
  }

  function discardDraft(key: string): void {
    for (const captured of activeCaptures) {
      if (captured.draftKey === key) activeCaptures.delete(captured)
    }
    if (key === activeDraftKey) clearDraft()
    else if (keptDrafts.delete(key)) releaseUnusedAssets()
  }

  const savedDraft = useSafeLocalStorage<unknown>(
    StorageKeys.agentComposerDraft(getWorkspaceId()),
    null,
    { serializer: StorageSerializers.object }
  )
  const savedPendingBackups = useSafeLocalStorage<unknown>(
    StorageKeys.agentPendingSendDraft(getWorkspaceId()),
    null,
    {
      serializer: StorageSerializers.object,
      flush: 'sync',
      listenToStorageChanges: false
    }
  )
  const draftThreadId = ref<string | null>()
  const draftTabPath = ref<string | null>()
  let deferredSavedBlankDraft: SavedDraft | null = null
  const deferredReloadBackups = shallowRef<PendingSendBackup[]>([])

  function readPendingSendBackups(): PendingSendBackup[] {
    const parsed = zPendingSendBackups.safeParse(savedPendingBackups.value)
    return parsed.success ? parsed.data : []
  }

  function writePendingSendBackups(backups: PendingSendBackup[]): void {
    savedPendingBackups.value =
      backups.length > 0 ? backups.slice(-MAX_PENDING_SEND_BACKUPS) : null
  }

  function resolveBackupInput(
    backup: PendingSendBackupInput
  ): Omit<PendingSendBackup, 'clientMessageId' | 'threadId'> | null {
    const text = backup.text ?? draftState.value.text
    const references = backup.workflowReferences ?? workflowReferences.value
    const expectedText =
      backup.expectedText ??
      composerPromptForSubmission(prompt.value).text.trim()
    if (
      expectedText === '' &&
      backup.expectedSkillName === undefined &&
      references.length === 0
    )
      return null
    return {
      ...(backup.tabPath === undefined ? {} : { tabPath: backup.tabPath }),
      text,
      workflowReferences: references,
      expectedText,
      expectedSkillName: backup.expectedSkillName,
      knownTurnIds: [...(backup.knownTurnIds ?? [])]
    }
  }

  function holdPendingSendDraft(
    clientMessageId: string,
    backup: PendingSendBackupInput = {}
  ): void {
    const threadId = draftThreadId.value
    if (threadId === undefined) return
    const resolved = resolveBackupInput(backup)
    if (resolved === null) return
    const remaining = readPendingSendBackups().filter(
      (entry) => entry.clientMessageId !== clientMessageId
    )
    writePendingSendBackups([
      ...remaining,
      { clientMessageId, threadId, ...resolved }
    ])
  }

  function transferPendingSendDraft(
    oldClientMessageId: string,
    newClientMessageId: string,
    threadId: string | null
  ): void {
    const backups = readPendingSendBackups()
    if (!backups.some((entry) => entry.clientMessageId === oldClientMessageId))
      return
    writePendingSendBackups(
      backups.map((entry) =>
        entry.clientMessageId === oldClientMessageId
          ? {
              ...entry,
              clientMessageId: newClientMessageId,
              threadId,
              tabPath: threadId === null ? entry.tabPath : undefined
            }
          : entry
      )
    )
  }

  function rebindPendingSendDrafts(
    clientMessageIds: readonly string[],
    threadId: string,
    knownTurnId: string
  ): void {
    if (clientMessageIds.length === 0) return
    const idSet = new Set(clientMessageIds)
    const backups = readPendingSendBackups()
    if (!backups.some((entry) => idSet.has(entry.clientMessageId))) return
    writePendingSendBackups(
      backups.map((entry) =>
        idSet.has(entry.clientMessageId)
          ? {
              ...entry,
              threadId,
              tabPath: undefined,
              knownTurnIds: entry.knownTurnIds.includes(knownTurnId)
                ? entry.knownTurnIds
                : [...entry.knownTurnIds, knownTurnId]
            }
          : entry
      )
    )
  }

  function clearPendingSendDraft(clientMessageId: string): void {
    const backups = readPendingSendBackups()
    const next = backups.filter(
      (entry) => entry.clientMessageId !== clientMessageId
    )
    if (next.length !== backups.length) writePendingSendBackups(next)
  }

  function classifyReloadBackups(
    backups: readonly PendingSendBackup[],
    hydratedTurns: readonly HydratedUserTurn[]
  ): {
    matchedIds: Set<string>
    latestUnmatched?: PendingSendBackup
  } {
    const claimed = new Set<string>()
    const matchedIds = new Set<string>()
    let latestUnmatched: PendingSendBackup | undefined
    for (const backup of backups) {
      const known = new Set(backup.knownTurnIds)
      const matched = hydratedTurns.find(
        (turn) =>
          !claimed.has(turn.turnId) &&
          !known.has(turn.turnId) &&
          matchesHydratedUserTurn(
            {
              text: backup.expectedText,
              skillName: backup.expectedSkillName,
              workflowReferences: backup.workflowReferences
            },
            turn
          )
      )
      if (matched) {
        claimed.add(matched.turnId)
        matchedIds.add(backup.clientMessageId)
      } else {
        latestUnmatched = backup
      }
    }
    return { matchedIds, latestUnmatched }
  }

  function reconcilePendingSendDraft(
    hydratedThreadId: string,
    hydratedTurns: readonly HydratedUserTurn[]
  ): void {
    const deferred = deferredReloadBackups.value.filter(
      (entry) => entry.threadId === hydratedThreadId
    )
    if (deferred.length === 0) return
    deferredReloadBackups.value = deferredReloadBackups.value.filter(
      (entry) => entry.threadId !== hydratedThreadId
    )
    const { matchedIds: consumedIds, latestUnmatched } = classifyReloadBackups(
      deferred,
      hydratedTurns
    )
    if (
      latestUnmatched &&
      !hasDraft.value &&
      draftThreadId.value === hydratedThreadId
    ) {
      replaceDraft({
        text: latestUnmatched.text,
        workflowReferences: latestUnmatched.workflowReferences,
        attachments: []
      })
      consumedIds.add(latestUnmatched.clientMessageId)
    }
    if (consumedIds.size === 0) return
    writePendingSendBackups(
      readPendingSendBackups().filter(
        (entry) => !consumedIds.has(entry.clientMessageId)
      )
    )
  }

  watch(
    [draftState, draftThreadId, draftTabPath],
    ([state, threadId, tabPath]) => {
      if (threadId === undefined) return
      if (threadId === null && tabPath === null) return
      const references = workflowReferences.value
      const hasContent = state.text.trim() !== '' || references.length > 0
      if (!hasContent && deferredSavedBlankDraft !== null) return
      savedDraft.value = hasContent
        ? {
            threadId,
            ...(threadId === null && tabPath !== undefined ? { tabPath } : {}),
            text: state.text,
            workflowReferences: references
          }
        : null
    }
  )

  function discardPendingSendBackupsForThread(threadId: string): void {
    deferredReloadBackups.value = deferredReloadBackups.value.filter(
      (entry) => entry.threadId !== threadId
    )
    const backups = readPendingSendBackups()
    const next = backups.filter((entry) => entry.threadId !== threadId)
    if (next.length !== backups.length) writePendingSendBackups(next)
  }

  function restoreDeferredBlankBackup(activeTabPath?: string | null): void {
    if (activeTabPath === null) return
    const matching = deferredReloadBackups.value.filter(
      (entry) =>
        entry.threadId === null &&
        (entry.tabPath === undefined ||
          activeTabPath === undefined ||
          entry.tabPath === activeTabPath)
    )
    if (matching.length === 0) return
    const handledIds = new Set(matching.map((entry) => entry.clientMessageId))
    deferredReloadBackups.value = deferredReloadBackups.value.filter(
      (entry) => !handledIds.has(entry.clientMessageId)
    )
    const latest = matching.at(-1)
    if (latest && !hasDraft.value) {
      replaceDraft({
        text: latest.text,
        workflowReferences: latest.workflowReferences,
        attachments: []
      })
      writePendingSendBackups(
        readPendingSendBackups().filter(
          (entry) => entry.clientMessageId !== latest.clientMessageId
        )
      )
    }
  }

  function restoreInitialPendingBackups(
    threadId: string | null,
    activeTabPath?: string | null
  ): void {
    const parsed = zPendingSendBackups.safeParse(savedPendingBackups.value)
    if (!parsed.success) {
      savedPendingBackups.value = null
      return
    }
    const kept = parsed.data.filter(
      (entry) =>
        entry.threadId !== null ||
        entry.tabPath !== undefined ||
        threadId === null
    )
    deferredReloadBackups.value = kept
    if (threadId === null) restoreDeferredBlankBackup(activeTabPath)
  }

  function restoreDeferredSavedBlankDraft(activeTabPath?: string | null): void {
    if (!activeTabPath || deferredSavedBlankDraft?.tabPath !== activeTabPath)
      return
    const saved = deferredSavedBlankDraft
    deferredSavedBlankDraft = null
    if (!hasDraft.value)
      replaceDraft({
        text: saved.text,
        workflowReferences: saved.workflowReferences,
        attachments: []
      })
  }

  function restoreInitialSavedDraft(
    threadId: string | null,
    activeTabPath?: string | null
  ): void {
    const saved = zSavedDraft.nullable().safeParse(savedDraft.value)
    if (!saved.success) {
      savedDraft.value = null
      return
    }
    const data = saved.data
    if (data === null) return
    if (data.threadId !== null) {
      if (data.threadId === threadId && !hasDraft.value)
        replaceDraft({
          text: data.text,
          workflowReferences: data.workflowReferences,
          attachments: []
        })
      return
    }
    if (activeTabPath === undefined) {
      if (data.tabPath === undefined && threadId === null && !hasDraft.value)
        replaceDraft({
          text: data.text,
          workflowReferences: data.workflowReferences,
          attachments: []
        })
      return
    }
    if (data.tabPath === undefined) return
    deferredSavedBlankDraft = data
    if (threadId === null) restoreDeferredSavedBlankDraft(activeTabPath)
  }

  function trackDraftThread(
    threadId: string | null,
    activeTabPath?: string | null
  ): void {
    if (draftThreadId.value === undefined) {
      restoreInitialSavedDraft(threadId, activeTabPath)
      if (savedPendingBackups.value !== null)
        restoreInitialPendingBackups(threadId, activeTabPath)
    } else if (threadId === null) {
      restoreDeferredSavedBlankDraft(activeTabPath)
      restoreDeferredBlankBackup(activeTabPath)
    }
    draftThreadId.value = threadId
    draftTabPath.value = activeTabPath
  }

  return {
    draftState,
    draft,
    attachments,
    workflowReferences,
    prompt,
    nodes,
    selectionModeNodeKeys,
    hasDraft,
    nodeScope,
    promptEpoch,
    promptOrigin,
    starterPrompt,
    errorContext,
    insertionPoint,
    gateHold,
    draftRevision: computed(() => revision.value),
    pendingCaret,
    clearPendingCaret,
    rejectedDraftUnchanged,
    markRejectedDraft,
    setText,
    prefillGreeting,
    setErrorContext,
    clearErrorContext,
    setInsertionPoint,
    resetPromptHistory,
    applyEditorPrompt,
    resolveSkillMetadata,
    markSuggestedPrompt,
    replacePrompt,
    restorePrompt,
    replaceDraft,
    setWorkflowReferences,
    removeWorkflowReference,
    removeReference,
    setNodeScope,
    setSkillScope,
    setNodes,
    setSelectionModeNodeKeys,
    addAttachment,
    attachmentsOwning,
    addAttachmentForSource,
    referenceAttachment,
    updateAttachment,
    removeAttachment,
    retainAssets,
    transferRetainedAssets,
    releaseRetainedAssets,
    onAssetPreviewUpdated: assetPreviewUpdated.on,
    releaseUnusedAssets,
    startGateHold,
    releaseGateHold,
    cancelGateHold,
    restoreSubmissionMeta,
    holdAssets,
    clearDraft,
    holdPendingSendDraft,
    transferPendingSendDraft,
    rebindPendingSendDrafts,
    clearPendingSendDraft,
    discardPendingSendBackupsForThread,
    reconcilePendingSendDraft,
    activateDraft,
    rekeyDraft,
    restoreKeptDraftSnapshot,
    captureReferenceInsertion,
    isCapturedInsertionLive,
    insertWorkflowReferenceInDraft,
    discardDraft,
    trackDraftThread
  }
})
