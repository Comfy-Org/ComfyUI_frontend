import { describe, expect, it, vi } from 'vitest'

import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import type { CloudWorkflowRefreshOutcome } from '@/workbench/extensions/agent/composables/agent/useAgentWorkflowResolver'
import type { ThreadListing } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

import { useAgentWorkflowChatFollow } from './useAgentWorkflowChatFollow'

function chat(
  id: string,
  workflowId: string,
  lastActivityAt: number
): ChatSession {
  return {
    id,
    title: id,
    titleSource: 'server',
    updatedAt: lastActivityAt,
    lastActivityAt,
    workflowId
  }
}

function createHarness(
  overrides: Partial<Parameters<typeof useAgentWorkflowChatFollow>[0]> = {}
) {
  const workflowA = createMockLoadedWorkflow({
    path: 'workflows/alpha.json',
    filename: 'alpha',
    isTemporary: false
  })
  const workflowB = createMockLoadedWorkflow({
    path: 'workflows/beta.json',
    filename: 'beta',
    isTemporary: false
  })
  let active = workflowA
  let target: typeof workflowA | null = workflowA
  let threadId: string | null = 'th-a'
  let follows = false
  let engaged = false
  const chats = new Map<string, ChatSession[]>()
  const openChats = new Map<string, string>()
  const showBlankChat = vi.fn(() => {
    threadId = null
    follows = true
  })
  const forgetOpenChat = vi.fn((id: string) => {
    for (const [wf, remembered] of openChats)
      if (remembered === id) openChats.delete(wf)
  })
  const loadThread = vi.fn(async (id: string) => {
    threadId = id
    return true
  })
  const refreshCloudWorkflowListing = vi.fn(
    async (): Promise<CloudWorkflowRefreshOutcome> => 'complete'
  )
  const refreshHistory = vi.fn(
    async (): Promise<ThreadListing['status'] | 'superseded'> => 'complete'
  )
  const trackThreadStarted = vi.fn()
  const adoptWorkflowTarget = vi.fn()
  const adoptRestoredWorkflowTab = vi.fn()

  const follow = useAgentWorkflowChatFollow({
    activeWorkflow: () => active,
    selectedTarget: () => target,
    currentThreadId: () => threadId,
    chatsFor: (workflowId) => chats.get(workflowId) ?? [],
    openChatFor: (workflowId) => openChats.get(workflowId),
    forgetOpenChat,
    followsVisibleWorkflow: () => follows,
    userEngaged: () => engaged,
    cloudIdFor: (workflow) =>
      workflow.path === workflowA.path ? 'wf-a' : 'wf-b',
    refreshCloudWorkflowListing,
    refreshHistory,
    loadThread,
    showBlankChat,
    trackThreadStarted,
    restoreThreadWorkflow: () => true,
    adoptWorkflowTarget,
    adoptRestoredWorkflowTab,
    ...overrides
  })

  return {
    workflowA,
    workflowB,
    follow,
    chats,
    openChats,
    showBlankChat,
    forgetOpenChat,
    loadThread,
    refreshCloudWorkflowListing,
    refreshHistory,
    trackThreadStarted,
    adoptWorkflowTarget,
    adoptRestoredWorkflowTab,
    setActive: (next: typeof workflowA) => {
      active = next
    },
    setTarget: (next: typeof workflowA | null) => {
      target = next
    },
    setThreadId: (next: string | null) => {
      threadId = next
    },
    getThreadId: () => threadId,
    setFollows: (next: boolean) => {
      follows = next
    },
    setEngaged: (next: boolean) => {
      engaged = next
      follow.userEngagementChanged(next)
    }
  }
}

