import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'

import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import type { TurnId } from '../../schemas/agentApiSchema'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentDraftStore } from '../../stores/agent/agentDraftStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import type { AgentSessionLifetime } from './useAgentLifetime'
import { registerAgentLifetimes, useAgentLifetime } from './useAgentLifetime'

const THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'

type FakeTab = { path: string }

const hostWorkflow = vi.hoisted(() => ({
  store: null as unknown as {
    activeWorkflow: FakeTab | null
    openWorkflows: FakeTab[]
  }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { reactive } = await import('vue')
  const store = reactive({
    activeWorkflow: null as FakeTab | null,
    openWorkflows: [] as FakeTab[]
  })
  hostWorkflow.store = store
  return { useWorkflowStore: () => store }
})

const hostAuth = vi.hoisted(() => ({
  user: null as unknown as { value: { id: string } | null }
}))

vi.mock('@/composables/auth/useCurrentUser', async () => {
  const { ref } = await import('vue')
  const resolvedUserInfo = ref<{ id: string } | null>(null)
  hostAuth.user = resolvedUserInfo
  return { useCurrentUser: () => ({ resolvedUserInfo }) }
})

function setUser(id: string | null): void {
  hostAuth.user.value = id === null ? null : { id }
}

function fakeSession(calls: string[] = []) {
  const session: AgentSessionLifetime = {
    start: vi.fn(() => {
      calls.push('start')
    }),
    stop: vi.fn(() => {
      calls.push('stop')
    })
  }
  return { session, calls }
}

function mountPanel(
  session: AgentSessionLifetime,
  onFollowerTeardown?: () => void
) {
  let docWorkflowId!: Readonly<Ref<string | null>>
  const host = defineComponent({
    setup() {
      const lifetime = useAgentLifetime({ session })
      docWorkflowId = lifetime.docWorkflowId
      // Mirrors the real composition: the follower consumes docWorkflowId and
      // only then registers its own teardown hook.
      if (onFollowerTeardown) onBeforeUnmount(onFollowerTeardown)
      return () => null
    }
  })
  const { unmount } = render(host)
  return { unmount, docWorkflowId: () => docWorkflowId.value }
}

function seedUserScopedState() {
  const conversation = useAgentConversationStore()
  const composer = useAgentComposerStore()
  const bindings = useAgentWorkflowTabBindingStore()
  const drafts = useAgentDraftStore()
  conversation.setThreadId('th-1')
  composer.draft = 'half-typed prompt'
  composer.attachments = [
    {
      id: 'a1',
      name: 'cat.png',
      ref: 'cat.png',
      previewUrl: 'blob:cat-preview'
    }
  ]
  localStorage.setItem(THREAD_STORAGE_KEY, 'th-1')
  bindings.bind('wf-1', 'workflows/a.json')
  drafts.bind('wf-1')
  return { conversation, composer, bindings, drafts }
}

const disposers: Array<() => void> = []

// One disposal path for the whole file: an inline dispose() that never runs
// because its test failed earlier leaks a live watcher into the next test,
// which then reports a second red for one defect.
function startLifetimes(): () => void {
  const dispose = registerAgentLifetimes()
  disposers.push(dispose)
  return dispose
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  hostWorkflow.store.activeWorkflow = null
  hostWorkflow.store.openWorkflows = []
  setUser(null)
  global.URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.()
})

