import { useLocalStorage, useTimestamp } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { AgentThreadSummary } from '../../schemas/agentApiSchema'

export interface ChatSession {
  id: string
  title: string
  updatedAt: number
  status: AgentThreadSummary['status']
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

export function groupSessionsByRecency(
  sessions: ChatSession[],
  activeId: string | null,
  now: number
): HistoryGroups {
  const startToday = startOfLocalDay(now)
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
  let refreshGeneration = 0
  const now = useTimestamp({ interval: 60_000 })

  // The server owns thread titles but has no rename or delete endpoint yet
  // (BE-3130), so renames live in a local overlay applied over the server
  // titles and deletes in a local tombstone set filtered out of every refresh.
  const customTitles = useLocalStorage<Partial<Record<string, string>>>(
    'Comfy.Agent.ChatTitles',
    {}
  )
  const deletedIds = useLocalStorage<string[]>('Comfy.Agent.DeletedThreads', [])

  const titled = computed(() =>
    sessions.value.map((session) => {
      const custom = customTitles.value[session.id]
      return custom === undefined ? session : { ...session, title: custom }
    })
  )

  const grouped = computed(() =>
    groupSessionsByRecency(titled.value, activeId.value, now.value)
  )

  function titleFor(id: string | null): string | undefined {
    return id === null ? undefined : customTitles.value[id]
  }

  function rename(id: string, title: string): void {
    const trimmed = title.trim()
    if (trimmed === '') return
    customTitles.value = { ...customTitles.value, [id]: trimmed }
  }

  function remove(id: string): void {
    sessions.value = sessions.value.filter((item) => item.id !== id)
    const { [id]: _removed, ...rest } = customTitles.value
    customTitles.value = rest
    if (!deletedIds.value.includes(id))
      deletedIds.value = [...deletedIds.value, id]
    if (activeId.value === id) activeId.value = null
  }

  function beginRefresh(): number {
    return refreshGeneration
  }

  function replaceAll(
    next: ChatSession[],
    generation: number = refreshGeneration
  ): void {
    if (generation !== refreshGeneration) return
    sessions.value = next.filter(
      (session) => !deletedIds.value.includes(session.id)
    )
  }

  function clear(): void {
    refreshGeneration++
    sessions.value = []
    activeId.value = null
  }

  function setActive(id: string | null): void {
    activeId.value = id
  }

  return {
    sessions,
    activeId,
    grouped,
    titleFor,
    rename,
    remove,
    beginRefresh,
    replaceAll,
    clear,
    setActive
  }
})
