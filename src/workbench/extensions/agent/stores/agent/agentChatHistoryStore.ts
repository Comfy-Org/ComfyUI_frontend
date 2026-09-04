import { useLocalStorage, useTimestamp } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, toValue, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

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

function readTitles(raw: string): Record<string, string> {
  try {
    const value: unknown = JSON.parse(raw)
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).every((title) => typeof title === 'string')
    )
      return value as Record<string, string>
  } catch {
    // Invalid persisted JSON falls back to an empty title overlay.
  }
  return {}
}

function readDeletedIds(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw)
    if (Array.isArray(value) && value.every((id) => typeof id === 'string'))
      return value
  } catch {
    // Invalid persisted JSON falls back to no tombstones.
  }
  return []
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
  const now = useTimestamp({ interval: 60_000 })

  const currentUser = useCurrentUser()
  const workspaceStore = useTeamWorkspaceStore()
  const storageScope = computed(() => {
    const userId = currentUser.resolvedUserInfo.value?.id ?? 'signed-out'
    const workspaceId = toValue(workspaceStore.activeWorkspaceId) ?? 'personal'
    return `${encodeURIComponent(userId)}.${encodeURIComponent(workspaceId)}`
  })

  // These are user content metadata, so their keys must rotate with both
  // authenticated identity and workspace. The in-memory list is cleared at
  // the same boundary so a switched account cannot see the prior account's
  // sessions while the reactive storage refs load the new keys.
  watch(
    storageScope,
    () => {
      sessions.value = []
      activeId.value = null
    },
    { flush: 'sync' }
  )

  // The server owns thread titles but has no rename or delete endpoint yet
  // (BE-3130), so renames live in a local overlay applied over the server
  // titles and deletes in a local tombstone set filtered out of every refresh.
  const customTitles = useLocalStorage<Record<string, string>>(
    computed(() => `Comfy.Agent.ChatTitles.${storageScope.value}`),
    {},
    {
      serializer: { read: readTitles, write: JSON.stringify }
    }
  )
  const deletedIds = useLocalStorage<string[]>(
    computed(() => `Comfy.Agent.DeletedThreads.${storageScope.value}`),
    [],
    {
      serializer: { read: readDeletedIds, write: JSON.stringify }
    }
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

  function replaceAll(next: ChatSession[]): void {
    sessions.value = next.filter(
      (session) => !deletedIds.value.includes(session.id)
    )
    if (!sessions.value.some((session) => session.id === activeId.value))
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
    replaceAll,
    setActive
  }
})
