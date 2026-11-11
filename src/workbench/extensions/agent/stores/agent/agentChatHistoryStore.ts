import { useLocalStorage, useTimestamp } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { clearLegacyAgentStorage } from '@/platform/workflow/persistence/base/storageIO'
import {
  getWorkspaceId,
  StorageKeys
} from '@/platform/workflow/persistence/base/storageKeys'

export interface ChatSession {
  id: string
  title: string
  updatedAt: number
  titleSource: 'server' | 'fallback'
  workflowId?: string
  lastActivityAt?: number
}

export interface HistoryGroups {
  pinned?: ChatSession[]
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
  now: number,
  pinnedIds?: ReadonlySet<string>
): HistoryGroups {
  const startToday = startOfLocalDay(now)
  const startYesterday = startOfLocalDay(startToday - 1)
  const groups: HistoryGroups = {
    current: [],
    today: [],
    yesterday: [],
    earlier: []
  }
  const pinned: ChatSession[] = []
  if (pinnedIds) groups.pinned = pinned
  const ordered = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
  for (const session of ordered) {
    if (session.id === activeId) groups.current.push(session)
    else if (pinnedIds?.has(session.id)) pinned.push(session)
    else if (session.updatedAt >= startToday) groups.today.push(session)
    else if (session.updatedAt >= startYesterday) groups.yesterday.push(session)
    else groups.earlier.push(session)
  }
  return groups
}

export const useAgentChatHistoryStore = defineStore('agentChatHistory', () => {
  const sessions = ref<ChatSession[]>([])
  const activeId = ref<string | null>(null)
  const now = useTimestamp({ interval: 60_000 })
  const workspaceId = getWorkspaceId()

  clearLegacyAgentStorage()

  // The server owns thread titles but has no rename or delete endpoint yet
  // (BE-3130), so renames live in a local overlay applied over the server
  // titles and deletes in a local tombstone set filtered out of every refresh.
  const customTitles = useLocalStorage<Partial<Record<string, string>>>(
    StorageKeys.agentChatTitles(workspaceId),
    {}
  )
  const deletedIds = useLocalStorage<string[]>(
    StorageKeys.agentDeletedThreads(workspaceId),
    []
  )

  const pinnedSessions = useLocalStorage<Partial<Record<string, ChatSession>>>(
    StorageKeys.agentPinnedThreads(workspaceId),
    {}
  )
  const pinnedIds = computed(
    (): ReadonlySet<string> => new Set(Object.keys(pinnedSessions.value))
  )

  function withCustomTitle(session: ChatSession): ChatSession {
    const custom = customTitles.value[session.id]
    return custom === undefined ? session : { ...session, title: custom }
  }

  const titled = computed(() => sessions.value.map(withCustomTitle))

  const listed = computed(() => {
    const loaded = new Set(sessions.value.map(({ id }) => id))
    const pinnedOnly = Object.values(pinnedSessions.value).flatMap((session) =>
      session === undefined || loaded.has(session.id)
        ? []
        : [withCustomTitle(session)]
    )
    return [...titled.value, ...pinnedOnly]
  })

  const groupedInPlace = computed(() =>
    groupSessionsByRecency(listed.value, null, now.value, pinnedIds.value)
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
    unpin(id)
  }

  function unpin(id: string): void {
    if (!(id in pinnedSessions.value)) return
    const { [id]: _unpinned, ...rest } = pinnedSessions.value
    pinnedSessions.value = rest
  }

  function togglePin(id: string): void {
    if (id in pinnedSessions.value) {
      unpin(id)
      return
    }
    const session = sessions.value.find((item) => item.id === id)
    if (session)
      pinnedSessions.value = { ...pinnedSessions.value, [id]: { ...session } }
  }

  function replaceAll(next: ChatSession[]): void {
    sessions.value = next.filter(
      (session) => !deletedIds.value.includes(session.id)
    )
  }

  function setActive(id: string | null): void {
    activeId.value = id
  }

  return {
    sessions,
    activeId,
    grouped,
    groupedInPlace,
    pinnedIds,
    togglePin,
    titleFor,
    rename,
    remove,
    replaceAll,
    setActive
  }
})
