import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import type { ComposerAttachment } from '../../composables/agent/useComposer'
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

interface ComposerDraft extends PromptSnapshot {
  attachments: ComposerAttachment[]
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
  const attachments = computed(() =>
    prompt.value.references.flatMap((item) =>
      item.kind === 'asset' ? [item.attachment] : []
    )
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
  const insertionPoint = shallowRef<ComposerInsertionPoint>({
    textOffset: 0,
    referenceIndex: 0
  })
  // Detached assets stay available to the editor's Undo history until it unmounts.
  const undoAssets = new Map<string, ComposerAttachment>()
  const retiredAssets = new Set<string>()
  const submission = shallowRef<{
    id: number
    phase: 'pending' | 'failed'
    stopRequested: boolean
    revision: number
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

  function applyEditorPrompt(next: ComposerPrompt): void {
    const seen = new Set<string>()
    const references = next.references.flatMap((item): ComposerReference[] => {
      const key = composerReferenceKey(item)
      if (seen.has(key)) return []
      seen.add(key)
      if (item.kind === 'node' && item.scope !== nodeScope.value) return []
      if (item.kind !== 'asset') return [item]
      if (retiredAssets.has(item.attachment.id)) return []
      const attachment = undoAssets.get(item.attachment.id) ?? item.attachment
      undoAssets.set(attachment.id, attachment)
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

  function restorePrompt(next: ComposerPrompt): void {
    resetPromptHistory()
    applyEditorPrompt(next)
  }

  function replaceDraft(next: ComposerDraft): void {
    for (const attachment of next.attachments) {
      undoAssets.set(attachment.id, { ...attachment })
      retiredAssets.delete(attachment.id)
    }
    restorePrompt({
      text: next.text,
      references: [
        ...next.workflowReferences.map(
          (item): ComposerReference => ({ ...item, kind: 'workflow' })
        ),
        ...next.attachments.map(
          (attachment): ComposerReference => ({
            kind: 'asset',
            attachment: { ...attachment },
            textOffset: next.text.length
          })
        )
      ].sort((a, b) => a.textOffset - b.textOffset)
    })
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
      updateDraft({ text: draft.value, references })
  }

  function removeWorkflowReference(id: string): void {
    removeReference(`workflow:${id}`)
  }

  function setNodeScope(scope: string | null): void {
    if (scope === nodeScope.value) return
    nodeScope.value = scope
    resetPromptHistory()
    if (nodes.value.length === 0) return
    updateDraft({
      text: draft.value,
      references: prompt.value.references.filter((item) => item.kind !== 'node')
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
    updateDraft(result)
  }

  function addAttachment(attachment: ComposerAttachment): void {
    if (undoAssets.has(attachment.id) || retiredAssets.has(attachment.id))
      return
    undoAssets.set(attachment.id, { ...attachment })
    const inserted = insertComposerReference(
      prompt.value,
      { kind: 'asset', attachment: { ...attachment }, textOffset: 0 },
      insertionPoint.value
    )
    insertionPoint.value = inserted.insertion
    updateDraft(inserted.prompt)
  }

  function revokePreview(attachment: ComposerAttachment): void {
    if (attachment.previewUrl?.startsWith('blob:'))
      URL.revokeObjectURL(attachment.previewUrl)
  }

  function updateAttachment(
    id: string,
    patch: Partial<ComposerAttachment>
  ): void {
    const previous = undoAssets.get(id)
    if (!previous) {
      if (patch.previewUrl?.startsWith('blob:'))
        URL.revokeObjectURL(patch.previewUrl)
      return
    }
    if (
      patch.previewUrl !== undefined &&
      patch.previewUrl !== previous.previewUrl
    )
      revokePreview(previous)
    const attachment = { ...previous, ...patch, id }
    undoAssets.set(id, attachment)
    if (!attachments.value.some((item) => item.id === id)) return
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
    const attachment = undoAssets.get(id)
    if (attachment) revokePreview(attachment)
    undoAssets.delete(id)
    retiredAssets.add(id)
    removeReference(`asset:${id}`)
  }

  function releaseUnusedAssets(): void {
    const retained = new Set(attachments.value.map(({ id }) => id))
    for (const attachment of submission.value?.snapshot.attachments ?? [])
      retained.add(attachment.id)
    for (const [id, attachment] of undoAssets)
      if (!retained.has(id)) {
        revokePreview(attachment)
        undoAssets.delete(id)
        retiredAssets.add(id)
      }
  }

  function startSubmission(snapshot: SubmittedDraft): number {
    resetPromptHistory()
    updateDraft({ text: '', references: [] })
    insertionPoint.value = { textOffset: 0, referenceIndex: 0 }
    const id = ++nextSubmissionId
    submission.value = {
      id,
      phase: 'pending',
      stopRequested: false,
      revision,
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
    if (failed.revision === revision) return failed.snapshot
  }

  function invalidateSubmission(): void {
    submission.value = null
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
    insertionPoint,
    submission,
    setText,
    setInsertionPoint,
    resetPromptHistory,
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
