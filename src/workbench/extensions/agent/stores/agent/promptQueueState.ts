import type { SelectedNode } from '@/workbench/extensions/agent/composables/agent/useCanvasSelection'
import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'
import type { ComposerPrompt } from '@/workbench/extensions/agent/types/composerPrompt'
import type { WorkflowReference } from '@/workbench/extensions/agent/types/workflowReference'

export type PromptQueueDraft = {
  prompt: ComposerPrompt
  attachments: ComposerAttachment[]
}

export type PromptQueueItem = {
  id: string
  text: string
  attachments: ComposerAttachment[]
  prompt: ComposerPrompt
  references: WorkflowReference[]
  nodes: SelectedNode[]
}

export type PromptQueueState = {
  items: PromptQueueItem[]
  runningId: string | null
  editingId: string | null
  draft: PromptQueueDraft | null
  expanded: boolean
}

export type PromptQueueEvent =
  | { type: 'enqueued'; item: PromptQueueItem }
  | { type: 'started'; id: string }
  | { type: 'finished'; id: string }
  | { type: 'editStarted'; id: string; draft: PromptQueueDraft }
  | { type: 'editSubmitted'; item: PromptQueueItem }
  | { type: 'editCancelled' }
  | { type: 'deleted'; id: string }
  | { type: 'toggled' }
  | { type: 'cleared' }

export function emptyPromptQueue(): PromptQueueState {
  return {
    items: [],
    runningId: null,
    editingId: null,
    draft: null,
    expanded: true
  }
}

export function visiblePromptQueueItems(
  state: PromptQueueState
): PromptQueueItem[] {
  return state.items.filter((item) => item.id !== state.editingId)
}

export function nextPromptQueueItem(
  state: PromptQueueState
): PromptQueueItem | undefined {
  if (state.runningId) return undefined
  return state.items.find((item) => item.id !== state.editingId)
}

function itemById(
  items: PromptQueueItem[],
  id: string
): PromptQueueItem | undefined {
  return items.find((item) => item.id === id)
}

function withoutItem(items: PromptQueueItem[], id: string): PromptQueueItem[] {
  return items.filter((item) => item.id !== id)
}

function reduceStarted(state: PromptQueueState, id: string): PromptQueueState {
  if (state.runningId || state.editingId === id) return state
  if (!itemById(state.items, id)) return state
  return { ...state, runningId: id }
}

function reduceFinished(state: PromptQueueState, id: string): PromptQueueState {
  if (state.runningId !== id) return state
  return {
    ...state,
    runningId: null,
    items: withoutItem(state.items, id)
  }
}

function reduceEditStarted(
  state: PromptQueueState,
  id: string,
  draft: PromptQueueDraft
): PromptQueueState {
  if (state.editingId || state.runningId === id) return state
  if (!itemById(state.items, id)) return state
  return { ...state, editingId: id, draft }
}

function reduceEditSubmitted(
  state: PromptQueueState,
  item: PromptQueueItem
): PromptQueueState {
  if (state.editingId === null) return state
  return {
    ...state,
    items: [...withoutItem(state.items, state.editingId), item],
    editingId: null,
    draft: null
  }
}

function reduceEditCancelled(state: PromptQueueState): PromptQueueState {
  if (state.editingId === null) return state
  return { ...state, editingId: null, draft: null }
}

function reduceDeleted(state: PromptQueueState, id: string): PromptQueueState {
  if (state.runningId === id || state.editingId === id) return state
  if (!itemById(state.items, id)) return state
  return { ...state, items: withoutItem(state.items, id) }
}

export function reducePromptQueue(
  state: PromptQueueState,
  event: PromptQueueEvent
): PromptQueueState {
  switch (event.type) {
    case 'enqueued':
      return { ...state, items: [...state.items, event.item] }
    case 'started':
      return reduceStarted(state, event.id)
    case 'finished':
      return reduceFinished(state, event.id)
    case 'editStarted':
      return reduceEditStarted(state, event.id, event.draft)
    case 'editSubmitted':
      return reduceEditSubmitted(state, event.item)
    case 'editCancelled':
      return reduceEditCancelled(state)
    case 'deleted':
      return reduceDeleted(state, event.id)
    case 'toggled':
      return { ...state, expanded: !state.expanded }
    case 'cleared':
      return emptyPromptQueue()
  }
}
