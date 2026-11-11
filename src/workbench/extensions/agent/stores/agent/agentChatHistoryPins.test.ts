import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  getWorkspaceId,
  StorageKeys
} from '@/platform/workflow/persistence/base/storageKeys'

import type { ChatSession } from './agentChatHistoryStore'
import {
  groupSessionsByRecency,
  useAgentChatHistoryStore
} from './agentChatHistoryStore'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

const NOW = new Date(2026, 2, 15, 12, 0, 0).getTime()
const DAY = 86_400_000

const session = (id: string, updatedAt: number): ChatSession => ({
  id,
  title: id,
  updatedAt,
  titleSource: 'server'
})

describe('groupSessionsByRecency with pins', () => {
  it('lists pinned chats in their own group, newest first', () => {
    const groups = groupSessionsByRecency(
      [
        session('today', NOW - 1_000),
        session('pinnedOld', NOW - 9 * DAY),
        session('pinnedNew', NOW - 2 * DAY)
      ],
      null,
      NOW,
      new Set(['pinnedOld', 'pinnedNew'])
    )

    expect(groups.pinned?.map(({ id }) => id)).toEqual([
      'pinnedNew',
      'pinnedOld'
    ])
    expect(groups.today.map(({ id }) => id)).toEqual(['today'])
    expect(groups.earlier).toEqual([])
  })

  it('has no pinned group when pins are not asked for', () => {
    const groups = groupSessionsByRecency([session('a', NOW)], null, NOW)

    expect(groups).not.toHaveProperty('pinned')
  })
})

describe('useAgentChatHistoryStore pins', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('pins and unpins a chat, keeping it in the place the sidebar shows', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', NOW - 1_000), session('b', NOW - 2_000)])

    store.togglePin('b')

    expect(store.pinnedIds.has('b')).toBe(true)
    expect(store.groupedInPlace.pinned?.map(({ id }) => id)).toEqual(['b'])
    expect(store.groupedInPlace.today.map(({ id }) => id)).toEqual(['a'])

    store.togglePin('b')

    expect(store.pinnedIds.has('b')).toBe(false)
    expect(store.groupedInPlace.pinned).toEqual([])
  })

  it('leaves the open chat in its own place in the sidebar grouping', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', NOW - 1_000)])
    store.setActive('a')

    expect(store.groupedInPlace.current).toEqual([])
    expect(store.groupedInPlace.today.map(({ id }) => id)).toEqual(['a'])
    expect(store.grouped.current.map(({ id }) => id)).toEqual(['a'])
  })

  it('keeps the docked grouping free of a pinned group', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', NOW - 1_000)])

    store.togglePin('a')

    expect(store.grouped).not.toHaveProperty('pinned')
    expect(store.grouped.today.map(({ id }) => id)).toEqual(['a'])
  })

  it('still lists a pinned chat that the server page no longer includes', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('old', NOW - 40 * DAY)])
    store.togglePin('old')

    store.replaceAll([session('recent', NOW - 1_000)])

    expect(store.groupedInPlace.pinned?.map(({ id }) => id)).toEqual(['old'])
  })

  it('shows a renamed title on a pinned chat', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', NOW - 1_000)])
    store.togglePin('a')

    store.rename('a', 'Fox portrait')

    expect(store.groupedInPlace.pinned?.[0].title).toBe('Fox portrait')
  })

  it('unpins a chat when it is deleted', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', NOW - 1_000)])
    store.togglePin('a')

    store.remove('a')

    expect(store.pinnedIds.has('a')).toBe(false)
    expect(store.groupedInPlace.pinned).toEqual([])
  })

  it('ignores a pin for a chat it does not know', () => {
    const store = useAgentChatHistoryStore()

    store.togglePin('missing')

    expect(store.pinnedIds.size).toBe(0)
  })

  it('remembers pins for the workspace', async () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', NOW - 1_000)])

    store.togglePin('a')
    await nextTick()

    expect(
      Object.keys(
        JSON.parse(
          localStorage.getItem(
            StorageKeys.agentPinnedThreads(getWorkspaceId())
          ) ?? '{}'
        )
      )
    ).toEqual(['a'])
  })
})
