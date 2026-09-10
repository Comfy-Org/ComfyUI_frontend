import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { TurnId } from '../../schemas/agentApiSchema'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentChatHistoryStore } from '../../stores/agent/agentChatHistoryStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import {
  AGENT_THREAD_STORAGE_KEY,
  rememberAgentSessionMemory
} from './agentSessionMemory'
import { registerAgentIdentityStateTracker } from './agentIdentityStateTracker'

const auth = vi.hoisted<{
  source: Ref<null | { id: string }> | null
  user: ComputedRef<null | { id: string }> | null
}>(() => ({ source: null, user: null }))

vi.mock(import('@/composables/auth/useCurrentUser'), async (importOriginal) => {
  const actual = await importOriginal()
  const { computed, ref } = await import('vue')
  const watchHandle = Object.assign(() => {}, {
    stop: () => {},
    pause: () => {},
    resume: () => {}
  })
  auth.source = ref<null | { id: string }>(null)
  auth.user = computed(() => auth.source?.value ?? null)
  return {
    ...actual,
    useCurrentUser: () =>
      ({
        loading: false,
        isLoggedIn: computed(() => auth.user?.value !== null),
        isApiKeyLogin: computed(() => false),
        isEmailProvider: computed(() => false),
        userDisplayName: computed(() => undefined),
        userEmail: computed(() => undefined),
        userPhotoUrl: computed(() => null),
        providerName: computed(() => undefined),
        providerIcon: computed(() => 'pi pi-user'),
        resolvedUserInfo: auth.user!,
        handleSignOut: async () => {},
        handleSignIn: async () => {},
        onUserResolved: () => watchHandle,
        onTokenRefreshed: () => watchHandle,
        onUserLogout: () => {}
      }) satisfies ReturnType<typeof actual.useCurrentUser>
  }
})

function setUser(id: string | null): void {
  if (auth.source === null) throw new Error('Auth ref is not initialized')
  auth.source.value = id === null ? null : { id }
}

function seedUserState(userId: string = 'user-a'): void {
  const conversation = useAgentConversationStore()
  conversation.setThreadId('thread-a')
  conversation.recordUser('turn-a' as TurnId, 'hello', [
    { name: 'input.png', previewUrl: 'blob:turn-preview' }
  ])
  conversation.startTurn('turn-a' as TurnId)

  const composer = useAgentComposerStore()
  composer.draft = 'unfinished prompt'
  composer.attachments = [
    {
      id: 'attachment-a',
      name: 'input.png',
      ref: 'input.png',
      previewUrl: 'blob:composer-preview'
    }
  ]

  useAgentWorkflowTabBindingStore().bind('workflow-a', 'workflows/a.json')
  rememberAgentSessionMemory('thread-a', userId)

  const history = useAgentChatHistoryStore()
  history.replaceAll([{ id: 'thread-a', title: 'Server title', updatedAt: 1 }])
  history.setActive('thread-a')
  history.rename('thread-a', 'Private title')
  history.remove('deleted-thread')
}

describe('registerAgentIdentityStateTracker', () => {
  let stop: () => void

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    localStorage.clear()
    setUser(null)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    stop = registerAgentIdentityStateTracker()
  })

  afterEach(() => {
    stop()
  })

  it('preserves resumable state when the initial user resolves', async () => {
    seedUserState()

    setUser('user-a')
    await nextTick()

    expect(useAgentConversationStore().threadId).toBe('thread-a')
    expect(localStorage.getItem(AGENT_THREAD_STORAGE_KEY)).toBe('thread-a')
  })

  it('purges another user state when the initial identity resolves', async () => {
    seedUserState('user-a')

    setUser('user-b')
    await nextTick()

    expect(useAgentConversationStore().threadId).toBeNull()
    expect(useAgentConversationStore().messages).toEqual([])
    expect(localStorage.getItem(AGENT_THREAD_STORAGE_KEY)).toBeNull()
    expect(useAgentChatHistoryStore().sessions).toEqual([])
    expect(useAgentChatHistoryStore().activeId).toBeNull()
    expect(useAgentChatHistoryStore().titleFor('thread-a')).toBeUndefined()
    useAgentChatHistoryStore().replaceAll([
      { id: 'deleted-thread', title: 'Visible again', updatedAt: 2 }
    ])
    expect(useAgentChatHistoryStore().sessions).toHaveLength(1)
  })

  it('purges ownerless legacy state when the initial identity resolves', async () => {
    seedUserState()
    localStorage.removeItem('Comfy.Agent.ThreadOwnerId')

    setUser('user-a')
    await nextTick()

    expect(useAgentConversationStore().threadId).toBeNull()
    expect(useAgentConversationStore().messages).toEqual([])
    expect(localStorage.getItem(AGENT_THREAD_STORAGE_KEY)).toBeNull()
  })

  it('purges stale state when identity resolved before registration', () => {
    stop()
    seedUserState('user-a')
    setUser('user-b')

    stop = registerAgentIdentityStateTracker()

    expect(useAgentConversationStore().threadId).toBeNull()
    expect(useAgentConversationStore().messages).toEqual([])
    expect(localStorage.getItem(AGENT_THREAD_STORAGE_KEY)).toBeNull()
  })

  it('purges user-scoped state when the identity changes', async () => {
    setUser('user-a')
    await nextTick()
    seedUserState()

    setUser('user-b')
    await nextTick()

    expect(useAgentConversationStore().threadId).toBeNull()
    expect(useAgentConversationStore().messages).toEqual([])
    expect(useAgentComposerStore().draft).toBe('')
    expect(useAgentComposerStore().attachments).toEqual([])
    expect(useAgentChatHistoryStore().sessions).toEqual([])
    expect(useAgentChatHistoryStore().titleFor('thread-a')).toBeUndefined()
    expect(localStorage.getItem(AGENT_THREAD_STORAGE_KEY)).toBeNull()
    expect(
      useAgentWorkflowTabBindingStore().tabPathFor('workflow-a')
    ).toBeUndefined()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:turn-preview')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:composer-preview')
  })

  it('purges through the same path on sign-out', async () => {
    setUser('user-a')
    await nextTick()
    seedUserState()

    setUser(null)
    await nextTick()

    expect(useAgentConversationStore().threadId).toBeNull()
    expect(localStorage.getItem(AGENT_THREAD_STORAGE_KEY)).toBeNull()
  })

  it('stops watching after disposal', async () => {
    setUser('user-a')
    await nextTick()
    seedUserState()
    stop()

    setUser('user-b')
    await nextTick()

    expect(useAgentConversationStore().threadId).toBe('thread-a')
  })
})
