import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

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
    setActivePinia(createPinia())
    localStorage.clear()
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

  // #16206 ADAPT: main and integration-truth PRs #16373/#16375 do not expose
  // account/workspace-scoped history persistence yet; enable with that surface.
  it.todo('clears only an active id absent from refreshed sessions')
  it.todo('tolerates malformed persisted title and tombstone shapes')
  it.todo('rotates persisted metadata when the account or workspace changes')
})
