import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'
import type { WorkflowReference } from '@/workbench/extensions/agent/types/workflowReference'

import type {
  PromptQueueDraft,
  PromptQueueEvent,
  PromptQueueItem,
  PromptQueueState
} from './promptQueueState'
import {
  emptyPromptQueue,
  nextPromptQueueItem,
  reducePromptQueue,
  visiblePromptQueueItems
} from './promptQueueState'

const MAX_KEPT_QUEUES = 64

export const useAgentPromptQueueStore = defineStore('agentPromptQueue', () => {
  const composer = useAgentComposerStore()
  const panel = useAgentPanelStore()
  const keptQueues = new Map<string, PromptQueueState>()
  let activeChatKey: string | null = null
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

  function collectStateAssetIds(
    queueState: PromptQueueState,
    ids: string[]
  ): void {
    for (const item of queueState.items)
      for (const attachment of item.attachments) ids.push(attachment.id)
    for (const attachment of queueState.draft?.attachments ?? [])
      ids.push(attachment.id)
  }

  function heldAssetIds(): string[] {
    const ids: string[] = []
    collectStateAssetIds(state.value, ids)
    for (const kept of keptQueues.values()) collectStateAssetIds(kept, ids)
    return ids
  }

  function trimKeptQueues(): void {
    for (const key of keptQueues.keys()) {
      if (keptQueues.size <= MAX_KEPT_QUEUES) break
      keptQueues.delete(key)
    }
  }

  function isQueueNonEmpty(queueState: PromptQueueState): boolean {
    return queueState.items.length > 0 || queueState.runningId !== null
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
      nodes: [...composer.nodes],
      target: panel.selectedWorkflow
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

  function applyToRunningQueue(
    id: string,
    event: Extract<PromptQueueEvent, { type: 'finished' | 'released' }>
  ): void {
    if (state.value.runningId === id) {
      dispatch(event)
      return
    }
    for (const [key, kept] of keptQueues) {
      if (kept.runningId !== id) continue
      const next = reducePromptQueue(kept, event)
      if (isQueueNonEmpty(next)) keptQueues.set(key, next)
      else keptQueues.delete(key)
      composer.holdAssets(heldAssetIds())
      return
    }
  }

  function release(id: string): void {
    applyToRunningQueue(id, { type: 'released', id })
  }

  function finish(id: string): void {
    applyToRunningQueue(id, { type: 'finished', id })
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

  function activateQueue(key: string): void {
    if (key === activeChatKey) return
    const adoptsCurrentContent = activeChatKey === null
    if (!adoptsCurrentContent && state.value.editingId !== null) cancelEdit()
    const restored = adoptsCurrentContent ? undefined : keptQueues.get(key)
    if (restored !== undefined) keptQueues.delete(key)
    if (activeChatKey !== null) {
      keptQueues.delete(activeChatKey)
      if (isQueueNonEmpty(state.value)) {
        keptQueues.set(activeChatKey, state.value)
        trimKeptQueues()
      }
    }
    activeChatKey = key
    if (adoptsCurrentContent) return
    state.value = restored ?? emptyPromptQueue()
    composer.holdAssets(heldAssetIds())
  }

  function rekeyQueue(from: string, to: string): void {
    if (from === to) return
    if (activeChatKey === from) {
      activeChatKey = to
      keptQueues.delete(to)
      return
    }
    const kept = keptQueues.get(from)
    if (!kept) return
    keptQueues.delete(from)
    keptQueues.set(to, kept)
    composer.holdAssets(heldAssetIds())
  }

  function discardQueue(key: string): void {
    if (key === activeChatKey) clear()
    else if (keptQueues.delete(key)) {
      composer.holdAssets(heldAssetIds())
      composer.releaseUnusedAssets()
    }
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
    release,
    finish,
    startEdit,
    submitEdit,
    cancelEdit,
    deleteItem,
    toggle,
    clear,
    activateQueue,
    rekeyQueue,
    discardQueue,
    clearComposerDraft
  }
})
