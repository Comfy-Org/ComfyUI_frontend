import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import type { ChatSession } from './agentChatHistoryStore'
import {
  groupSessionsByRecency,
  useAgentChatHistoryStore
} from './agentChatHistoryStore'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

const NOW = new Date(2026, 2, 15, 12, 0, 0).getTime()
const DAY = 86_400_000

const session = (
  id: string,
  updatedAt: number,
  titleSource: ChatSession['titleSource'] = 'server'
): ChatSession => ({
  id,
  title: id,
  updatedAt,
  titleSource
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
    localStorage.clear()
    sessionStorage.clear()
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

  describe('sessionsFor', () => {
    const forWorkflow = (
      id: string,
      workflowId: string,
      lastActivityAt?: number
    ): ChatSession => ({
      ...session(id, lastActivityAt ?? NOW),
      lastActivityAt,
      workflowId
    })

    it('lists only the chats of one workflow, by last activity, with the renamed titles', () => {
      const store = useAgentChatHistoryStore()
      store.replaceAll([
        forWorkflow('older', 'wf-a', 1),
        forWorkflow('elsewhere', 'wf-b', 9),
        forWorkflow('newer', 'wf-a', 3),
        { ...session('unbound', 7), lastActivityAt: 7 }
      ])
      store.rename('older', 'Duck pipeline')

      expect(store.sessionsFor('wf-a')).toMatchObject([
        { id: 'newer', title: 'newer' },
        { id: 'older', title: 'Duck pipeline' }
      ])
    })

    it('lists a chat with no valid time last, though History groups it under Today', () => {
      const store = useAgentChatHistoryStore()
      store.replaceAll([
        forWorkflow('stampless', 'wf-a'),
        forWorkflow('stamped', 'wf-a', 1)
      ])

      expect(store.sessionsFor('wf-a').map(({ id }) => id)).toEqual([
        'stamped',
        'stampless'
      ])
    })

    it('leaves out a chat that was deleted', () => {
      const store = useAgentChatHistoryStore()
      store.replaceAll([
        forWorkflow('a', 'wf-a', 1),
        forWorkflow('b', 'wf-a', 2)
      ])

      store.remove('b')

      expect(store.sessionsFor('wf-a').map(({ id }) => id)).toEqual(['a'])
    })
  })

  describe('workflowIdsWithChats', () => {
    const forWorkflow = (id: string, workflowId?: string): ChatSession => ({
      ...session(id, NOW),
      workflowId
    })

    it('holds each workflow that has at least one chat, once', () => {
      const store = useAgentChatHistoryStore()
      store.replaceAll([
        forWorkflow('a', 'wf-a'),
        forWorkflow('b', 'wf-a'),
        forWorkflow('c', 'wf-b'),
        forWorkflow('unbound')
      ])

      expect(store.workflowIdsWithChats).toEqual(new Set(['wf-a', 'wf-b']))
    })

    it('drops a workflow when its last chat is deleted', () => {
      const store = useAgentChatHistoryStore()
      store.replaceAll([forWorkflow('a', 'wf-a'), forWorkflow('b', 'wf-a')])

      store.remove('a')
      expect(store.workflowIdsWithChats.has('wf-a')).toBe(true)

      store.remove('b')
      expect(store.workflowIdsWithChats.has('wf-a')).toBe(false)
    })
  })

  it('restores titles and tombstones only from the current scope', () => {
    sessionStorage.setItem(
      'Comfy.Workspace.Current',
      JSON.stringify({ type: 'team', id: 'workspace-b' })
    )
    localStorage.setItem(
      StorageKeys.agentChatTitles('workspace-b'),
      JSON.stringify({ a: 'Scoped title' })
    )
    localStorage.setItem(
      StorageKeys.agentDeletedThreads('workspace-b'),
      JSON.stringify(['deleted'])
    )
    localStorage.setItem(
      'Comfy.Agent.ChatTitles',
      JSON.stringify({ a: 'Legacy title' })
    )
    localStorage.setItem(
      'Comfy.Agent.DeletedThreads',
      JSON.stringify(['visible'])
    )

    const store = useAgentChatHistoryStore()
    store.replaceAll([
      session('a', 1),
      session('deleted', 2),
      session('visible', 3)
    ])

    expect(store.titleFor('a')).toBe('Scoped title')
    expect(store.sessions.map(({ id }) => id)).toEqual(['a', 'visible'])
    expect(localStorage.getItem('Comfy.Agent.ChatTitles')).toBeNull()
    expect(localStorage.getItem('Comfy.Agent.DeletedThreads')).toBeNull()
  })

  it('does not apply titles or tombstones from another workspace', () => {
    sessionStorage.setItem(
      'Comfy.Workspace.Current',
      JSON.stringify({ type: 'team', id: 'workspace-b' })
    )
    localStorage.setItem(
      StorageKeys.agentChatTitles('workspace-a'),
      JSON.stringify({ a: 'Workspace A title' })
    )
    localStorage.setItem(
      StorageKeys.agentDeletedThreads('workspace-a'),
      JSON.stringify(['a'])
    )

    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', 1)])

    expect(store.titleFor('a')).toBeUndefined()
    expect(store.sessions.map(({ id }) => id)).toEqual(['a'])
  })

  it('removes a session with no server request', () => {
    const store = useAgentChatHistoryStore()
    store.replaceAll([session('a', 1)])

    store.remove('a')

    expect(fetch).not.toHaveBeenCalled()
    expect(store.sessions).toHaveLength(0)
    vi.mocked(fetch).mockRestore()
  })
})
