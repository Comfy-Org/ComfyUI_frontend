import { describe, expect, it } from 'vitest'

import {
  fakeBrowserStorage,
  manyTurns,
  oneTurn,
  withUnsent
} from './historyFixtures'
import { createHistoryKeeper } from './historyKeeper'
import type { HistorySettings } from './historyKeeper'
import { historyKey } from './historyStorage'
import { emptyConversation } from './turns'

const settings: HistorySettings = {
  enabled: true,
  maxCharsPerWorkflow: 100_000,
  maxWorkflows: 20
}

function keeperOn(
  storage: ReturnType<typeof fakeBrowserStorage>,
  overrides: Partial<HistorySettings> = {},
  now: () => number = () => 1000
) {
  return createHistoryKeeper(() => storage, { ...settings, ...overrides }, now)
}

describe('createHistoryKeeper', () => {
  it('HS-01, HS-02: what was kept for a workflow is there after a reload, and only for that workflow', () => {
    const storage = fakeBrowserStorage()
    keeperOn(storage).keep('workflow-w', withUnsent(), null)

    const afterReload = keeperOn(storage)

    expect(afterReload.load('workflow-w')).toEqual(withUnsent())
    expect(afterReload.load('workflow-v')).toBe(emptyConversation)
    expect([...storage.entries.keys()]).toEqual([historyKey('workflow-w')])
  })

  it('HS-03: within one page each workflow gets its own history back', () => {
    const keeper = keeperOn(fakeBrowserStorage())
    keeper.keep('workflow-w', oneTurn(), null)
    keeper.keep('workflow-v', withUnsent(), null)

    expect(keeper.load('workflow-w')).toEqual(oneTurn())
    expect(keeper.load('workflow-v')).toEqual(withUnsent())
  })

  it('HS-04: without a workflow the history is kept in memory only, apart from every workflow', () => {
    const storage = fakeBrowserStorage()
    const keeper = keeperOn(storage)

    keeper.keep(null, oneTurn(), null)

    expect(storage.entries.size).toBe(0)
    expect(keeper.load(null)).toEqual(oneTurn())
    expect(keeper.load('workflow-w')).toBe(emptyConversation)
    expect(keeperOn(storage).load(null)).toBe(emptyConversation)
    expect(keeper.unsaved.value).toBe(false)
  })

  it('HS-07: a follow-up that was waiting comes back as an unsent question', () => {
    const storage = fakeBrowserStorage()
    keeperOn(storage).keep('workflow-w', oneTurn(), {
      commentId: 'comment-1',
      text: 'and taller?'
    })

    expect(keeperOn(storage).load('workflow-w').unsent).toMatchObject([
      {
        comment: 'and taller?',
        targets: oneTurn().turns[0].comments[0].targets
      }
    ])
  })

  it('HS-08, HS-09: keeping a history with nothing left removes the stored entry', () => {
    const storage = fakeBrowserStorage()
    const keeper = keeperOn(storage)
    keeper.keep('workflow-w', oneTurn(), null)

    keeper.keep('workflow-w', emptyConversation, null)

    expect(storage.entries.size).toBe(0)
    expect(keeper.load('workflow-w')).toBe(emptyConversation)
    expect(keeperOn(storage).load('workflow-w')).toBe(emptyConversation)
  })

  it('HS-10: an entry that cannot be read is ignored, and the next save replaces it', () => {
    const storage = fakeBrowserStorage()
    storage.entries.set(historyKey('workflow-w'), '{"version":0,"turns":"?"}')
    const keeper = keeperOn(storage)

    expect(keeper.load('workflow-w')).toBe(emptyConversation)

    keeper.keep('workflow-w', oneTurn(), null)
    expect(keeperOn(storage).load('workflow-w')).toEqual(oneTurn())
  })

  it('HS-11: the stored copy is cut to the cap; the page itself keeps everything until it is reloaded', () => {
    const storage = fakeBrowserStorage()
    const long = manyTurns(6, 2000)
    const keeper = keeperOn(storage, { maxCharsPerWorkflow: 1600 })

    keeper.keep('workflow-w', long, null)

    const stored = storage.entries.get(historyKey('workflow-w')) ?? ''
    const afterReload = keeperOn(storage).load('workflow-w')
    expect(stored.length).toBeLessThanOrEqual(1600)
    expect(keeper.load('workflow-w')).toEqual(long)
    expect(afterReload.turns.length).toBeGreaterThan(0)
    expect(afterReload.turns.length).toBeLessThan(6)
    expect(afterReload.turns.at(-1)?.id).toBe(long.turns.at(-1)?.id)
    expect(afterReload.turns.every((kept) => kept.thinking === '')).toBe(true)
  })

  it('HS-12: with more workflows than the limit, the least recently saved histories go', () => {
    const storage = fakeBrowserStorage()
    let clock = 0
    const keeper = keeperOn(storage, { maxWorkflows: 2 }, () => (clock += 1))
    keeper.keep('workflow-a', oneTurn(), null)
    keeper.keep('workflow-b', oneTurn(), null)
    keeper.keep('workflow-a', withUnsent(), null)
    storage.entries.set('Comfy.Other.setting', 'kept')

    keeper.keep('workflow-c', oneTurn(), null)

    expect(storage.entries.size).toBe(3)
    expect([...storage.entries.keys()]).toEqual(
      expect.arrayContaining([
        'Comfy.Other.setting',
        historyKey('workflow-a'),
        historyKey('workflow-c')
      ])
    )
  })

  it.for([
    { name: 'switched off', keeper: () => keeperOnNothing({ enabled: false }) },
    {
      name: 'given no storage',
      keeper: () => createHistoryKeeper(null, settings)
    }
  ])(
    'HS-13: $name, nothing is read or written and the page still keeps each history',
    ({ keeper: create }) => {
      const keeper = create()

      keeper.keep('workflow-w', oneTurn(), null)

      expect(keeper.load('workflow-w')).toEqual(oneTurn())
      expect(keeper.unsaved.value).toBe(false)
    }
  )

  it('HS-17: a save that fails is said, the page keeps the history, and a later save that works clears it', () => {
    const storage = fakeBrowserStorage()
    const keeper = keeperOn(storage)
    storage.isFull = true

    keeper.keep('workflow-w', oneTurn(), null)

    expect(keeper.unsaved.value).toBe(true)
    expect(keeper.load('workflow-w')).toEqual(oneTurn())
    expect(keeperOn(storage).load('workflow-w')).toBe(emptyConversation)

    storage.isFull = false
    keeper.keep('workflow-w', withUnsent(), null)

    expect(keeper.unsaved.value).toBe(false)
    expect(keeperOn(storage).load('workflow-w')).toEqual(withUnsent())
  })

  it('HS-17: storage that cannot even be opened is a failed save, not a silent one', () => {
    const keeper = createHistoryKeeper(() => {
      throw new DOMException('blocked', 'SecurityError')
    }, settings)

    expect(keeper.load('workflow-w')).toBe(emptyConversation)
    expect(keeper.unsaved.value).toBe(false)

    keeper.keep('workflow-w', oneTurn(), null)

    expect(keeper.unsaved.value).toBe(true)
    expect(keeper.load('workflow-w')).toEqual(oneTurn())
  })
})

function keeperOnNothing(overrides: Partial<HistorySettings>) {
  const storage = fakeBrowserStorage()
  storage.entries.set(historyKey('workflow-w'), 'never read')
  const reads = { count: 0 }
  const keeper = createHistoryKeeper(
    () => {
      reads.count += 1
      return storage
    },
    { ...settings, ...overrides }
  )
  return {
    ...keeper,
    keep: (...kept: Parameters<typeof keeper.keep>) => {
      keeper.keep(...kept)
      if (reads.count > 0 || storage.entries.size !== 1)
        throw new Error('The storage was used while switched off')
    }
  }
}
