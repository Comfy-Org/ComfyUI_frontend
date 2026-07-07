import { describe, expect, it } from 'vitest'

import type { ChatSession } from './agentChatHistoryStore'
import { groupSessionsByRecency } from './agentChatHistoryStore'

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
})
