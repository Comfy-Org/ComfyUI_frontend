import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue')
  return {
    currentUser: {
      resolvedUserInfo: ref({ id: 'user-1' } as { id: string } | null)
    },
    workspace: { activeWorkspaceId: ref('workspace-1' as string | null) }
  }
})

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => mocks.currentUser
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => mocks.workspace
}))

import type { ChatSession } from './agentChatHistoryStore'
import {
  groupSessionsByRecency,
  useAgentChatHistoryStore
} from './agentChatHistoryStore'

const NOW = new Date(2026, 2, 15, 12, 0, 0).getTime()
const DAY = 86_400_000

const session = (id: string, updatedAt: number): ChatSession => ({
  id,
  title: id,
  updatedAt
})

describe('groupSessionsByRecency', () => {
  it('buckets by recency, newest first, with the active session as Current', () => {
    const sessions = [
      session('active', NOW - 5 * DAY),
      session('earlyToday', NOW - 6 * 3_600_000),
      session('now', NOW - 1_000),
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

  it('buckets the prior evening as yesterday', () => {
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
    setActivePinia(createPinia())
    localStorage.clear()
    mocks.currentUser.resolvedUserInfo.value = { id: 'user-1' }
    mocks.workspace.activeWorkspaceId.value = 'workspace-1'
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

  it('[09-T1 regression] replaceAll clears only an active id absent from the retained sessions', () => {
    const store = useAgentChatHistoryStore()
    store.setActive('a')
    store.replaceAll([session('b', NOW)])
    expect(store.activeId).toBeNull()
    expect(store.grouped.today.map(({ id }) => id)).toEqual(['b'])

    store.setActive('a')
    store.replaceAll([session('a', NOW), session('b', NOW - 1)])
    expect(store.activeId).toBe('a')
    expect(store.grouped.current.map(({ id }) => id)).toEqual(['a'])
  })

  it('[09-T2 regression] tolerates malformed persisted title and tombstone shapes', async () => {
    const invalidPairs = [
      ['null', '[]'],
      ['7', '[]'],
      ['["bad"]', '[]'],
      ['{"a":"ok","b":7}', '[]'],
      ['{}', '{"a":true}'],
      ['{}', '["a",7]']
    ]
    for (const [titles, deleted] of invalidPairs) {
      localStorage.setItem('Comfy.Agent.ChatTitles.user-1.workspace-1', titles)
      localStorage.setItem(
        'Comfy.Agent.DeletedThreads.user-1.workspace-1',
        deleted
      )
      setActivePinia(createPinia())
      const store = useAgentChatHistoryStore()
      expect(() => store.replaceAll([session('a', NOW)])).not.toThrow()
      expect(() => store.rename('a', 'safe')).not.toThrow()
      expect(() => store.remove('a')).not.toThrow()
      await nextTick()
    }
  })

  it('persists a rename and a tombstone across a pinia re-instantiation', async () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', NOW - 1_000), session('b', NOW - 2_000)])
    store.rename('a', 'Kept title')
    store.remove('b')
    await nextTick()

    setActivePinia(createPinia())
    const reloaded = useAgentChatHistoryStore()
    expect(reloaded.titleFor('a')).toBe('Kept title')
    reloaded.replaceAll([session('a', NOW - 1_000), session('b', NOW - 2_000)])
    expect(reloaded.sessions.map((s) => s.id)).toEqual(['a'])
    expect(reloaded.titleFor('a')).toBe('Kept title')
  })

  it('[09-T3 regression] rotates persisted metadata and clears the in-memory list on account change', async () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', NOW - 1_000)])
    store.rename('a', 'Account one')
    await nextTick()

    expect(
      localStorage.getItem('Comfy.Agent.ChatTitles.user-1.workspace-1')
    ).toContain('Account one')

    mocks.currentUser.resolvedUserInfo.value = { id: 'user-2' }
    await nextTick()

    expect(store.sessions).toHaveLength(0)
    expect(store.titleFor('a')).toBeUndefined()
    expect(
      localStorage.getItem('Comfy.Agent.ChatTitles.user-2.workspace-1')
    ).toBe('{}')

    mocks.currentUser.resolvedUserInfo.value = { id: 'user-1' }
    await nextTick()
    expect(store.titleFor('a')).toBe('Account one')
  })
})