describe('registerAgentLifetimes (app scope)', () => {
  it('clears the unseen dot when its tab becomes active, with no panel mounted', async () => {
    const activity = useWorkflowTabActivityStore()
    activity.markModified('workflows/a.json')
    startLifetimes()

    hostWorkflow.store.activeWorkflow = { path: 'workflows/a.json' }
    await nextTick()

    expect(activity.unseenModifiedPaths.has('workflows/a.json')).toBe(false)

    activity.markModified('workflows/b.json')
    const markSeen = vi.spyOn(activity, 'markSeen')
    hostWorkflow.store.activeWorkflow = null
    await nextTick()

    expect(markSeen).not.toHaveBeenCalled()
    expect(activity.unseenModifiedPaths.has('workflows/b.json')).toBe(true)
  })

  it('prunes activity state when a tab closes, with no panel mounted', async () => {
    const activity = useWorkflowTabActivityStore()
    startLifetimes()
    hostWorkflow.store.openWorkflows = [
      { path: 'workflows/a.json' },
      { path: 'workflows/b.json' }
    ]
    await nextTick()
    activity.setEditing('workflows/b.json')
    activity.markModified('workflows/b.json')

    hostWorkflow.store.openWorkflows = [{ path: 'workflows/a.json' }]
    await nextTick()

    expect(activity.editingTabPath).toBeNull()
    expect(activity.unseenModifiedPaths.has('workflows/b.json')).toBe(false)
  })

  it('stops every app-scope watcher once its disposer runs', async () => {
    const activity = useWorkflowTabActivityStore()
    const dispose = startLifetimes()
    setUser('user-a')
    hostWorkflow.store.openWorkflows = [
      { path: 'workflows/a.json' },
      { path: 'workflows/b.json' }
    ]
    await nextTick()
    activity.markModified('workflows/a.json')
    activity.setEditing('workflows/b.json')
    localStorage.setItem(THREAD_STORAGE_KEY, 'th-1')

    dispose()
    hostWorkflow.store.activeWorkflow = { path: 'workflows/a.json' }
    hostWorkflow.store.openWorkflows = [{ path: 'workflows/a.json' }]
    setUser('user-b')
    await nextTick()

    expect(activity.unseenModifiedPaths.has('workflows/a.json')).toBe(true)
    expect(localStorage.getItem(THREAD_STORAGE_KEY)).toBe('th-1')
    expect(activity.editingTabPath).toBe('workflows/b.json')
  })

  it('purges user-scoped agent state when the user id changes, with no panel mounted', async () => {
    startLifetimes()
    localStorage.setItem(THREAD_STORAGE_KEY, 'th-0')
    setUser('user-a')
    await nextTick()
    // Boot-time null -> user resolution resumes, never purges.
    expect(localStorage.getItem(THREAD_STORAGE_KEY)).toBe('th-0')
    const { conversation, composer, bindings, drafts } = seedUserScopedState()

    setUser('user-b')
    await nextTick()

    expect(conversation.threadId).toBeNull()
    expect(composer.draft).toBe('')
    expect(composer.attachments).toEqual([])
    expect(localStorage.getItem(THREAD_STORAGE_KEY)).toBeNull()
    expect(bindings.tabPathFor('wf-1')).toBeUndefined()
    expect(drafts.workflowId).toBeNull()
  })

  it('changes nothing when the same user id re-emits (token refresh guard)', async () => {
    startLifetimes()
    setUser('user-a')
    await nextTick()
    const { conversation, composer, bindings, drafts } = seedUserScopedState()

    setUser('user-a')
    await nextTick()

    expect(conversation.threadId).toBe('th-1')
    expect(composer.draft).toBe('half-typed prompt')
    expect(localStorage.getItem(THREAD_STORAGE_KEY)).toBe('th-1')
    expect(bindings.tabPathFor('wf-1')).toBe('workflows/a.json')
    expect(drafts.workflowId).toBe('wf-1')
  })

  it('settles the outgoing turns before reset on a user change', async () => {
    startLifetimes()
    setUser('user-a')
    await nextTick()
    const conversation = useAgentConversationStore()
    const abortActiveTurn = vi.spyOn(conversation, 'abortActiveTurn')
    const dropBackgroundTurns = vi.spyOn(conversation, 'dropBackgroundTurns')
    conversation.setThreadId('th-live')
    const turnId = 'turn-live' as TurnId
    conversation.recordUser(turnId, 'mid-stream')
    conversation.startTurn(turnId)
    const live = conversation.messages[0]!
    expect(live.streaming).toBe(true)

    setUser('user-b')
    await nextTick()

    expect(abortActiveTurn).toHaveBeenCalledTimes(1)
    expect(dropBackgroundTurns).toHaveBeenCalledTimes(1)
    // reset() nulls the transport via clearActive() WITHOUT settling it, so an
    // abort that runs after reset silently no-ops and leaves this true.
    expect(live.streaming).toBe(false)
  })

  it('leaves the outgoing background turn unreachable after a switch', async () => {
    startLifetimes()
    setUser('user-a')
    await nextTick()
    const conversation = useAgentConversationStore()
    conversation.setThreadId('th-1')
    conversation.startBackgroundTurn(
      'th-1',
      'turn-1' as TurnId,
      'user A prompt'
    )

    setUser('user-b')
    await nextTick()
    conversation.setThreadId('th-1')
    conversation.resumeBackgroundTurn()

    expect(conversation.activeTurnId).toBeNull()
  })

  it('revokes blob previews before clearing the composer', async () => {
    startLifetimes()
    setUser('user-a')
    await nextTick()
    const { conversation } = seedUserScopedState()
    // A stashed background turn retains its previews, so reset() only
    // revokes them once the drop has already emptied the retained set.
    // This is what makes the abort/drop/reset order load-bearing.
    const turnId = 'turn-1' as TurnId
    conversation.recordUser(turnId, 'look at this', [
      { name: 'cat.png', previewUrl: 'blob:stashed-preview', ref: 'cat.png' }
    ])
    conversation.startTurn(turnId)
    conversation.stashActiveTurn()

    setUser('user-b')
    await nextTick()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cat-preview')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:stashed-preview')
  })

  it('revokes a background turn preview that recordUser never tracked', async () => {
    startLifetimes()
    setUser('user-a')
    await nextTick()
    const conversation = useAgentConversationStore()
    // The ack-after-navigation path: the turn is stashed straight into
    // backgroundTurns, so its previews live nowhere else.
    conversation.startBackgroundTurn(
      'th-bg',
      'turn-bg' as TurnId,
      'sent before switching',
      [{ name: 'dog.png', previewUrl: 'blob:bg-preview', ref: 'dog.png' }]
    )

    setUser('user-b')
    await nextTick()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:bg-preview')
  })

  it('purges on logout through the same switch path', async () => {
    startLifetimes()
    setUser('user-a')
    await nextTick()
    const { conversation, drafts } = seedUserScopedState()

    setUser(null)
    await nextTick()

    expect(conversation.threadId).toBeNull()
    expect(localStorage.getItem(THREAD_STORAGE_KEY)).toBeNull()
    expect(drafts.workflowId).toBeNull()
  })
})

