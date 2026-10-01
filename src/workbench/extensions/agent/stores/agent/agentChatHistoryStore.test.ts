import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import type { ChatSession } from './agentChatHistoryStore'
import {
  groupSessionsByRecency,
  useAgentChatHistoryStore
} from './agentChatHistoryStore'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

const NOW = new Date(2026, 2, 15, 12, 0, 0).getTime()
const DAY = 86_400_000

const session = (
  id: string,
  updatedAt: number,
  isTitleFallback = false
): ChatSession => ({
  id,
  title: id,
  updatedAt,
  isTitleFallback
})

describe('groupSessionsByRecency', () => {
  it('buckets by recency, newest first, with the active session as Current', () => {
    const sessions = [
      session('now', NOW - 1_000),
      session('active', NOW - 5 * DAY),
      session('earlyToday', NOW - 6 * 3_600_000),
      session('yesterday', NOW - DAY),
      session('lastWeek', NOW - 4 * DAY)
    ]
    const groups = groupSessionsByRecency(sessions, 'active', NOW)

    expect(groups.current.map((s) => s.id)).toEqual(['active'])
    expect(groups.today.map((s) => s.id)).toEqual(['now', 'earlyToday'])
    expect(groups.yesterday.map((s) => s.id)).toEqual(['yesterday'])
    expect(groups.earlier.map((s) => s.id)).toEqual(['lastWeek'])
  })

  it('places everything in earlier when nothing is recent and none is active', () => {
    const groups = groupSessionsByRecency(
      [session('old', NOW - 30 * DAY)],
      null,
      NOW
    )
    expect(groups.current).toHaveLength(0)
    expect(groups.earlier.map((s) => s.id)).toEqual(['old'])
  })

  it('buckets the prior evening as yesterday across a spring-forward midnight', () => {
    const now = new Date(2026, 2, 8, 2, 30).getTime()
    const priorEvening = new Date(2026, 2, 7, 23, 30).getTime()
    const groups = groupSessionsByRecency(
      [session('priorEvening', priorEvening)],
      null,
      now
    )

    expect(groups.yesterday.map((s) => s.id)).toEqual(['priorEvening'])
    expect(groups.earlier).toHaveLength(0)
  })
})

describe('useAgentChatHistoryStore', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('overlays a rename onto the grouped list and titleFor', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', NOW - 1_000)])
    store.setActive('a')

    store.rename('a', '  Duck pipeline  ')

    expect(store.titleFor('a')).toBe('Duck pipeline')
    expect(store.grouped.current[0]).toMatchObject({
      id: 'a',
      title: 'Duck pipeline'
    })
  })

  it('ignores a whitespace-only rename', () => {
    const store = useAgentChatHistoryStore()
    store.rename('a', '   ')

    expect(store.titleFor('a')).toBeUndefined()
  })

  it('drops the rename override with the session', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', 1)])
    store.rename('a', 'kept?')

    store.remove('a')

    expect(store.titleFor('a')).toBeUndefined()
  })

  it('holds a removed session out of later refreshes', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', 1), session('b', 2)])

    store.remove('a')
    store.replaceAll([session('a', 1), session('b', 2)])

    expect(store.sessions.map((s) => s.id)).toEqual(['b'])
  })

  it('clears the active id when the active session is removed', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', 1)])
    store.setActive('a')
    store.remove('a')

    expect(store.activeId).toBeNull()
    expect(store.sessions).toHaveLength(0)
  })

  it('keeps the active id when a different session is removed', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', 1), session('b', 2)])
    store.setActive('a')
    store.remove('b')

    expect(store.activeId).toBe('a')
  })

  it('restores titles and tombstones only from the current scope', () => {
    sessionStorage.setItem(
      'Comfy.Workspace.Current',
      JSON.stringify({ type: 'team', id: 'workspace-b' })
    )
    localStorage.setItem(
      StorageKeys.agentChatTitles('workspace-b'),
      JSON.stringify({ a: 'Scoped title' })
    )
    localStorage.setItem(
      StorageKeys.agentDeletedThreads('workspace-b'),
      JSON.stringify(['deleted'])
    )
    localStorage.setItem(
      'Comfy.Agent.ChatTitles',
      JSON.stringify({ a: 'Legacy title' })
    )
    localStorage.setItem(
      'Comfy.Agent.DeletedThreads',
      JSON.stringify(['visible'])
    )

    const store = useAgentChatHistoryStore()
    store.replaceAll([
      session('a', 1),
      session('deleted', 2),
      session('visible', 3)
    ])

    expect(store.titleFor('a')).toBe('Scoped title')
    expect(store.sessions.map(({ id }) => id)).toEqual(['a', 'visible'])
    expect(localStorage.getItem('Comfy.Agent.ChatTitles')).toBeNull()
    expect(localStorage.getItem('Comfy.Agent.DeletedThreads')).toBeNull()
  })

  it('does not apply titles or tombstones from another workspace', () => {
    sessionStorage.setItem(
      'Comfy.Workspace.Current',
      JSON.stringify({ type: 'team', id: 'workspace-b' })
    )
    localStorage.setItem(
      StorageKeys.agentChatTitles('workspace-a'),
      JSON.stringify({ a: 'Workspace A title' })
    )
    localStorage.setItem(
      StorageKeys.agentDeletedThreads('workspace-a'),
      JSON.stringify(['a'])
    )

    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', 1)])

    expect(store.titleFor('a')).toBeUndefined()
    expect(store.sessions.map(({ id }) => id)).toEqual(['a'])
  })

  it('overlays a derived session title without changing the server snapshot', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', 1), session('b', 2)])

    store.patchTitle('a', 'Clear entire canvas')

    expect(store.sessions.map((s) => ({ id: s.id, title: s.title }))).toEqual([
      { id: 'a', title: 'a' },
      { id: 'b', title: 'b' }
    ])
  })

  it('reflects a patched title in the grouped list immediately', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', NOW - 1_000, true)])
    store.setActive('a')

    store.patchTitle('a', 'Clear entire canvas')

    expect(store.grouped.current[0]).toMatchObject({
      id: 'a',
      title: 'Clear entire canvas'
    })
  })

  it('ignores a whitespace-only title patch', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', 1)])

    store.patchTitle('a', '   ')

    expect(store.sessions[0]?.title).toBe('a')
  })

  it('applies a derived title when the session arrives in a later refresh', () => {
    const store = useAgentChatHistoryStore()
    store.patchTitle('unknown-thread', 'Clear entire canvas')
    store.replaceAll([session('unknown-thread', 1, true)])

    expect(store.grouped.earlier[0]).toMatchObject({
      id: 'unknown-thread',
      title: 'Clear entire canvas'
    })
  })

  it('keeps a derived title across server-list refreshes', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', NOW - 1_000, true)])
    store.patchTitle('a', 'Clear entire canvas')

    store.replaceAll([session('a', NOW - 1_000, true)])

    expect(store.grouped.today[0]?.title).toBe('Clear entire canvas')
  })

  it('keeps a server-authored title ahead of a derived title', () => {
    const store = useAgentChatHistoryStore()
    store.patchTitle('a', 'Raw first message')

    store.replaceAll([session('a', NOW - 1_000)])

    expect(store.grouped.today[0]?.title).toBe('a')
  })

  it('removes a session with no server request', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', 1)])

    store.remove('a')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(store.sessions).toHaveLength(0)
    fetchSpy.mockRestore()
  })
})
