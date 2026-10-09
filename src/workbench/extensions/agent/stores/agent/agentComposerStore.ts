import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, shallowReactive, shallowRef } from 'vue'

import { getMediaTypeFromFilename } from '@/utils/formatUtil'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import type { ComposerAttachment } from '../../types/composerAttachment'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { selectedNodeKey } from '../../composables/agent/useCanvasSelection'
import type {
  ComposerInsertionPoint,
  ComposerPrompt,
  ComposerReference
} from '../../types/composerPrompt'
import { composerReferenceKey } from '../../types/composerPrompt'
import type {
  PromptSnapshot,
  WorkflowReference
} from '../../types/workflowReference'
import { insertComposerReference } from '../../utils/composerPrompt'
import { createVideoThumbnail } from '../../utils/videoThumbnail'
import type { AgentStarterPromptSource } from '../../utils/starterPrompts'
import type { AgentInputMethod } from '@/platform/telemetry/types'

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

interface SubmittedDraft {
  attachments: ComposerAttachment[]
  nodes: SelectedNode[]
  target: ComfyWorkflow
  prompt: ComposerPrompt
}

export const useAgentComposerStore = defineStore('agentComposer', () => {
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
  const nodeScope = ref<string | null>(null)
  const promptEpoch = ref(0)
  const promptOrigin = ref<AgentInputMethod>('typed')
  const starterPrompt = ref<AgentStarterPromptSource | null>(null)
  const insertionPoint = shallowRef<ComposerInsertionPoint>({
    textOffset: 0,
    referenceIndex: 0
  })
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
  const submission = shallowRef<{
    id: number
    phase: 'pending' | 'failed'
    stopRequested: boolean
    revision: number
    origin: AgentInputMethod
    starterPrompt: AgentStarterPromptSource | null
    snapshot: SubmittedDraft
  } | null>(null)
  let revision = 0
  let nextSubmissionId = 0

  function updateDraft(next: ComposerPrompt): void {
    ++revision
    draftState.value = next
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

  function markSuggestedPrompt(source?: AgentStarterPromptSource): void {
    promptOrigin.value = 'suggestion'
    starterPrompt.value = source ?? null
  }

  function applyEditorPrompt(next: ComposerPrompt): void {
    const seen = new Set<string>()
    const references = next.references.flatMap((item): ComposerReference[] => {
      const key = composerReferenceKey(item)
      if (item.kind !== 'asset' && seen.has(key)) return []
      seen.add(key)
      if (item.kind === 'node' && item.scope !== nodeScope.value) return []
      if (item.kind !== 'asset') return [item]
      if (!attachmentIds.value.includes(item.attachment.id)) return []
      const attachment = assetsById.get(item.attachment.id)
      if (!attachment) return []
      return [{ ...item, attachment }]
    })
    updateDraft({ text: next.text, references })
  }

  function replacePrompt(next: PromptSnapshot): void {
    resetPromptHistory()
    updateDraft({
      text: next.text,
      references: [
        ...next.workflowReferences.map(
          (item): ComposerReference => ({ ...item, kind: 'workflow' })
        ),
        ...prompt.value.references
          .filter((item) => item.kind !== 'workflow')
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
        references: next.workflowReferences
          .map((item): ComposerReference => ({ ...item, kind: 'workflow' }))
          .sort((a, b) => a.textOffset - b.textOffset)
      },
      next.attachments
    )
  }

  function setWorkflowReferences(references: WorkflowReference[]): void {
    updateDraft({
      text: draft.value,
      references: [
        ...references.map(
          (item): ComposerReference => ({ ...item, kind: 'workflow' })
        ),
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
    resetPromptHistory()
    if (nodes.value.length === 0) return
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
    ++revision
    ensureThumbnail(attachment)
    return true
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
    cancelThumbnail(id)
    const attachment = assetsById.get(id)
    if (attachment) revokePreview(attachment)
    assetsById.delete(id)
    retiredAssets.add(id)
    if (attachmentIds.value.includes(id)) {
      attachmentIds.value = attachmentIds.value.filter((item) => item !== id)
      ++revision
    }
    removeReference(`asset:${id}`)
  }

  function releaseUnusedAssets(): void {
    const retained = new Set(attachments.value.map(({ id }) => id))
    for (const attachment of submission.value?.snapshot.attachments ?? [])
      retained.add(attachment.id)
    for (const [id, attachment] of assetsById)
      if (!retained.has(id)) {
        cancelThumbnail(id)
        revokePreview(attachment)
        assetsById.delete(id)
        retiredAssets.add(id)
      }
  }

  function startSubmission(snapshot: SubmittedDraft): number {
    resetPromptHistory()
    const origin = promptOrigin.value
    const chip = starterPrompt.value
    promptOrigin.value = 'typed'
    starterPrompt.value = null
    attachmentIds.value = []
    updateDraft({ text: '', references: [] })
    insertionPoint.value = { textOffset: 0, referenceIndex: 0 }
    const id = ++nextSubmissionId
    submission.value = {
      id,
      phase: 'pending',
      stopRequested: false,
      revision,
      origin,
      starterPrompt: chip,
      snapshot
    }
    return id
  }

  function requestSubmissionStop(): boolean {
    const pending = submission.value
    if (pending?.phase !== 'pending') return false
    submission.value = { ...pending, stopRequested: true }
    return true
  }

  function settleSubmission(id: number, sent: boolean): void {
    const pending = submission.value
    if (pending?.id !== id) return
    submission.value =
      sent || pending.revision !== revision
        ? null
        : { ...pending, phase: 'failed' }
    releaseUnusedAssets()
  }

  function takeFailedSubmission(): SubmittedDraft | undefined {
    const failed = submission.value
    if (failed?.phase !== 'failed') return
    submission.value = null
    if (failed.revision === revision) {
      promptOrigin.value = failed.origin
      starterPrompt.value = failed.starterPrompt
      return failed.snapshot
    }
  }

  function invalidateSubmission(): void {
    submission.value = null
    releaseUnusedAssets()
  }

  return {
    draftState,
    draft,
    attachments,
    workflowReferences,
    prompt,
    nodes,
    nodeScope,
    promptEpoch,
    promptOrigin,
    starterPrompt,
    insertionPoint,
    submission,
    setText,
    setInsertionPoint,
    resetPromptHistory,
    markSuggestedPrompt,
    applyEditorPrompt,
    replacePrompt,
    restorePrompt,
    replaceDraft,
    setWorkflowReferences,
    removeWorkflowReference,
    removeReference,
    setNodeScope,
    setNodes,
    addAttachment,
    referenceAttachment,
    updateAttachment,
    removeAttachment,
    releaseUnusedAssets,
    startSubmission,
    requestSubmissionStop,
    settleSubmission,
    takeFailedSubmission,
    invalidateSubmission
  }
})