describe('useAgentLifetime (panel scope)', () => {
  it('starts the session exactly once on mount', () => {
    const { session } = fakeSession()

    mountPanel(session)

    expect(session.start).toHaveBeenCalledTimes(1)
    expect(session.stop).not.toHaveBeenCalled()
  })

  it('does not restart the session when the user resolves after mount', async () => {
    const { session } = fakeSession()

    mountPanel(session)
    setUser('user-a')
    await nextTick()

    expect(session.start).toHaveBeenCalledTimes(1)
    expect(session.stop).not.toHaveBeenCalled()
  })

  it('stops the session exactly once and clears tab activity on unmount', () => {
    const { session } = fakeSession()
    const activity = useWorkflowTabActivityStore()
    const { unmount } = mountPanel(session)
    activity.setEditing('workflows/a.json')
    activity.setCreating(true)

    unmount()

    expect(session.stop).toHaveBeenCalledTimes(1)
    expect(activity.editingTabPath).toBeNull()
    expect(activity.creatingTab).toBe(false)
  })

  it('stops the session strictly before the follower teardown on unmount', () => {
    const order: string[] = []
    const { session } = fakeSession(order)
    const { unmount } = mountPanel(session, () => {
      order.push('follower-teardown')
    })

    unmount()

    expect(order).toEqual(['start', 'stop', 'follower-teardown'])
  })

  it('does not clear the doc binding on unmount (FE-1902 remount rebind)', () => {
    const { session } = fakeSession()
    const drafts = useAgentDraftStore()
    const bindings = useAgentWorkflowTabBindingStore()
    const { unmount, docWorkflowId } = mountPanel(session)
    drafts.bind('wf-1')
    bindings.bind('wf-1', 'workflows/a.json')
    expect(docWorkflowId()).toBe('wf-1')

    unmount()

    expect(drafts.workflowId).toBe('wf-1')
    expect(bindings.tabPathFor('wf-1')).toBe('workflows/a.json')
  })

  it('balances start and stop across a remount', () => {
    const { session, calls } = fakeSession()

    const first = mountPanel(session)
    first.unmount()
    const second = mountPanel(session)
    expect(calls).toEqual(['start', 'stop', 'start'])

    second.unmount()
    expect(calls).toEqual(['start', 'stop', 'start', 'stop'])
  })

  it('purges, stops, then starts in order on a user change while mounted', async () => {
    startLifetimes()
    setUser('user-a')
    await nextTick()
    const order: string[] = []
    const { session } = fakeSession(order)
    const conversation = useAgentConversationStore()
    vi.spyOn(conversation, 'reset').mockImplementation(() => {
      order.push('purge')
    })
    const drafts = useAgentDraftStore()
    const { docWorkflowId } = mountPanel(session)
    drafts.bind('wf-1')
    order.length = 0

    setUser('user-b')
    await nextTick()

    expect(order).toEqual(['purge', 'stop', 'start'])
    expect(docWorkflowId()).toBeNull()
  })

  it('does not restart the session or touch the doc binding on a tab switch', async () => {
    startLifetimes()
    const { session } = fakeSession()
    const drafts = useAgentDraftStore()
    hostWorkflow.store.activeWorkflow = { path: 'workflows/a.json' }
    const { docWorkflowId } = mountPanel(session)
    drafts.bind('wf-1')

    hostWorkflow.store.activeWorkflow = { path: 'workflows/b.json' }
    await nextTick()

    expect(session.start).toHaveBeenCalledTimes(1)
    expect(session.stop).not.toHaveBeenCalled()
    expect(docWorkflowId()).toBe('wf-1')
  })

  it('leaves the binding untouched when the tab bound to the live doc closes (pins the recorded no-op pending CHRISTIAN QUESTION Q2)', async () => {
    startLifetimes()
    const { session } = fakeSession()
    const drafts = useAgentDraftStore()
    const bindings = useAgentWorkflowTabBindingStore()
    hostWorkflow.store.openWorkflows = [
      { path: 'workflows/a.json' },
      { path: 'workflows/b.json' }
    ]
    await nextTick()
    const { docWorkflowId } = mountPanel(session)
    bindings.bind('wf-1', 'workflows/b.json')
    drafts.bind('wf-1')

    hostWorkflow.store.openWorkflows = [{ path: 'workflows/a.json' }]
    await nextTick()

    expect(bindings.tabPathFor('wf-1')).toBe('workflows/b.json')
    expect(docWorkflowId()).toBe('wf-1')
  })

  it('leaks no session control after unmount', async () => {
    setUser('user-a')
    const { session } = fakeSession()
    const { unmount } = mountPanel(session)

    unmount()
    setUser('user-b')
    await nextTick()

    expect(session.start).toHaveBeenCalledTimes(1)
    expect(session.stop).toHaveBeenCalledTimes(1)
  })

  it('never adds a window event listener (no pagehide flush)', async () => {
    // Pre-warm every store the purge touches, so their own setup listeners
    // (useLocalStorage) cannot masquerade as adapter listeners.
    useAgentConversationStore()
    useAgentComposerStore()
    useAgentWorkflowTabBindingStore()
    useAgentDraftStore()
    useWorkflowTabActivityStore()
    setUser('user-a')
    const addEventListener = vi.spyOn(window, 'addEventListener')

    startLifetimes()
    const { session } = fakeSession()
    const { unmount } = mountPanel(session)
    setUser('user-b')
    await nextTick()
    unmount()

    expect(addEventListener).not.toHaveBeenCalled()
  })
})
