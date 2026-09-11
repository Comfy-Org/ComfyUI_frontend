import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import type { ComposerAttachment } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import type {
  PromptSnapshot,
  WorkflowReference
} from '../../types/workflowReference'

interface ComposerDraft extends PromptSnapshot {
  attachments: ComposerAttachment[]
}

interface SubmittedDraft {
  draft: string
  attachments: ComposerAttachment[]
  references: WorkflowReference[]
  nodes: SelectedNode[]
  target: ComfyWorkflow
}

export const useAgentComposerStore = defineStore('agentComposer', () => {
  const draftState = shallowRef<ComposerDraft>({
    text: '',
    workflowReferences: [],
    attachments: []
  })
  const draft = computed(() => draftState.value.text)
  const attachments = computed(() => draftState.value.attachments)
  const workflowReferences = computed(() => draftState.value.workflowReferences)
  const prompt = computed<PromptSnapshot>(() => ({
    text: draftState.value.text,
    workflowReferences: draftState.value.workflowReferences
  }))
  const submission = shallowRef<{
    id: number
    phase: 'pending' | 'failed'
    stopRequested: boolean
    revision: number
    snapshot: SubmittedDraft
  } | null>(null)
  let revision = 0
  let nextSubmissionId = 0

  function markEdited(): void {
    ++revision
  }

  function updateDraft(next: ComposerDraft): void {
    markEdited()
    draftState.value = next
  }

  function setText(text: string): void {
    if (text !== draft.value) updateDraft({ ...draftState.value, text })
  }

  function replacePrompt(next: PromptSnapshot): void {
    updateDraft({
      ...draftState.value,
      text: next.text,
      workflowReferences: next.workflowReferences.map((reference) => ({
        ...reference
      }))
    })
  }

  function replaceDraft(next: ComposerDraft): void {
    updateDraft({
      text: next.text,
      workflowReferences: next.workflowReferences.map((reference) => ({
        ...reference
      })),
      attachments: next.attachments.map((attachment) => ({ ...attachment }))
    })
  }

  function setWorkflowReferences(references: WorkflowReference[]): void {
    replacePrompt({ text: draft.value, workflowReferences: references })
  }

  function removeWorkflowReference(id: string): void {
    const references = workflowReferences.value.filter(
      (reference) => reference.id !== id
    )
    if (references.length !== workflowReferences.value.length)
      setWorkflowReferences(references)
  }

  function addAttachment(attachment: ComposerAttachment): void {
    if (attachments.value.some((item) => item.id === attachment.id)) return
    updateDraft({
      ...draftState.value,
      attachments: [...attachments.value, { ...attachment }]
    })
  }

  function updateAttachment(
    id: string,
    patch: Partial<ComposerAttachment>
  ): void {
    if (!attachments.value.some((item) => item.id === id)) return
    updateDraft({
      ...draftState.value,
      attachments: attachments.value.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    })
  }

  function removeAttachment(id: string): ComposerAttachment | undefined {
    const removed = attachments.value.find((item) => item.id === id)
    if (removed)
      updateDraft({
        ...draftState.value,
        attachments: attachments.value.filter((item) => item.id !== id)
      })
    return removed
  }

  function startSubmission(snapshot: SubmittedDraft): number {
    replaceDraft({ text: '', workflowReferences: [], attachments: [] })
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
    submission,
    setText,
    replacePrompt,
    replaceDraft,
    setWorkflowReferences,
    removeWorkflowReference,
    addAttachment,
    updateAttachment,
    removeAttachment,
    markEdited,
    startSubmission,
    requestSubmissionStop,
    settleSubmission,
    takeFailedSubmission,
    invalidateSubmission
  }
})
