import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import type { ComposerAttachment } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import type { WorkflowReference } from '../../types/workflowReference'

interface SubmittedDraft {
  draft: string
  attachments: ComposerAttachment[]
  references: WorkflowReference[]
  nodes: SelectedNode[]
  target: ComfyWorkflow
}

export const useAgentComposerStore = defineStore('agentComposer', () => {
  const draft = ref('')
  const attachments = ref<ComposerAttachment[]>([])
  const workflowReferences = ref<WorkflowReference[]>([])
  const submission = shallowRef<{
    id: number
    phase: 'pending' | 'failed'
    revision: number
    snapshot: SubmittedDraft
  } | null>(null)
  let revision = 0
  let nextSubmissionId = 0

  function markEdited(): void {
    ++revision
  }

  watch([draft, attachments, workflowReferences], markEdited, {
    deep: true,
    flush: 'sync'
  })

  function startSubmission(snapshot: SubmittedDraft): number {
    draft.value = ''
    attachments.value = []
    workflowReferences.value = []
    const id = ++nextSubmissionId
    submission.value = { id, phase: 'pending', revision, snapshot }
    return id
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
    draft,
    attachments,
    workflowReferences,
    submission,
    markEdited,
    startSubmission,
    settleSubmission,
    takeFailedSubmission,
    invalidateSubmission
  }
})
