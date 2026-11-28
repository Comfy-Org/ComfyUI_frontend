import { useTimestamp } from '@vueuse/core'
import { orderBy } from 'es-toolkit'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { useAccountStorage } from '@/platform/workflow/persistence/composables/useAccountStorage'

export interface ChatSession {
  id: string
  title: string
  updatedAt: number
  titleSource: 'server' | 'fallback'
  workflowId?: string
  lastActivityAt?: number
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
  const serverSessions = ref<ChatSession[]>([])
  const pendingServerSessions = ref<ChatSession[]>([])
  const activeId = ref<string | null>(null)
  const now = useTimestamp({ interval: 60_000 })
  const customTitles = useAccountStorage<Partial<Record<string, string>>>(
    StorageKeys.agentChatTitles,
    {}
  )
  const deletedIds = useAccountStorage<string[]>(
    StorageKeys.agentDeletedThreads,
    []
  )

  const sessions = computed(() =>
    [...pendingServerSessions.value, ...serverSessions.value].filter(
      (session) => !deletedIds.value.includes(session.id)
    )
  )

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

  function sessionsFor(workflowId: string): ChatSession[] {
    return orderBy(
      titled.value.filter((session) => session.workflowId === workflowId),
      [({ lastActivityAt }) => lastActivityAt ?? Number.NEGATIVE_INFINITY],
      ['desc']
    )
  }

  function rename(id: string, title: string): void {
    const trimmed = title.trim()
    if (trimmed === '') return
    customTitles.value = { ...customTitles.value, [id]: trimmed }
  }

  function remove(id: string): void {
    serverSessions.value = serverSessions.value.filter((item) => item.id !== id)
    pendingServerSessions.value = pendingServerSessions.value.filter(
      (item) => item.id !== id
    )
    const { [id]: _removed, ...rest } = customTitles.value
    customTitles.value = rest
    if (!deletedIds.value.includes(id))
      deletedIds.value = [...deletedIds.value, id]
    if (activeId.value === id) activeId.value = null
  }

  function replaceAll(next: ChatSession[]): void {
    const filtered = next.filter(
      (session) => !deletedIds.value.includes(session.id)
    )
    const listedIds = new Set(filtered.map((session) => session.id))
    serverSessions.value = filtered
    pendingServerSessions.value = pendingServerSessions.value.filter(
      (session) =>
        !deletedIds.value.includes(session.id) && !listedIds.has(session.id)
    )
  }

  function setActive(id: string | null): void {
    activeId.value = id
  }

  function isDeleted(id: string): boolean {
    return deletedIds.value.includes(id)
  }

  function rememberSession(session: ChatSession): void {
    if (isDeleted(session.id)) return
    if (
      serverSessions.value.some((item) => item.id === session.id) ||
      pendingServerSessions.value.some((item) => item.id === session.id)
    )
      return
    pendingServerSessions.value = [session, ...pendingServerSessions.value]
  }

  return {
    sessions,
    activeId,
    grouped,
    titleFor,
    sessionsFor,
    rename,
    remove,
    replaceAll,
    setActive,
    isDeleted,
    rememberSession
  }
})