describe('useAgentWorkflowChatFollow', () => {
  it('T1-03: settles an unsaved tab without a binding immediately without entering a loading state', async () => {
    const unsaved = createMockLoadedWorkflow({
      path: 'Unsaved Workflow.json',
      isTemporary: true
    })
    const seenLandings: unknown[] = []
    const h = createHarness({
      cloudIdFor: () => undefined
    })
    h.setActive(unsaved)

    const running = h.follow.followTab(unsaved)
    seenLandings.push(h.follow.landing.value)
    await running

    expect(seenLandings).toEqual([null])
    expect(h.follow.landing.value).toBeNull()
    expect(h.showBlankChat).toHaveBeenCalledOnce()
    expect(h.refreshCloudWorkflowListing).not.toHaveBeenCalled()
    expect(h.refreshHistory).not.toHaveBeenCalled()
  })

  it('T1-04: leaves the previous chat synchronously before any lookup or transcript settles', async () => {
    const h = createHarness()
    let resolveHistory!: (status: ThreadListing['status']) => void
    h.refreshHistory.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHistory = resolve
        })
    )
    h.setActive(h.workflowB)

    const running = h.follow.followTab(h.workflowB)

    expect(h.showBlankChat).toHaveBeenCalledOnce()
    expect(h.getThreadId()).toBeNull()
    expect(h.follow.landing.value).toEqual({
      workflowName: 'beta',
      status: 'loading'
    })

    await vi.waitFor(() => expect(resolveHistory).toBeTypeOf('function'))
    resolveHistory('failed')
    await running

    expect(h.follow.landing.value).toEqual({
      workflowName: 'beta',
      status: 'failed'
    })
    expect(h.getThreadId()).toBeNull()
  })

  it('T1-05 T1-06: opens the most recent known chat at once and ignores newer chats arriving in the background refresh', async () => {
    const h = createHarness()
    h.chats.set('wf-b', [
      chat('th-newest', 'wf-b', 200),
      chat('th-older', 'wf-b', 100)
    ])
    let resolveBg!: (status: ThreadListing['status']) => void
    h.refreshHistory.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBg = resolve
        })
    )
    h.setActive(h.workflowB)

    await h.follow.followTab(h.workflowB)

    expect(h.loadThread).toHaveBeenCalledTimes(1)
    expect(h.loadThread).toHaveBeenCalledWith(
      'th-newest',
      expect.any(Function),
      { keepOpenChatUntilLoaded: true }
    )
    expect(h.trackThreadStarted).toHaveBeenCalledOnce()

    h.chats.set('wf-b', [
      chat('th-arrived-later', 'wf-b', 300),
      chat('th-newest', 'wf-b', 200),
      chat('th-older', 'wf-b', 100)
    ])
    resolveBg('complete')
    await Promise.resolve()

    expect(h.loadThread).toHaveBeenCalledTimes(1)
    expect(h.getThreadId()).toBe('th-newest')
  })

  it('T1-05: opens the bound chat of an unsaved tab that owns one', async () => {
    const unsaved = createMockLoadedWorkflow({
      path: 'Unsaved Workflow.json',
      isTemporary: true
    })
    const h = createHarness({
      cloudIdFor: (workflow) =>
        workflow.path === unsaved.path ? 'wf-temp' : 'wf-a'
    })
    h.chats.set('wf-temp', [chat('th-temp', 'wf-temp', 100)])
    h.setActive(unsaved)

    await h.follow.followTab(unsaved)

    expect(h.loadThread).toHaveBeenCalledWith('th-temp', expect.any(Function), {
      keepOpenChatUntilLoaded: true
    })
    expect(h.getThreadId()).toBe('th-temp')
  })

  it('T1-07: sets landing to failed with retry when opening the most recent chat fails, and retries cleanly', async () => {
    const h = createHarness()
    h.chats.set('wf-b', [chat('th-b1', 'wf-b', 100)])
    h.loadThread.mockResolvedValueOnce(false)
    h.setActive(h.workflowB)

    await h.follow.followTab(h.workflowB)

    expect(h.follow.landing.value).toEqual({
      workflowName: 'beta',
      status: 'failed'
    })
    expect(h.follow.openingWorkflowName.value).toBeUndefined()

    h.follow.retryFollow()
    await vi.waitFor(() => expect(h.getThreadId()).toBe('th-b1'))
    expect(h.follow.landing.value).toBeNull()
  })

  it.for([
    {
      name: 'complete listing with no cloud id for the tab',
      listing: 'complete' as const,
      expectedLanding: null
    },
    {
      name: 'incomplete listing with no cloud id for the tab (LK-02)',
      listing: 'incomplete' as const,
      expectedLanding: { workflowName: 'beta', status: 'failed' }
    },
    {
      name: 'failed cloud workflow listing (LK-04)',
      listing: 'failed' as const,
      expectedLanding: { workflowName: 'beta', status: 'failed' }
    }
  ])('T1-02 T1-09: handles $name', async ({ listing, expectedLanding }) => {
    const h = createHarness({
      cloudIdFor: (workflow) =>
        workflow.path === h.workflowA.path ? 'wf-a' : undefined
    })
    h.refreshCloudWorkflowListing.mockResolvedValue(listing)
    h.setActive(h.workflowB)

    await h.follow.followTab(h.workflowB)

    expect(h.follow.landing.value).toEqual(expectedLanding)
    expect(h.loadThread).not.toHaveBeenCalled()
  })

  it.for([{ outcome: 'failed' as const }, { outcome: 'incomplete' as const }])(
    'T1-09: shows failed landing when history refresh returns $outcome and retries on retryFollow',
    async ({ outcome }) => {
      const h = createHarness()
      h.refreshHistory.mockResolvedValueOnce(outcome)
      h.setActive(h.workflowB)

      await h.follow.followTab(h.workflowB)

      expect(h.follow.landing.value).toEqual({
        workflowName: 'beta',
        status: 'failed'
      })

      h.chats.set('wf-b', [chat('th-b1', 'wf-b', 100)])
      h.refreshHistory.mockResolvedValueOnce('complete')
      h.follow.retryFollow()
      await vi.waitFor(() => expect(h.getThreadId()).toBe('th-b1'))
      expect(h.follow.landing.value).toBeNull()
    }
  )

  it('T1-10: resumes a chat remembered for the tab without a history refresh, and skips it in the same landing if it fails', async () => {
    const h = createHarness()
    h.openChats.set('wf-b', 'th-remembered')
    h.chats.set('wf-b', [
      chat('th-remembered', 'wf-b', 200),
      chat('th-fallback', 'wf-b', 100)
    ])
    h.loadThread.mockImplementation(async (id: string) => {
      if (id === 'th-remembered') return false
      h.setThreadId(id)
      return true
    })
    h.setActive(h.workflowB)

    await h.follow.followTab(h.workflowB)

    expect(h.forgetOpenChat).toHaveBeenCalledWith('th-remembered')
    expect(h.loadThread.mock.calls.map(([id]) => id)).toEqual([
      'th-remembered',
      'th-fallback'
    ])
    expect(h.getThreadId()).toBe('th-fallback')
  })

  it('T1-10: does not retry a failed remembered chat when it is the only chat in History, and retries it on explicit Retry', async () => {
    const h = createHarness()
    h.openChats.set('wf-b', 'th-only')
    h.chats.set('wf-b', [chat('th-only', 'wf-b', 100)])
    h.loadThread.mockResolvedValueOnce(false)
    h.setActive(h.workflowB)

    await h.follow.followTab(h.workflowB)

    expect(h.loadThread).toHaveBeenCalledTimes(1)
    expect(h.follow.landing.value).toEqual({
      workflowName: 'beta',
      status: 'failed'
    })

    h.follow.retryFollow()
    await vi.waitFor(() => expect(h.loadThread).toHaveBeenCalledTimes(2))
    expect(h.getThreadId()).toBe('th-only')
  })

  it('T1-11: does not open an older chat once a send started and created a thread during a pending lookup', async () => {
    const h = createHarness()
    let resolveRefresh!: (outcome: ThreadListing['status']) => void
    h.refreshHistory.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        })
    )
    h.setActive(h.workflowB)

    const following = h.follow.followTab(h.workflowB)
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'))

    h.setEngaged(true)
    h.setThreadId('th-new')
    h.setEngaged(false)

    h.chats.set('wf-b', [chat('th-old', 'wf-b', 1)])
    resolveRefresh('complete')
    await following

    expect(h.loadThread).not.toHaveBeenCalled()
    expect(h.follow.landing.value).toBeNull()
    expect(h.getThreadId()).toBe('th-new')
  })

  it('T1-11: stops a pending lookup and drops the loading state when the user starts typing', async () => {
    const h = createHarness()
    let resolveRefresh!: (outcome: ThreadListing['status']) => void
    h.refreshHistory.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        })
    )
    h.setActive(h.workflowB)

    const following = h.follow.followTab(h.workflowB)
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'))
    expect(h.follow.landing.value).toEqual({
      workflowName: 'beta',
      status: 'loading'
    })

    h.setEngaged(true)
    expect(h.follow.landing.value).toBeNull()

    h.chats.set('wf-b', [chat('th-old', 'wf-b', 1)])
    resolveRefresh('complete')
    await following

    expect(h.loadThread).not.toHaveBeenCalled()
    expect(h.follow.landing.value).toBeNull()
  })

  it('T1-12: drops B landing when switching to another tab or retiring while loading', async () => {
    const workflowC = createMockLoadedWorkflow({
      path: 'workflows/gamma.json',
      isTemporary: false
    })
    const h = createHarness()
    let resolveRefresh!: (outcome: ThreadListing['status']) => void
    h.refreshHistory.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        })
    )
    h.setActive(h.workflowB)

    const following = h.follow.followTab(h.workflowB)
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'))

    h.setActive(workflowC)
    h.follow.activeWorkflowChanged(workflowC)
    expect(h.follow.landing.value).toBeNull()

    h.chats.set('wf-b', [chat('th-b1', 'wf-b', 100)])
    resolveRefresh('complete')
    await following

    expect(h.loadThread).not.toHaveBeenCalled()
    expect(h.follow.landing.value).toBeNull()
  })

  it('does not open a chat for a follow retired while its history refresh settles', async () => {
    const h = createHarness()
    let resolveRefresh!: (outcome: ThreadListing['status']) => void
    h.refreshHistory.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        })
    )
    h.setActive(h.workflowB)

    const following = h.follow.followTab(h.workflowB)
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'))
    h.chats.set('wf-b', [chat('th-b1', 'wf-b', 100)])
    h.follow.retireFollow()
    resolveRefresh('complete')
    await following

    expect(h.loadThread).not.toHaveBeenCalled()
  })

  it('holds back the switch when userEngaged is true', async () => {
    const h = createHarness()
    h.setActive(h.workflowB)
    h.setEngaged(true)

    await h.follow.followTab(h.workflowB)

    expect(h.showBlankChat).not.toHaveBeenCalled()
    expect(h.getThreadId()).toBe('th-a')
  })
})
