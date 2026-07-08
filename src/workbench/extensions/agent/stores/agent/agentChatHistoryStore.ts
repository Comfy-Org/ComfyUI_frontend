import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface ChatSession {
  id: string
  title: string
  // epoch ms of the last activity in the session
  updatedAt: number
}

export interface HistoryGroups {
  current: ChatSession[]
  today: ChatSession[]
  yesterday: ChatSession[]
  earlier: ChatSession[]
}

function startOfLocalDay(now: number): number {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * Bucket sessions into Current / Today / Yesterday / Earlier, newest first. Pure and
 * `now`-injected so tests pin the clock. The active session is always "Current"
 * regardless of its timestamp.
 */
export function groupSessionsByRecency(
  sessions: ChatSession[],
  activeId: string | null,
  now: number
): HistoryGroups {
  const startToday = startOfLocalDay(now)
  // Local-day start of the day before, not startToday - 24h, so a DST transition (a 23h or
  // 25h day) doesn't misbucket the yesterday boundary.
  const startYesterday = startOfLocalDay(startToday - 1)
  const groups: HistoryGroups = {
    current: [],
    today: [],
    yesterday: [],
    earlier: []
  }
  const ordered = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
  for (const session of ordered) {
    if (session.id === activeId) groups.current.push(session)
    else if (session.updatedAt >= startToday) groups.today.push(session)
    else if (session.updatedAt >= startYesterday) groups.yesterday.push(session)
    else groups.earlier.push(session)
  }
  return groups
}

export const useAgentChatHistoryStore = defineStore('agentChatHistory', () => {
  const sessions = ref<ChatSession[]>([])
  const activeId = ref<string | null>(null)

  const grouped = computed(() =>
    groupSessionsByRecency(sessions.value, activeId.value, Date.now())
  )

  function upsert(session: ChatSession): void {
    const index = sessions.value.findIndex((item) => item.id === session.id)
    if (index >= 0) sessions.value[index] = session
    else sessions.value = [session, ...sessions.value]
  }

  function remove(id: string): void {
    sessions.value = sessions.value.filter((item) => item.id !== id)
    if (activeId.value === id) activeId.value = null
  }

  // Replace the whole list from an authoritative server fetch (GET /api/agent/threads).
  function replaceAll(next: ChatSession[]): void {
    sessions.value = next
  }

  function setActive(id: string | null): void {
    activeId.value = id
  }

  return {
    sessions,
    activeId,
    grouped,
    upsert,
    remove,
    replaceAll,
    setActive
  }
})
