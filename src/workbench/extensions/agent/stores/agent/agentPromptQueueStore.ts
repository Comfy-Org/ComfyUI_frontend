import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'
import type { WorkflowReference } from '@/workbench/extensions/agent/types/workflowReference'

import type {
  PromptQueueDraft,
  PromptQueueEvent,
  PromptQueueItem
} from './promptQueueState'
import {
  emptyPromptQueue,
  nextPromptQueueItem,
  reducePromptQueue,
  visiblePromptQueueItems
} from './promptQueueState'

export const useAgentPromptQueueStore = defineStore('agentPromptQueue', () => {
  const composer = useAgentComposerStore()
  const state = shallowRef(emptyPromptQueue())
  let nextId = 0

  const items = computed(() => visiblePromptQueueItems(state.value))
  const count = computed(() => items.value.length)
  const expanded = computed(() => state.value.expanded)
  const runningId = computed(() => state.value.runningId)
  const editingId = computed(() => state.value.editingId)
  const nextItem = computed(() => nextPromptQueueItem(state.value))
  const hasWaiting = computed(() =>
    items.value.some((item) => item.id !== state.value.runningId)
  )

  function allocateId(): string {
    nextId += 1
    return `prompt-queue-${nextId}`
  }

  function dispatch(event: PromptQueueEvent): void {
    state.value = reducePromptQueue(state.value, event)
    composer.holdAssets(heldAssetIds())
  }

  function heldAssetIds(): string[] {
    const ids = state.value.items.flatMap((item) =>
      item.attachments.map((attachment) => attachment.id)
    )
    for (const attachment of state.value.draft?.attachments ?? [])
      ids.push(attachment.id)
    return ids
  }

  function snapshotDraft(): PromptQueueDraft {
    return {
      prompt: composer.prompt,
      attachments: [...composer.attachments]
    }
  }

  function captureItem(
    id: string,
    text: string,
    attachments: ComposerAttachment[],
    references: WorkflowReference[]
  ): PromptQueueItem {
    return {
      id,
      text,
      attachments: [...attachments],
      prompt: {
        text: composer.prompt.text,
        references: [...composer.prompt.references]
      },
      references: [...references],
      nodes: [...composer.nodes]
    }
  }

  function enqueueFromComposer(
    text: string,
    attachments: ComposerAttachment[],
    references: WorkflowReference[]
  ): PromptQueueItem {
    const item = captureItem(allocateId(), text, attachments, references)
    dispatch({ type: 'enqueued', item })
    return item
  }

  function begin(id: string): boolean {
    if (state.value.runningId) return false
    dispatch({ type: 'started', id })
    return state.value.runningId === id
  }

  function finish(id: string): void {
    dispatch({ type: 'finished', id })
  }

  function startEdit(id: string): boolean {
    if (state.value.runningId === id) return false
    const queued = state.value.items.find((item) => item.id === id)
    if (!queued || state.value.editingId) return false
    const draft = snapshotDraft()
    dispatch({ type: 'editStarted', id, draft })
    if (state.value.editingId !== id) return false
    composer.restorePrompt(queued.prompt, queued.attachments)
    return true
  }

  function submitEdit(
    text: string,
    attachments: ComposerAttachment[],
    references: WorkflowReference[]
  ): boolean {
    const editingId = state.value.editingId
    const draft = state.value.draft
    if (editingId === null || !draft) return false
    const item = captureItem(editingId, text, attachments, references)
    dispatch({ type: 'editSubmitted', item })
    composer.restorePrompt(draft.prompt, draft.attachments)
    return true
  }

  function cancelEdit(): boolean {
    const draft = state.value.draft
    if (state.value.editingId === null || !draft) return false
    dispatch({ type: 'editCancelled' })
    composer.restorePrompt(draft.prompt, draft.attachments)
    return true
  }

  function deleteItem(id: string): void {
    dispatch({ type: 'deleted', id })
  }

  function toggle(): void {
    dispatch({ type: 'toggled' })
  }

  function clear(): void {
    dispatch({ type: 'cleared' })
  }

  function clearComposerDraft(): void {
    composer.clearDraft()
  }

  return {
    items,
    count,
    hasWaiting,
    expanded,
    runningId,
    editingId,
    nextItem,
    enqueueFromComposer,
    begin,
    finish,
    startEdit,
    submitEdit,
    cancelEdit,
    deleteItem,
    toggle,
    clear,
    clearComposerDraft
  }
})
