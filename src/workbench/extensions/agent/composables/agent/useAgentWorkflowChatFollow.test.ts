import { setImmediate } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import type { ThreadListing } from '@/workbench/extensions/agent/services/agent/agentRestClient'
import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

import { useAgentWorkflowChatFollow } from './useAgentWorkflowChatFollow'

const ESTABLISHED_CHAT_OF_ANOTHER_TAB = 'th-open'

type FollowDeps = Parameters<typeof useAgentWorkflowChatFollow>[0]
type RefreshOutcome = Awaited<ReturnType<FollowDeps['refreshHistory']>>

function savedTab(): ComfyWorkflow {
  return createMockLoadedWorkflow({
    path: 'workflows/portrait.json',
    filename: 'portrait',
    isTemporary: false
  })
}

function unsavedTab(): ComfyWorkflow {
  return createMockLoadedWorkflow({
    path: 'workflows/Unsaved Workflow.json',
    filename: 'Unsaved Workflow',
    isTemporary: true
  })
}

function session(
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

function createFollow(
  followed: ComfyWorkflow,
  overrides: Partial<FollowDeps> = {}
) {
  const history = shallowRef<ChatSession[]>([])
  const deps: FollowDeps = {
    activeWorkflow: () => followed,
    selectedTarget: () => null,
    currentThreadId: vi.fn(() => ESTABLISHED_CHAT_OF_ANOTHER_TAB),
    chatsFor: (workflowId) =>
      history.value
        .filter((chat) => chat.workflowId === workflowId)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    openChatFor: () => undefined,
    forgetOpenChat: vi.fn(),
    followsVisibleWorkflow: () => false,
    hasDraft: () => false,
    userEngaged: vi.fn(() => false),
    cloudIdFor: () => undefined,
    refreshCloudWorkflowIds: vi.fn(async () => true),
    refreshHistory: vi.fn(async () => 'complete' as const),
    loadThread: vi.fn(async () => true),
    clearDraft: vi.fn(),
    showBlankChat: vi.fn(),
    trackThreadStarted: vi.fn(),
    restoreThreadWorkflow: () => true,
    adoptWorkflowTarget: vi.fn(),
    adoptRestoredWorkflowTab: vi.fn(),
    ...overrides
  }
  return { follow: useAgentWorkflowChatFollow(deps), deps, history }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('useAgentWorkflowChatFollow', () => {
  describe('switching to a tab', () => {
    it('replaces the open chat with a blank one before anything is looked up', async () => {
      const workflow = savedTab()
      const listing = deferred<ThreadListing['status']>()
      const { follow, deps } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        refreshHistory: () => listing.promise
      })

      const following = follow.followTab(workflow)

      expect(deps.showBlankChat).toHaveBeenCalledOnce()
      expect(follow.landing.value).toMatchObject({
        workflowName: 'portrait',
        status: 'loading',
        chats: []
      })
      listing.resolve('complete')
      await following
    })

    it('lists the five latest chats of the tab once they arrive', async () => {
      const workflow = savedTab()
      const { follow, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        refreshHistory: vi.fn(async () => {
          history.value = [1, 2, 3, 4, 5, 6, 7].map((n) =>
            session(`th-${n}`, 'wf-portrait', n)
          )
          return 'complete' as const
        })
      })

      await follow.followTab(workflow)

      expect(follow.landing.value).toMatchObject({
        status: 'ready',
        chats: [7, 6, 5, 4, 3].map((n) =>
          expect.objectContaining({ id: `th-${n}` })
        ),
        hasMore: true
      })
    })

    it('offers no way to all chats when the tab has no more than it lists', async () => {
      const workflow = savedTab()
      const { follow, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait'
      })
      history.value = [1, 2, 3, 4, 5].map((n) =>
        session(`th-${n}`, 'wf-portrait', n)
      )

      await follow.followTab(workflow)

      expect(follow.landing.value).toMatchObject({ hasMore: false })
      expect(follow.landing.value?.chats).toHaveLength(5)
    })

    it('shows the chats History already holds at once and refreshes them in the background', async () => {
      const workflow = savedTab()
      const listing = deferred<ThreadListing['status']>()
      const { follow, deps, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        refreshHistory: vi.fn(() => listing.promise)
      })
      history.value = [
        session('th-portrait', 'wf-portrait', 1),
        session('th-landscape', 'wf-portrait', 2)
      ]

      const following = follow.followTab(workflow)

      expect(follow.landing.value).toMatchObject({
        status: 'ready',
        chats: [
          expect.objectContaining({ id: 'th-landscape' }),
          expect.objectContaining({ id: 'th-portrait' })
        ]
      })
      expect(deps.refreshHistory).toHaveBeenCalledWith('none', 'wf-portrait')
      expect(deps.refreshCloudWorkflowIds).not.toHaveBeenCalled()
      listing.resolve('complete')
      await following
    })

    it('keeps listing the chats it knows when the background refresh fails', async () => {
      const workflow = savedTab()
      const { follow, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        refreshHistory: vi.fn(async () => 'failed' as const)
      })
      history.value = [
        session('th-portrait', 'wf-portrait', 1),
        session('th-landscape', 'wf-portrait', 2)
      ]

      await follow.followTab(workflow)

      expect(follow.landing.value).toMatchObject({ status: 'ready' })
    })

    it('does not list a chat of another workflow', async () => {
      const workflow = savedTab()
      const { follow, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait'
      })
      history.value = [session('th-other', 'wf-other', 1)]

      await follow.followTab(workflow)

      expect(follow.landing.value).toBeNull()
    })

    describe('a tab that has no chat', () => {
      it('shows the plain new-chat screen when a fresh answer says the workflow has none', async () => {
        const workflow = savedTab()
        const { follow, deps } = createFollow(workflow, {
          cloudIdFor: () => 'wf-portrait'
        })

        await follow.followTab(workflow)

        expect(deps.refreshHistory).toHaveBeenCalledWith('none', 'wf-portrait')
        expect(deps.showBlankChat).toHaveBeenCalledOnce()
        expect(deps.loadThread).not.toHaveBeenCalled()
        expect(follow.landing.value).toBeNull()
      })

      it('shows the plain new-chat screen for a saved tab that has no cloud workflow once the list is fresh', async () => {
        const workflow = savedTab()
        const { follow, deps } = createFollow(workflow)

        await follow.followTab(workflow)

        expect(deps.refreshCloudWorkflowIds).toHaveBeenCalledOnce()
        expect(deps.refreshHistory).not.toHaveBeenCalled()
        expect(deps.showBlankChat).toHaveBeenCalledOnce()
        expect(follow.landing.value).toBeNull()
      })

      it('shows the plain new-chat screen for an unsaved tab without asking the cloud about it', async () => {
        const workflow = unsavedTab()
        const { follow, deps } = createFollow(workflow)

        await follow.followTab(workflow)

        expect(deps.refreshCloudWorkflowIds).not.toHaveBeenCalled()
        expect(deps.refreshHistory).not.toHaveBeenCalled()
        expect(deps.showBlankChat).toHaveBeenCalledOnce()
        expect(follow.landing.value).toBeNull()
      })

      it('settles an unsaved tab within the call, so the panel is never rendered as loading it', async () => {
        const workflow = unsavedTab()
        const { follow, deps } = createFollow(workflow)

        const following = follow.followTab(workflow)

        expect(deps.showBlankChat).toHaveBeenCalledOnce()
        expect(
          follow.landing.value,
          'a loading state that outlives the call would be rendered'
        ).toBeNull()
        expect(follow.openingWorkflowName.value).toBeUndefined()
        await following
      })

      it('clears whitespace left in the composer along with the chat it replaces', async () => {
        const workflow = unsavedTab()
        const { follow, deps } = createFollow(workflow)

        await follow.followTab(workflow)

        expect(deps.clearDraft).toHaveBeenCalledOnce()
      })

      it('leaves a blank chat that already follows the visible tab alone', async () => {
        const workflow = unsavedTab()
        const { follow, deps } = createFollow(workflow, {
          currentThreadId: () => null,
          followsVisibleWorkflow: () => true
        })

        await follow.followTab(workflow)

        expect(deps.showBlankChat).not.toHaveBeenCalled()
        expect(deps.clearDraft).not.toHaveBeenCalled()
      })

      it('releases a blank chat that is pinned to another tab', async () => {
        const workflow = unsavedTab()
        const { follow, deps } = createFollow(workflow, {
          currentThreadId: () => null,
          followsVisibleWorkflow: () => false
        })

        await follow.followTab(workflow)

        expect(deps.showBlankChat).toHaveBeenCalledOnce()
      })
    })

    describe('a tab whose chats cannot be looked up', () => {
      it.for<RefreshOutcome>(['failed', 'incomplete'])(
        'shows the error and Retry in the list area after a %s history refresh, without bringing the old chat back',
        async (outcome) => {
          const workflow = savedTab()
          const { follow, deps } = createFollow(workflow, {
            cloudIdFor: () => 'wf-portrait',
            refreshHistory: vi.fn(async () => outcome)
          })

          await follow.followTab(workflow)

          expect(deps.showBlankChat).toHaveBeenCalledOnce()
          expect(deps.loadThread).not.toHaveBeenCalled()
          expect(follow.landing.value).toMatchObject({
            status: 'failed',
            chats: []
          })
        }
      )

      it('shows the error when it cannot be told whether a saved tab has a cloud workflow', async () => {
        const workflow = savedTab()
        const { follow, deps } = createFollow(workflow, {
          refreshCloudWorkflowIds: vi.fn(async () => false)
        })

        await follow.followTab(workflow)

        expect(deps.refreshHistory).not.toHaveBeenCalled()
        expect(deps.showBlankChat).toHaveBeenCalledOnce()
        expect(follow.landing.value).toMatchObject({ status: 'failed' })
      })

      it('looks the chats up again in place when the user retries', async () => {
        const workflow = savedTab()
        const refreshHistory = vi
          .fn<FollowDeps['refreshHistory']>()
          .mockResolvedValueOnce('failed')
        const { follow, deps, history } = createFollow(workflow, {
          cloudIdFor: () => 'wf-portrait',
          refreshHistory
        })
        await follow.followTab(workflow)
        const retried = deferred<ThreadListing['status']>()
        refreshHistory.mockImplementationOnce(() => retried.promise)

        follow.retryFollow()

        expect(follow.landing.value).toMatchObject({ status: 'loading' })
        history.value = [
          session('th-portrait', 'wf-portrait', 1),
          session('th-landscape', 'wf-portrait', 2)
        ]
        retried.resolve('complete')
        await vi.waitFor(() =>
          expect(follow.landing.value).toMatchObject({ status: 'ready' })
        )
        expect(deps.showBlankChat).toHaveBeenCalledOnce()
      })

      it('retries even when the user has typed since', async () => {
        const workflow = savedTab()
        const engagement = { engaged: false }
        const refreshHistory = vi
          .fn<FollowDeps['refreshHistory']>()
          .mockResolvedValueOnce('failed')
          .mockResolvedValueOnce('complete')
        const { follow } = createFollow(workflow, {
          cloudIdFor: () => 'wf-portrait',
          userEngaged: () => engagement.engaged,
          refreshHistory
        })
        await follow.followTab(workflow)
        engagement.engaged = true

        follow.retryFollow()

        await vi.waitFor(() => expect(refreshHistory).toHaveBeenCalledTimes(2))
      })
    })

    it('lists whatever History holds when a newer history refresh took over, and opens no chat from it', async () => {
      const workflow = savedTab()
      const { follow, deps, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        refreshHistory: vi.fn(async () => {
          history.value = [session('th-portrait', 'wf-portrait', 1)]
          return 'superseded' as const
        })
      })

      await follow.followTab(workflow)

      expect(follow.landing.value).toMatchObject({ status: 'ready' })
      expect(deps.loadThread).not.toHaveBeenCalled()
    })

    it('shows no error when a newer history refresh took over and History holds nothing', async () => {
      const workflow = savedTab()
      const { follow } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        refreshHistory: vi.fn(async () => 'superseded' as const)
      })

      await follow.followTab(workflow)

      expect(follow.landing.value).toBeNull()
    })
  })

  describe('a lookup that is no longer current', () => {
    function followUntilRefreshSettles() {
      const workflow = savedTab()
      const other = createMockLoadedWorkflow({
        path: 'workflows/other.json',
        filename: 'other',
        isTemporary: false
      })
      const state = { active: workflow, engaged: false }
      const listing = deferred<ThreadListing['status']>()
      const { follow, deps, history } = createFollow(workflow, {
        activeWorkflow: () => state.active,
        userEngaged: () => state.engaged,
        cloudIdFor: () => 'wf-portrait',
        refreshHistory: () => listing.promise
      })
      return {
        follow,
        deps,
        other,
        state,
        async finish(change: () => void): Promise<void> {
          const following = follow.followTab(workflow)
          change()
          history.value = [session('th-portrait', 'wf-portrait', 1)]
          listing.resolve('complete')
          await following
        }
      }
    }

    it.for([
      {
        change: 'it is retired',
        act: (run: ReturnType<typeof followUntilRefreshSettles>) =>
          run.follow.retireFollow()
      },
      {
        change: 'the user switches to another tab',
        act: (run: ReturnType<typeof followUntilRefreshSettles>) => {
          run.state.active = run.other
          run.follow.activeWorkflowChanged(run.other)
        }
      }
    ])(
      'shows no list and opens no chat when $change while the history refresh settles',
      async ({ act }) => {
        const run = followUntilRefreshSettles()

        await run.finish(() => act(run))

        expect(run.follow.landing.value).toBeNull()
        expect(run.deps.loadThread).not.toHaveBeenCalled()
      }
    )

    it('still lists the only chat, and does not open it, when the user starts typing while the history refresh settles', async () => {
      const run = followUntilRefreshSettles()

      await run.finish(() => {
        run.state.engaged = true
        run.follow.userEngagementChanged(true)
      })

      expect(run.follow.landing.value).toMatchObject({ status: 'ready' })
      expect(run.deps.loadThread).not.toHaveBeenCalled()
    })
  })

  describe('opening a chat from the list', () => {
    async function landOnList() {
      const workflow = savedTab()
      const loading = deferred<boolean>()
      const created = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        loadThread: vi.fn(() => loading.promise)
      })
      created.history.value = [
        session('th-new', 'wf-portrait', 2),
        session('th-old', 'wf-portrait', 1)
      ]
      await created.follow.followTab(workflow)
      return { ...created, workflow, loading }
    }

    it('shows the clicked row as loading, then replaces the new-chat screen with the chat', async () => {
      const { follow, deps, loading } = await landOnList()

      const opening = follow.openChat('th-old')

      expect(follow.landing.value).toMatchObject({ openingId: 'th-old' })
      expect(deps.loadThread).toHaveBeenCalledWith(
        'th-old',
        expect.any(Function),
        { keepOpenChatUntilLoaded: true }
      )
      loading.resolve(true)
      await opening
      expect(follow.landing.value).toBeNull()
      expect(deps.trackThreadStarted).toHaveBeenCalledOnce()
    })

    it('marks the row failed and keeps the list when the chat cannot be opened', async () => {
      const { follow, deps, loading } = await landOnList()

      const opening = follow.openChat('th-old')
      loading.resolve(false)
      await opening

      expect(follow.landing.value).toMatchObject({
        status: 'ready',
        openingId: null,
        failedId: 'th-old',
        chats: [
          expect.objectContaining({ id: 'th-new' }),
          expect.objectContaining({ id: 'th-old' })
        ]
      })
      expect(deps.trackThreadStarted).not.toHaveBeenCalled()
    })

    it('clears the failed mark when the row is clicked again', async () => {
      const { follow, deps, loading } = await landOnList()
      const first = follow.openChat('th-old')
      loading.resolve(false)
      await first
      vi.mocked(deps.loadThread).mockImplementation(() => new Promise(() => {}))

      void follow.openChat('th-old')

      expect(follow.landing.value).toMatchObject({
        openingId: 'th-old',
        failedId: null
      })
    })

    it('ignores a click while another chat is opening', async () => {
      const { follow, deps } = await landOnList()
      void follow.openChat('th-old')

      await follow.openChat('th-new')

      expect(deps.loadThread).toHaveBeenCalledOnce()
    })

    it('opens the chat even when the user has typed before clicking it', async () => {
      const workflow = savedTab()
      const { follow, deps, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait'
      })
      history.value = [
        session('th-old', 'wf-portrait', 1),
        session('th-new', 'wf-portrait', 2)
      ]
      await follow.followTab(workflow)
      vi.mocked(deps.userEngaged).mockReturnValue(true)

      await follow.openChat('th-old')

      expect(deps.trackThreadStarted).toHaveBeenCalledOnce()
    })

    it('does nothing for a chat that settles after the user left the tab', async () => {
      const { follow, deps, loading } = await landOnList()
      const opening = follow.openChat('th-old')

      follow.retireFollow()
      loading.resolve(true)
      await opening

      expect(follow.landing.value).toBeNull()
      expect(deps.trackThreadStarted).not.toHaveBeenCalled()
    })
  })

  describe('a tab whose chat was shown in this page before', () => {
    function resumable(overrides: Partial<FollowDeps> = {}) {
      const workflow = savedTab()
      const created = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        openChatFor: (workflowId) =>
          workflowId === 'wf-portrait' ? 'th-portrait' : undefined,
        ...overrides
      })
      return { ...created, workflow }
    }

    it('opens that chat instead of the list, after the old chat has left', async () => {
      const { follow, deps, workflow } = resumable()

      await follow.followTab(workflow)

      expect(deps.loadThread).toHaveBeenCalledWith(
        'th-portrait',
        expect.any(Function),
        { keepOpenChatUntilLoaded: true }
      )
      expect(
        vi.mocked(deps.showBlankChat).mock.invocationCallOrder[0]
      ).toBeLessThan(vi.mocked(deps.loadThread).mock.invocationCallOrder[0])
      expect(deps.refreshHistory).not.toHaveBeenCalled()
      expect(follow.landing.value).toBeNull()
      expect(deps.trackThreadStarted).toHaveBeenCalledOnce()
    })

    it('shows only a loading state for the tab while the chat opens', async () => {
      const loading = deferred<boolean>()
      const { follow, workflow } = resumable({
        loadThread: vi.fn(() => loading.promise)
      })

      const following = follow.followTab(workflow)

      expect(follow.openingWorkflowName.value).toBe('portrait')
      expect(follow.landing.value).toBeNull()
      loading.resolve(true)
      await following
      expect(follow.openingWorkflowName.value).toBeUndefined()
    })

    it('forgets a chat that cannot be opened and lists the chats of the tab instead', async () => {
      const { follow, deps, history, workflow } = resumable({
        loadThread: vi.fn(async () => false)
      })
      history.value = [
        session('th-other', 'wf-portrait', 1),
        session('th-another', 'wf-portrait', 2)
      ]

      await follow.followTab(workflow)

      expect(deps.forgetOpenChat).toHaveBeenCalledWith('th-portrait')
      expect(deps.trackThreadStarted).not.toHaveBeenCalled()
      expect(follow.openingWorkflowName.value).toBeUndefined()
      expect(follow.landing.value).toMatchObject({ status: 'ready' })
    })

    it('leaves the panel alone when that chat is already open', async () => {
      const { follow, deps, workflow } = resumable({
        currentThreadId: () => 'th-portrait'
      })

      await follow.followTab(workflow)

      expect(deps.showBlankChat).not.toHaveBeenCalled()
      expect(deps.loadThread).not.toHaveBeenCalled()
      expect(follow.landing.value).toBeNull()
    })

    it('gives up the chat when the user starts typing while it opens', async () => {
      const loading = deferred<boolean>()
      const { follow, deps, workflow } = resumable({
        loadThread: vi.fn(() => loading.promise)
      })
      const following = follow.followTab(workflow)

      vi.mocked(deps.userEngaged).mockReturnValue(true)
      follow.userEngagementChanged(true)
      loading.resolve(true)
      await following

      expect(follow.openingWorkflowName.value).toBeUndefined()
      expect(follow.landing.value).toBeNull()
      expect(deps.trackThreadStarted).not.toHaveBeenCalled()
    })

    it('does not resume a chat the cloud workflow of the tab is not known for', async () => {
      const workflow = unsavedTab()
      const { follow, deps } = createFollow(workflow, {
        openChatFor: () => 'th-portrait'
      })

      await follow.followTab(workflow)

      expect(deps.loadThread).not.toHaveBeenCalled()
      expect(deps.showBlankChat).toHaveBeenCalledOnce()
    })
  })

  describe('a tab with exactly one chat', () => {
    function withOneChat(overrides: Partial<FollowDeps> = {}) {
      const workflow = savedTab()
      const created = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        ...overrides
      })
      created.history.value = [session('th-only', 'wf-portrait', 1)]
      return { ...created, workflow }
    }

    const opensWith = (threadId: string) => [
      threadId,
      expect.any(Function),
      { keepOpenChatUntilLoaded: true }
    ]

    it('opens the chat History already holds in place of the list, after the old chat has left', async () => {
      const { follow, deps, workflow } = withOneChat()

      await follow.followTab(workflow)

      expect(deps.loadThread).toHaveBeenCalledWith(...opensWith('th-only'))
      expect(
        vi.mocked(deps.showBlankChat).mock.invocationCallOrder[0]
      ).toBeLessThan(vi.mocked(deps.loadThread).mock.invocationCallOrder[0])
      expect(follow.landing.value).toBeNull()
      expect(deps.trackThreadStarted).toHaveBeenCalledOnce()
    })

    it('shows only a loading state for the tab while it opens, and refreshes History behind it', async () => {
      const loading = deferred<boolean>()
      const { follow, deps, workflow } = withOneChat({
        loadThread: vi.fn(() => loading.promise)
      })

      const following = follow.followTab(workflow)

      expect(follow.openingWorkflowName.value).toBe('portrait')
      expect(follow.landing.value).toBeNull()
      expect(deps.refreshHistory).toHaveBeenCalledWith('none', 'wf-portrait')
      loading.resolve(true)
      await following
      expect(follow.openingWorkflowName.value).toBeUndefined()
    })

    it('never swaps the chat that is opening when the refresh behind it finds more chats', async () => {
      const loading = deferred<boolean>()
      const refreshing = deferred<ThreadListing['status']>()
      const { follow, deps, history, workflow } = withOneChat({
        loadThread: vi.fn(() => loading.promise),
        refreshHistory: vi.fn(() => refreshing.promise)
      })
      const following = follow.followTab(workflow)

      history.value = [
        session('th-only', 'wf-portrait', 1),
        session('th-newer', 'wf-portrait', 2)
      ]
      refreshing.resolve('complete')
      await setImmediate()

      expect(deps.loadThread).toHaveBeenCalledOnce()
      expect(follow.openingWorkflowName.value).toBe('portrait')
      expect(follow.landing.value).toBeNull()
      loading.resolve(true)
      await following
      expect(follow.landing.value).toBeNull()
      expect(deps.loadThread).toHaveBeenCalledOnce()
    })

    it('opens the only chat of an unsaved tab that owns a bound chat', async () => {
      const workflow = unsavedTab()
      const { follow, deps, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-bound'
      })
      history.value = [session('th-bound', 'wf-bound', 1)]

      await follow.followTab(workflow)

      expect(deps.refreshCloudWorkflowIds).not.toHaveBeenCalled()
      expect(deps.loadThread).toHaveBeenCalledWith(...opensWith('th-bound'))
      expect(follow.landing.value).toBeNull()
    })

    it('opens the only chat a fresh complete answer leaves, after a loading state', async () => {
      const workflow = savedTab()
      const listing = deferred<ThreadListing['status']>()
      const { follow, deps, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        refreshHistory: vi.fn(() => listing.promise)
      })

      const following = follow.followTab(workflow)
      expect(follow.landing.value).toMatchObject({ status: 'loading' })
      expect(deps.loadThread).not.toHaveBeenCalled()
      history.value = [session('th-only', 'wf-portrait', 1)]
      listing.resolve('complete')
      await following

      expect(deps.loadThread).toHaveBeenCalledWith(...opensWith('th-only'))
      expect(follow.landing.value).toBeNull()
    })

    it('keeps waiting for the answer when a single chat turns up in History meanwhile, but lists two', async () => {
      const workflow = savedTab()
      const listing = deferred<ThreadListing['status']>()
      const { follow, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        refreshHistory: vi.fn(() => listing.promise)
      })
      const following = follow.followTab(workflow)

      history.value = [session('th-only', 'wf-portrait', 1)]
      expect(follow.landing.value).toMatchObject({ status: 'loading' })
      history.value = [
        session('th-only', 'wf-portrait', 1),
        session('th-newer', 'wf-portrait', 2)
      ]
      expect(follow.landing.value).toMatchObject({ status: 'ready' })

      listing.resolve('complete')
      await following
    })

    it.for<RefreshOutcome>(['incomplete', 'failed'])(
      'never opens a chat from a %s answer',
      async (outcome) => {
        const workflow = savedTab()
        const { follow, deps, history } = createFollow(workflow, {
          cloudIdFor: () => 'wf-portrait',
          refreshHistory: vi.fn(async () => {
            history.value = [session('th-only', 'wf-portrait', 1)]
            return outcome
          })
        })

        await follow.followTab(workflow)

        expect(deps.loadThread).not.toHaveBeenCalled()
        expect(follow.landing.value).toMatchObject({ status: 'failed' })
      }
    )

    it('opens the only chat that a retry finds', async () => {
      const workflow = savedTab()
      const refreshHistory = vi
        .fn<FollowDeps['refreshHistory']>()
        .mockResolvedValueOnce('failed')
      const { follow, deps, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        refreshHistory
      })
      await follow.followTab(workflow)
      refreshHistory.mockImplementationOnce(async () => {
        history.value = [session('th-only', 'wf-portrait', 1)]
        return 'complete'
      })

      follow.retryFollow()

      await vi.waitFor(() =>
        expect(deps.loadThread).toHaveBeenCalledWith(...opensWith('th-only'))
      )
      await vi.waitFor(() => expect(follow.landing.value).toBeNull())
    })

    it('lists the chat with its row marked failed when it cannot be opened', async () => {
      const { follow, deps, workflow } = withOneChat({
        loadThread: vi.fn(async () => false)
      })

      await follow.followTab(workflow)

      expect(follow.landing.value).toMatchObject({
        status: 'ready',
        openingId: null,
        failedId: 'th-only',
        chats: [expect.objectContaining({ id: 'th-only' })]
      })
      expect(follow.openingWorkflowName.value).toBeUndefined()
      expect(deps.trackThreadStarted).not.toHaveBeenCalled()
      expect(deps.forgetOpenChat).not.toHaveBeenCalled()
    })

    it('does the same when the only chat came from a fresh answer', async () => {
      const workflow = savedTab()
      const { follow, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        refreshHistory: vi.fn(async () => {
          history.value = [session('th-only', 'wf-portrait', 1)]
          return 'complete' as const
        }),
        loadThread: vi.fn(async () => false)
      })

      await follow.followTab(workflow)

      expect(follow.landing.value).toMatchObject({
        status: 'ready',
        failedId: 'th-only'
      })
    })

    it('opens the listed chat again when its row is clicked after the failure', async () => {
      const { follow, deps, workflow } = withOneChat({
        loadThread: vi.fn(async () => false)
      })
      await follow.followTab(workflow)
      vi.mocked(deps.loadThread).mockImplementation(() => new Promise(() => {}))

      void follow.openChat('th-only')

      expect(follow.landing.value).toMatchObject({
        openingId: 'th-only',
        failedId: null
      })
    })

    it('lists two or more chats and opens none of them', async () => {
      const { follow, deps, history, workflow } = withOneChat()
      history.value = [
        session('th-only', 'wf-portrait', 1),
        session('th-newer', 'wf-portrait', 2)
      ]

      await follow.followTab(workflow)

      expect(deps.loadThread).not.toHaveBeenCalled()
      expect(follow.landing.value).toMatchObject({ status: 'ready' })
    })

    it('does not try the chat the tab showed before a second time when it is also the only chat', async () => {
      const { follow, deps, workflow } = withOneChat({
        openChatFor: () => 'th-only',
        loadThread: vi.fn(async () => false)
      })

      await follow.followTab(workflow)

      expect(deps.loadThread).toHaveBeenCalledOnce()
      expect(deps.forgetOpenChat).toHaveBeenCalledWith('th-only')
      expect(follow.landing.value).toMatchObject({
        status: 'ready',
        failedId: null,
        chats: [expect.objectContaining({ id: 'th-only' })]
      })
    })

    it('opens a different only chat once the chat the tab showed before could not be opened', async () => {
      const { follow, deps, workflow } = withOneChat({
        openChatFor: () => 'th-gone',
        loadThread: vi.fn(async (threadId: string) => threadId !== 'th-gone')
      })

      await follow.followTab(workflow)

      expect(
        vi.mocked(deps.loadThread).mock.calls.map(([threadId]) => threadId)
      ).toEqual(['th-gone', 'th-only'])
      expect(follow.landing.value).toBeNull()
    })

    it('gives up the chat when the user starts a new chat while it opens', async () => {
      const loading = deferred<boolean>()
      const { follow, deps, workflow } = withOneChat({
        loadThread: vi.fn(() => loading.promise)
      })
      const following = follow.followTab(workflow)

      follow.retireFollow()
      loading.resolve(true)
      await following

      expect(follow.openingWorkflowName.value).toBeUndefined()
      expect(follow.landing.value).toBeNull()
      expect(deps.trackThreadStarted).not.toHaveBeenCalled()
    })

    it('gives up the chat when the user starts typing while it opens', async () => {
      const loading = deferred<boolean>()
      const { follow, deps, workflow } = withOneChat({
        loadThread: vi.fn(() => loading.promise)
      })
      const following = follow.followTab(workflow)

      vi.mocked(deps.userEngaged).mockReturnValue(true)
      follow.userEngagementChanged(true)
      loading.resolve(true)
      await following

      expect(follow.openingWorkflowName.value).toBeUndefined()
      expect(follow.landing.value).toBeNull()
      expect(deps.trackThreadStarted).not.toHaveBeenCalled()
    })
  })

  describe('restoring the workflow of a chat the follow opens', () => {
    it('adopts the tab as the target of the chat it is opening', async () => {
      const workflow = savedTab()
      const restoring = deferred<boolean>()
      const { follow, deps } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait',
        openChatFor: () => 'th-portrait',
        loadThread: vi.fn(() => restoring.promise)
      })
      const following = follow.followTab(workflow)
      vi.mocked(deps.currentThreadId).mockReturnValue('th-portrait')

      const restored = follow.restoreChatWorkflow('wf-portrait', () => true)

      expect(restored).toBe(true)
      expect(deps.adoptWorkflowTarget).toHaveBeenCalledWith(
        workflow,
        'wf-portrait'
      )
      expect(deps.adoptRestoredWorkflowTab).toHaveBeenCalledWith('wf-portrait')
      expect(follow.isOpeningThread('th-portrait')).toBe(true)
      restoring.resolve(true)
      await following
    })

    it('leaves every other chat to the regular workflow restore', () => {
      const workflow = savedTab()
      const restoreThreadWorkflow = vi.fn(async () => true)
      const { follow, deps } = createFollow(workflow, { restoreThreadWorkflow })

      void follow.restoreChatWorkflow('wf-portrait', () => true)

      expect(restoreThreadWorkflow).toHaveBeenCalledWith(
        'wf-portrait',
        expect.any(Function)
      )
      expect(deps.adoptWorkflowTarget).not.toHaveBeenCalled()
      expect(follow.isOpeningThread('th-portrait')).toBe(false)
    })
  })

  describe('a tab the follow is held back from', () => {
    const tabOwningTheOpenChat = unsavedTab()

    it.for([
      {
        reason: 'the user is typing, sending or selecting',
        overrides: { userEngaged: () => true }
      },
      {
        reason: 'the open chat already belongs to the tab',
        overrides: {
          followsVisibleWorkflow: () => false,
          selectedTarget: () => tabOwningTheOpenChat
        }
      }
    ])('does nothing when $reason', async ({ overrides }) => {
      const { follow, deps } = createFollow(tabOwningTheOpenChat, overrides)

      await follow.followTab(tabOwningTheOpenChat)

      expect(deps.refreshCloudWorkflowIds).not.toHaveBeenCalled()
      expect(deps.refreshHistory).not.toHaveBeenCalled()
      expect(deps.showBlankChat).not.toHaveBeenCalled()
      expect(deps.loadThread).not.toHaveBeenCalled()
      expect(follow.landing.value).toBeNull()
    })
  })

  describe('the list of a tab the user has left', () => {
    it.for([
      {
        leaving: 'activates another tab',
        act: (follow: ReturnType<typeof createFollow>['follow']) =>
          follow.activeWorkflowChanged(
            createMockLoadedWorkflow({ path: 'workflows/other.json' })
          )
      },
      {
        leaving: 'starts a new chat or opens Chat history',
        act: (follow: ReturnType<typeof createFollow>['follow']) =>
          follow.retireFollow()
      }
    ])('goes away when the user $leaving', async ({ act }) => {
      const workflow = savedTab()
      const { follow, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait'
      })
      history.value = [
        session('th-portrait', 'wf-portrait', 1),
        session('th-landscape', 'wf-portrait', 2)
      ]
      await follow.followTab(workflow)
      expect(follow.landing.value).toMatchObject({ status: 'ready' })

      act(follow)

      expect(follow.landing.value).toBeNull()
    })

    it('stays when the user starts typing, so a draft does not shuffle the screen', async () => {
      const workflow = savedTab()
      const { follow, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait'
      })
      history.value = [
        session('th-portrait', 'wf-portrait', 1),
        session('th-landscape', 'wf-portrait', 2)
      ]
      await follow.followTab(workflow)

      follow.userEngagementChanged(true)

      expect(follow.landing.value).toMatchObject({ status: 'ready' })
    })

    it('stays when the active workflow is reported again as the same tab', async () => {
      const workflow = savedTab()
      const { follow, history } = createFollow(workflow, {
        cloudIdFor: () => 'wf-portrait'
      })
      history.value = [
        session('th-portrait', 'wf-portrait', 1),
        session('th-landscape', 'wf-portrait', 2)
      ]
      await follow.followTab(workflow)

      follow.activeWorkflowChanged(workflow)

      expect(follow.landing.value).toMatchObject({ status: 'ready' })
    })

    it('is not shown for a tab that is no longer the visible one', async () => {
      const workflow = savedTab()
      const state = { active: workflow }
      const { follow, history } = createFollow(workflow, {
        activeWorkflow: () => state.active,
        cloudIdFor: () => 'wf-portrait'
      })
      history.value = [
        session('th-portrait', 'wf-portrait', 1),
        session('th-landscape', 'wf-portrait', 2)
      ]
      await follow.followTab(workflow)

      state.active = createMockLoadedWorkflow({ path: 'workflows/other.json' })

      expect(follow.landing.value).toBeNull()
    })
  })
})
