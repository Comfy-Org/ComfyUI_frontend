import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { Ref } from 'vue'

import type { TurnId } from '../../schemas/agentApiSchema'
import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import { AGENT_THREAD_STORAGE_KEY } from './agentSessionMemory'
import { registerAgentIdentityStateTracker } from './agentIdentityStateTracker'

const auth = vi.hoisted(() => ({
  user: null as unknown as Ref<null | { id: string }>
}))

vi.mock('@/composables/auth/useCurrentUser', async () => {
  const { ref } = await import('vue')
  auth.user = ref<null | { id: string }>(null)
  return {
    useCurrentUser: () => ({
      resolvedUserInfo: auth.user
    })
  }
})

function setUser(id: string | null): void {
  auth.user.value = id === null ? null : { id }
}

function seedUserState(): void {
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
  localStorage.setItem(AGENT_THREAD_STORAGE_KEY, 'thread-a')
}

describe('registerAgentIdentityStateTracker', () => {
  let stop: () => void

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    setUser(null)
    global.URL.revokeObjectURL = vi.fn()
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
