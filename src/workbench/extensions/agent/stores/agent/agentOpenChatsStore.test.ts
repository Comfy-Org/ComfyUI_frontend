import { describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { useAgentOpenChatsStore } from './agentOpenChatsStore'

describe('useAgentOpenChatsStore', () => {
  it('recalls the chat last shown for a workflow', () => {
    const chats = useAgentOpenChatsStore()

    chats.remember('wf-a', 'th-1')
    chats.remember('wf-a', 'th-2')

    expect(chats.recall('wf-a')).toBe('th-2')
    expect(chats.recall('wf-b')).toBeUndefined()
  })

  it('keeps one workflow per chat, the latest it was shown for', () => {
    const chats = useAgentOpenChatsStore()
    chats.remember('wf-a', 'th-1')

    chats.remember('wf-b', 'th-1')

    expect(chats.recall('wf-a')).toBeUndefined()
    expect(chats.recall('wf-b')).toBe('th-1')
  })

  it('forgets a chat wherever it was remembered', () => {
    const chats = useAgentOpenChatsStore()
    chats.remember('wf-a', 'th-1')
    chats.remember('wf-b', 'th-2')

    chats.forget('th-1')

    expect(chats.recall('wf-a')).toBeUndefined()
    expect(chats.recall('wf-b')).toBe('th-2')
  })

  it('lets a computed value follow what is remembered and forgotten', () => {
    const chats = useAgentOpenChatsStore()
    const hasChat = computed(() => chats.recall('wf-a') !== undefined)
    expect(hasChat.value).toBe(false)

    chats.remember('wf-a', 'th-1')
    expect(hasChat.value).toBe(true)

    chats.forget('th-1')
    expect(hasChat.value).toBe(false)
  })
})
