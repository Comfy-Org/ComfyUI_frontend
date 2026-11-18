import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAgentChatDrafts } from './useAgentChatDrafts'

describe('useAgentChatDrafts', () => {
  it('PD-10: rekeys a blank draft to the newly accepted thread only while sending', () => {
    const panelStore = useAgentPanelStore()
    const composer = useAgentComposerStore()
    panelStore.blankChatTab = 'tab-a'
    const threadId = ref<string | null>(null)
    const isSending = ref(false)
    useAgentChatDrafts({ threadId, isSending })

    expect(composer.draft).toBe('')
    composer.setText('typed during first send')
    isSending.value = true
    threadId.value = 'th-new'
    isSending.value = false

    expect(composer.draft).toBe('typed during first send')

    panelStore.blankChatTab = 'tab-a'
    threadId.value = null
    expect(composer.draft).toBe('')

    threadId.value = 'th-new'
    expect(composer.draft).toBe('typed during first send')
  })

  it('PD-13: discards a kept thread draft by thread id', () => {
    const panelStore = useAgentPanelStore()
    const composer = useAgentComposerStore()
    panelStore.blankChatTab = 'tab-a'
    const threadId = ref<string | null>('th-a')
    const isSending = ref(false)
    const { discardChatDraft } = useAgentChatDrafts({ threadId, isSending })

    composer.setText('keep on th-a')
    threadId.value = 'th-b'
    expect(composer.draft).toBe('')

    discardChatDraft('th-a')
    threadId.value = 'th-a'
    expect(composer.draft).toBe('')
  })
})
