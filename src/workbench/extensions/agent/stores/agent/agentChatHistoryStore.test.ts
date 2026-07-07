import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ChatSession } from './agentChatHistoryStore'
import {
  groupSessionsByRecency,
  useAgentChatHistoryStore
} from './agentChatHistoryStore'

// A fixed reference moment: 2026-03-15 12:00 local.
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
    // NOW is 02:30 just after the US spring-forward (2026-03-08 02:00 -> 03:00), so today
    // is a 23h day. A session at 23:30 the evening before must land in Yesterday. This pins
    // the startYesterday = startOfLocalDay(startToday - 1) intent: a naive startToday - 24h
    // drifts the yesterday boundary off local midnight around a DST transition. Constructed
    // with a local Date; in a non-DST test TZ it degrades to a plain day-boundary check,
    // which is still the correct bucket.
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
  beforeEach(() => setActivePinia(createPinia()))

  it('updates a session in place rather than duplicating it', () => {
    const store = useAgentChatHistoryStore()
    store.upsert(session('a', 1))
    store.upsert(session('b', 2))
    store.upsert({ id: 'a', title: 'renamed', updatedAt: 9 })

    expect(store.sessions).toHaveLength(2)
    expect(store.sessions.find((s) => s.id === 'a')).toMatchObject({
      title: 'renamed',
      updatedAt: 9
    })
  })

  it('prepends a new session so the newest sorts first', () => {
    const store = useAgentChatHistoryStore()
    store.upsert(session('a', 1))
    store.upsert(session('b', 2))

    expect(store.sessions.map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('clears the active id when the active session is removed', () => {
    const store = useAgentChatHistoryStore()
    store.upsert(session('a', 1))
    store.setActive('a')
    store.remove('a')

    expect(store.activeId).toBeNull()
    expect(store.sessions).toHaveLength(0)
  })

  it('keeps the active id when a different session is removed', () => {
    const store = useAgentChatHistoryStore()
    store.upsert(session('a', 1))
    store.upsert(session('b', 2))
    store.setActive('a')
    store.remove('b')

    expect(store.activeId).toBe('a')
  })
})
