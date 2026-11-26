import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'

import { useAgentChatDrafts } from './useAgentChatDrafts'

describe('useAgentChatDrafts', () => {
  it('PD-10: rekeys a blank draft to the newly accepted thread', () => {
    const composer = useAgentComposerStore()
    const activeBlankChatId = ref('blank:tab-a')
    const threadId = ref<string | null>(null)
    const { rekeyBlankDraft } = useAgentChatDrafts({
      threadId,
      activeBlankChatId
    })

    expect(composer.draft).toBe('')
    composer.setText('typed during first send')
    rekeyBlankDraft('blank:tab-a', 'th-new')
    threadId.value = 'th-new'

    expect(composer.draft).toBe('typed during first send')

    activeBlankChatId.value = 'blank:tab-a'
    threadId.value = null
    expect(composer.draft).toBe('')

    threadId.value = 'th-new'
    expect(composer.draft).toBe('typed during first send')
  })

  it('T1-13: rekeys a kept blank draft to its accepted thread while another tab is active', () => {
    const composer = useAgentComposerStore()
    const activeBlankChatId = ref('blank:tab-a')
    const threadId = ref<string | null>(null)
    const { rekeyBlankDraft } = useAgentChatDrafts({
      threadId,
      activeBlankChatId
    })

    composer.setText('typed on tab a after send')
    activeBlankChatId.value = 'blank:tab-b'
    expect(composer.draft).toBe('')

    rekeyBlankDraft('blank:tab-a', 'th-a')
    threadId.value = 'th-a'
    expect(composer.draft).toBe('typed on tab a after send')
  })

  it('PD-13: discards a kept thread draft by thread id', () => {
    const composer = useAgentComposerStore()
    const activeBlankChatId = ref('blank:tab-a')
    const threadId = ref<string | null>('th-a')
    const { discardChatDraft } = useAgentChatDrafts({
      threadId,
      activeBlankChatId
    })

    composer.setText('keep on th-a')
    threadId.value = 'th-b'
    expect(composer.draft).toBe('')

    discardChatDraft('th-a')
    threadId.value = 'th-a'
    expect(composer.draft).toBe('')
  })

  it('keeps each draft upload scope stable across other drafts resetting and across blank-to-thread rekeying', () => {
    const activeBlankChatId = ref('blank:tab-a')
    const threadId = ref<string | null>(null)
    const { uploadScope, resetUploadScope, rekeyBlankDraft, discardChatDraft } =
      useAgentChatDrafts({
        threadId,
        activeBlankChatId
      })

    const scopeA = uploadScope()
    activeBlankChatId.value = 'blank:tab-b'
    const scopeB = uploadScope()
    expect(scopeB).not.toBe(scopeA)

    resetUploadScope('blank:tab-b')
    expect(uploadScope()).not.toBe(scopeB)

    activeBlankChatId.value = 'blank:tab-a'
    expect(uploadScope()).toBe(scopeA)

    rekeyBlankDraft('blank:tab-a', 'th-a')
    threadId.value = 'th-a'
    expect(uploadScope()).toBe(scopeA)

    discardChatDraft('th-a')
    expect(uploadScope()).not.toBe(scopeA)
  })
})
