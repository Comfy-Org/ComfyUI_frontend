import { describe, expect, it } from 'vitest'

import type { ComposerPrompt } from '@/workbench/extensions/agent/types/composerPrompt'

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

function prompt(text: string): ComposerPrompt {
  return { text, references: [] }
}

function draft(text: string): PromptQueueDraft {
  return { prompt: prompt(text), attachments: [] }
}

function item(id: string, text = id): PromptQueueItem {
  return {
    id,
    text,
    attachments: [],
    prompt: prompt(text),
    references: [],
    nodes: []
  }
}

function apply(
  events: PromptQueueEvent[],
  initial: PromptQueueState = emptyPromptQueue()
): PromptQueueState {
  return events.reduce(reducePromptQueue, initial)
}

describe('reducePromptQueue', () => {
  it('appends queued items in submission order', () => {
    const state = apply([
      { type: 'enqueued', item: item('a', 'first') },
      { type: 'enqueued', item: item('b', 'second') }
    ])

    expect(state.items.map((entry) => entry.text)).toEqual(['first', 'second'])
    expect(visiblePromptQueueItems(state)).toHaveLength(2)
    expect(nextPromptQueueItem(state)?.id).toBe('a')
  })

  it('runs the next waiting item after the active item finishes', () => {
    const afterStart = apply([
      { type: 'enqueued', item: item('a') },
      { type: 'enqueued', item: item('b') },
      { type: 'started', id: 'a' }
    ])
    expect(nextPromptQueueItem(afterStart)).toBeUndefined()

    const afterFinish = reducePromptQueue(afterStart, {
      type: 'finished',
      id: 'a'
    })
    expect(afterFinish.items.map((entry) => entry.id)).toEqual(['b'])
    expect(afterFinish.runningId).toBeNull()
    expect(nextPromptQueueItem(afterFinish)?.id).toBe('b')
  })

  it('starts only a waiting item that is still in the queue', () => {
    const queued = apply([{ type: 'enqueued', item: item('a') }])

    expect(reducePromptQueue(queued, { type: 'started', id: 'missing' })).toBe(
      queued
    )
    expect(
      reducePromptQueue(
        { ...queued, runningId: 'a' },
        { type: 'started', id: 'b' }
      )
    ).toEqual({ ...queued, runningId: 'a' })
  })

  it('stashes the composer draft while a waiting item is edited', () => {
    const state = apply([
      { type: 'enqueued', item: item('a') },
      { type: 'enqueued', item: item('b', 'waiting') },
      { type: 'started', id: 'a' },
      { type: 'editStarted', id: 'b', draft: draft('unsent') }
    ])

    expect(state.editingId).toBe('b')
    expect(state.draft).toEqual(draft('unsent'))
    expect(visiblePromptQueueItems(state).map((entry) => entry.id)).toEqual([
      'a'
    ])
    expect(state.items.map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('does not start the item being edited while other items keep running', () => {
    const editing = apply([
      { type: 'enqueued', item: item('a') },
      { type: 'enqueued', item: item('b') },
      { type: 'enqueued', item: item('c') },
      { type: 'started', id: 'a' },
      { type: 'editStarted', id: 'b', draft: draft('draft') }
    ])
    expect(reducePromptQueue(editing, { type: 'started', id: 'b' })).toEqual(
      editing
    )

    const afterA = reducePromptQueue(editing, { type: 'finished', id: 'a' })
    expect(nextPromptQueueItem(afterA)?.id).toBe('c')
    expect(visiblePromptQueueItems(afterA).map((entry) => entry.id)).toEqual([
      'c'
    ])
  })

  it('appends the revised item and drops the stashed draft on submit', () => {
    const submitted = apply([
      { type: 'enqueued', item: item('a') },
      { type: 'enqueued', item: item('b', 'old') },
      { type: 'editStarted', id: 'b', draft: draft('keep me') },
      { type: 'editSubmitted', item: item('b', 'revised') }
    ])

    expect(submitted.editingId).toBeNull()
    expect(submitted.draft).toBeNull()
    expect(submitted.items.map((entry) => entry.text)).toEqual(['a', 'revised'])
    expect(nextPromptQueueItem(submitted)?.id).toBe('a')
  })

  it('restores the unchanged item to its original position on cancel', () => {
    const cancelled = apply([
      { type: 'enqueued', item: item('a') },
      { type: 'enqueued', item: item('b') },
      { type: 'enqueued', item: item('c') },
      { type: 'editStarted', id: 'b', draft: draft('keep me') },
      { type: 'editCancelled' }
    ])

    expect(cancelled.editingId).toBeNull()
    expect(cancelled.draft).toBeNull()
    expect(cancelled.items.map((entry) => entry.id)).toEqual(['a', 'b', 'c'])
    expect(nextPromptQueueItem(cancelled)?.id).toBe('a')
  })

  it('does not start edit on the active item', () => {
    const running = apply([
      { type: 'enqueued', item: item('a') },
      { type: 'started', id: 'a' }
    ])
    const draftState = draft('keep')

    expect(
      reducePromptQueue(running, {
        type: 'editStarted',
        id: 'a',
        draft: draftState
      })
    ).toBe(running)
  })

  it('removes a waiting item and leaves the others', () => {
    const state = apply([
      { type: 'enqueued', item: item('a') },
      { type: 'enqueued', item: item('b') },
      { type: 'enqueued', item: item('c') },
      { type: 'started', id: 'a' },
      { type: 'deleted', id: 'b' }
    ])

    expect(state.items.map((entry) => entry.id)).toEqual(['a', 'c'])
    expect(state.runningId).toBe('a')
  })

  it('does not delete the active item or the item being edited', () => {
    const running = apply([
      { type: 'enqueued', item: item('a') },
      { type: 'started', id: 'a' }
    ])
    expect(reducePromptQueue(running, { type: 'deleted', id: 'a' })).toBe(
      running
    )

    const editing = apply([
      { type: 'enqueued', item: item('a') },
      { type: 'enqueued', item: item('b') },
      { type: 'editStarted', id: 'b', draft: draft('keep') }
    ])
    expect(reducePromptQueue(editing, { type: 'deleted', id: 'b' })).toBe(
      editing
    )
  })

  it('toggles expanded and clears back to the empty queue', () => {
    const collapsed = apply([
      { type: 'enqueued', item: item('a') },
      { type: 'toggled' }
    ])
    expect(collapsed.expanded).toBe(false)
    expect(reducePromptQueue(collapsed, { type: 'cleared' })).toEqual(
      emptyPromptQueue()
    )
  })
})
