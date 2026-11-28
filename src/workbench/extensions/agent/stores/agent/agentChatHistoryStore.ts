import { useTimestamp } from '@vueuse/core'
import { orderBy } from 'es-toolkit'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useSafeLocalStorage } from '@/platform/storage/useSafeStorage'
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

export interface ChatDeleteSnapshot {
  session?: ChatSession
  customTitle?: string
  pending?: boolean
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
  const workspaceId = getWorkspaceId()

  clearLegacyAgentStorage()

  // The server owns thread titles but has no rename endpoint yet (BE-3130),
  // so renames live in a local overlay applied over the server titles. Deletes
  // go to the server; the local tombstone set only hides chats the server
  // could not delete for this browser (no endpoint yet, or already gone).
  const customTitles = useSafeLocalStorage<Partial<Record<string, string>>>(
    StorageKeys.agentChatTitles(workspaceId),
    {}
  )
  const deletedIds = useSafeLocalStorage<string[]>(
    StorageKeys.agentDeletedThreads(workspaceId),
    [],
    { flush: 'sync' }
  )
  const pendingDeletes = new Map<string, string | undefined>()
  const committedDeletes = new Set<string>()

  const sessions = computed(() =>
    [...pendingServerSessions.value, ...serverSessions.value].filter(
      (session) => !isDeleted(session.id)
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

  function dropSessionFromMemory(id: string): void {
    serverSessions.value = serverSessions.value.filter((item) => item.id !== id)
    pendingServerSessions.value = pendingServerSessions.value.filter(
      (item) => item.id !== id
    )
    const { [id]: _removed, ...rest } = customTitles.value
    customTitles.value = rest
    if (activeId.value === id) activeId.value = null
  }

  function remove(id: string): void {
    pendingDeletes.delete(id)
    committedDeletes.delete(id)
    dropSessionFromMemory(id)
    if (!deletedIds.value.includes(id))
      deletedIds.value = [...deletedIds.value, id]
  }

  function beginDelete(id: string): ChatDeleteSnapshot {
    const pendingSession = pendingServerSessions.value.find(
      (item) => item.id === id
    )
    const snapshot: ChatDeleteSnapshot = {
      session:
        pendingSession ?? serverSessions.value.find((item) => item.id === id),
      customTitle: customTitles.value[id],
      pending: pendingSession !== undefined
    }
    pendingDeletes.set(id, snapshot.session?.workflowId)
    dropSessionFromMemory(id)
    return snapshot
  }

  function commitDelete(
    id: string,
    { tombstone = false }: { tombstone?: boolean } = {}
  ): void {
    pendingDeletes.delete(id)
    if (tombstone) {
      committedDeletes.delete(id)
      if (!deletedIds.value.includes(id))
        deletedIds.value = [...deletedIds.value, id]
      return
    }
    committedDeletes.add(id)
  }

  function restoreDelete(id: string, snapshot: ChatDeleteSnapshot): void {
    pendingDeletes.delete(id)
    if (isDeleted(id)) return
    if (snapshot.customTitle !== undefined) {
      customTitles.value = {
        ...customTitles.value,
        [id]: snapshot.customTitle
      }
    }
    if (
      snapshot.session !== undefined &&
      !serverSessions.value.some((item) => item.id === id) &&
      !pendingServerSessions.value.some((item) => item.id === id)
    ) {
      if (snapshot.pending) {
        pendingServerSessions.value = [
          snapshot.session,
          ...pendingServerSessions.value
        ]
      } else {
        serverSessions.value = [snapshot.session, ...serverSessions.value]
      }
    }
  }

  function dropByWorkflow(workflowId: string): ChatSession[] {
    for (const [id, pendingWorkflowId] of pendingDeletes) {
      if (pendingWorkflowId !== workflowId) continue
      pendingDeletes.delete(id)
      committedDeletes.add(id)
    }
    const dropped = sessions.value.filter(
      (session) => session.workflowId === workflowId
    )
    if (dropped.length === 0) return []
    const droppedIds = new Set(dropped.map(({ id }) => id))
    for (const id of droppedIds) committedDeletes.add(id)
    serverSessions.value = serverSessions.value.filter(
      (item) => !droppedIds.has(item.id)
    )
    pendingServerSessions.value = pendingServerSessions.value.filter(
      (item) => !droppedIds.has(item.id)
    )
    const remainingTitles: Partial<Record<string, string>> = {}
    for (const [id, title] of Object.entries(customTitles.value)) {
      if (!droppedIds.has(id)) remainingTitles[id] = title
    }
    customTitles.value = remainingTitles
    return dropped
  }

  function replaceAll(next: ChatSession[]): void {
    const filtered = next.filter((session) => !isDeleted(session.id))
    const listedIds = new Set(filtered.map((session) => session.id))
    serverSessions.value = filtered
    pendingServerSessions.value = pendingServerSessions.value.filter(
      (session) => !isDeleted(session.id) && !listedIds.has(session.id)
    )
  }

  function setActive(id: string | null): void {
    activeId.value = id
  }

  function isDeleted(id: string): boolean {
    return (
      deletedIds.value.includes(id) ||
      pendingDeletes.has(id) ||
      committedDeletes.has(id)
    )
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
    beginDelete,
    commitDelete,
    restoreDelete,
    dropByWorkflow,
    replaceAll,
    setActive,
    isDeleted,
    rememberSession
  }
})
